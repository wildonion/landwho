const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg'); // PostgreSQL client
const app = express();
const cors = require('cors'); // Import CORS middleware
const PinataSDK = require('@pinata/sdk');
const axios = require('axios');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

app.use(bodyParser.json());
app.use(cors()); // Enable CORS for all routes


const mintingParcels = new Set();

// PostgreSQL setup
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'landwho',
  password: 'geDteDd0Ltg2135FJYQ6rjNYHYkGQa70',
  port: 5432,
});

const pinata = new PinataSDK('c47c85d0697e6b9c339a', '1d56c19710149e97c4d91d915410af1e12671f1ff79ef20a529e40a4b02df3e6');
const contractAddress = '0x8F0Ead5431eCf6a21334aED05232C945DE3FcD35';

// Load ABI from the compiled contract
const abiPath = path.join(__dirname, 'LandRegistry.json');
const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8')).abi;

// Set up ethers provider and signer (make sure your private key has enough MATIC)
const provider = new ethers.JsonRpcProvider('https://polygon-amoy.g.alchemy.com/v2/TWIzZXyJHNOsBl3vxNMzM0J7QMXKDNGH'); // Use appropriate RPC URL
const signer = new ethers.Wallet('5fcec999332133dcbca2ed18b83f87669087b9dd9f86691bca68a252aae3da02', provider);
const contract = new ethers.Contract(contractAddress, abi, signer);

app.post('/mintParcel', async (req, res) => {
  const {
    parcel_uuid,
    parcel_price,
    parcel_royalty,
    parcel_points,
    parcel_land_id,
    parcel_land_name,
    parcel_owner_wallet
  } = req.body;

  try {


    const parcelKey = JSON.stringify(parcel_points);

    // Check if the parcel is already in the minting process
    if (mintingParcels.has(parcelKey)) {
      console.log("parcel is inside the set");
      return res.status(400).json({ error: 'Parcel is already being minted.' });
    }

    console.log("parcel is not inside the set, adding it");
    // Add the parcel to the mintingParcels Set
    mintingParcels.add(parcelKey);

    // Check if the parcel has already been minted
    const existingParcelQuery = await pool.query(
      'SELECT * FROM minted_parcels WHERE parcel_points = $1 AND parcel_land_id = $2',
      [JSON.stringify(parcel_points), parcel_land_id]
    );

    if (existingParcelQuery.rows.length > 0) {
      mintingParcels.delete(parcelKey);
      return res.status(400).json({ error: 'Parcel has already been minted.' });
    }

    // Immediately send a response to the client
    res.status(200).json({
      message: 'Minting process started. You will be notified upon completion.',
      status: 'pending'
    });

    // Continue minting in the background
    (async () => {
      try {
        // Pin the parcel info to IPFS
        let parcelInfo = `${parcel_uuid}-${parcel_land_name}-${parcel_land_id}`;
        const options = {
          pinataMetadata: {
            name: parcelInfo,
            keyvalues: {
              parcelId: parcel_uuid,
              ownerid: parcel_owner_wallet
            }
          },
          pinataOptions: {
            cidVersion: 0
          }
        };

        const result = await pinata.pinJSONToIPFS(req.body, options);
        let ipfsHash = result.IpfsHash;

        // Send the mint transaction to the blockchain
        let parcelInfoIpfs = `https://turquoise-bizarre-reindeer-570.mypinata.cloud/ipfs/${ipfsHash}`
        const tx = await contract.mintLand(parcelInfoIpfs, ethers.parseEther(parcel_price), parcel_royalty);
        console.log('Minting transaction sent:', tx.hash);

        // Wait for the transaction to be mined
        const receipt = await tx.wait();

        // Insert the minted parcel into the database
        const parcelResult = await pool.query(
          `INSERT INTO minted_parcels (parcel_uuid, parcel_price, parcel_royalty, parcel_points, parcel_land_id, parcel_land_name, parcel_owner_wallet, ipfs_hash, tx_hash)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
          [
            parcel_uuid,
            parcel_price,
            parcel_royalty,
            JSON.stringify(parcel_points),
            parcel_land_id,
            parcel_land_name,
            parcel_owner_wallet,
            parcelInfoIpfs,
            tx.hash
          ]
        );

        const mintedParcel = parcelResult.rows[0];

        // Insert a notification record into the notifs table
        await pool.query(
          `INSERT INTO notifs (owner_wallet, notif_data) VALUES ($1, $2)`,
          [parcel_owner_wallet, JSON.stringify(mintedParcel)]
        );

        // Remove the parcel from the mintingParcels Set once minting is complete
        mintingParcels.delete(parcelKey);


        console.log('Minting completed and notification sent.');

      } catch (err) {

        mintingParcels.delete(parcelKey);

        console.error('Error during the minting process:', err);

        // Optional: Insert an error notification
        await pool.query(
          `INSERT INTO notifs (owner_wallet, notif_data) VALUES ($1, $2)`,
          [parcel_owner_wallet, JSON.stringify({ error: 'Minting failed', details: err.message })]
        );
      }
    })();

  } catch (err) {
    console.error('Error while starting the minting process:', err);
    res.status(500).json({ error: 'Failed to start the minting process.' });
  }
});


// Fetch notifications for a specific user
app.get('/notifs/:wallet', async (req, res) => {
  const { wallet } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM notifs WHERE owner_wallet = $1 AND is_seen = false ORDER BY fired_at DESC',
      [wallet]
    );

    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



// Get minted parcels by land ID
app.get('/mintedParcels/:landId', async (req, res) => {
  const { landId } = req.params;

  try {
    const result = await pool.query('SELECT * FROM minted_parcels WHERE parcel_land_id = $1', [landId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No minted parcels found for this land' });
    }

    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching minted parcels:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// Register a new landowner
app.post('/registerOwner', async (req, res) => {
  const { wallet } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO landOwners (wallet) VALUES ($1) ON CONFLICT (wallet) DO NOTHING RETURNING id',
      [wallet]
    );
    res.status(201).json(result.rows[0] || { message: 'Owner already registered' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register new land
app.post('/registerLand', async (req, res) => {
  const { wallet, polygonInfo, name } = req.body;

  if (!wallet || !polygonInfo || !name) {
    return res.status(400).json({ error: 'Wallet, name, and polygon info are required' });
  }

  try {
    // Find the owner by wallet address
    const owner = await pool.query('SELECT id FROM landOwners WHERE wallet = $1', [wallet]);
    if (owner.rows.length === 0) {
      return res.status(404).json({ error: 'Owner not found' });
    }
    const ownerId = owner.rows[0].id;

    // Insert the polygon info and name into the database
    const result = await pool.query(
      'INSERT INTO landInfo (owner_id, polygon_info, name) VALUES ($1, $2, $3) RETURNING id',
      [ownerId, JSON.stringify(polygonInfo), name]
    );

    res.status(201).json(result.rows[0]); // Return the new land ID
  } catch (err) {
    console.error('Error registering land:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

  

// Get lands by wallet address
app.get('/lands/:wallet', async (req, res) => {
  const { wallet } = req.params;
  try {
    const owner = await pool.query('SELECT id FROM landOwners WHERE wallet = $1', [wallet]);
    if (owner.rows.length === 0) {
      return res.status(404).json({ error: 'Owner not found' });
    }
    const ownerId = owner.rows[0].id;
    
    // Fetch lands in descending order by `created_at`
    const lands = await pool.query('SELECT * FROM landInfo WHERE owner_id = $1 ORDER BY created_at DESC', [ownerId]);
    
    res.status(200).json(lands.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Update an existing land
app.put('/land/:id', async (req, res) => {
  const { id } = req.params;
  const { polygonInfo, name } = req.body;

  if (!polygonInfo || !name) {
    return res.status(400).json({ error: 'Polygon info and name are required' });
  }

  try {
    const result = await pool.query(
      'UPDATE landInfo SET polygon_info = $1, name = $2 WHERE id = $3 RETURNING id',
      [JSON.stringify(polygonInfo), name, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Land not found' });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error updating land:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// Delete an existing land
app.delete('/lands/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM landInfo WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Land not found' });
    }

    res.status(200).json({ message: 'Land deleted successfully' });
  } catch (err) {
    console.error('Error deleting land:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
 

app.post('/notifs/seen', async (req, res) => {
  const { id } = req.body;

  try {
    await pool.query('UPDATE notifs SET is_seen = true WHERE id = $1', [id]);
    res.status(200).json({ message: 'Notification marked as seen' });
  } catch (err) {
    console.error('Error marking notification as seen:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(3001, () => {
  console.log('Server running on port 3001');
});
