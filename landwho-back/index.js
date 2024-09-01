const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg'); // PostgreSQL client
const app = express();
const cors = require('cors'); // Import CORS middleware
app.use(bodyParser.json());
app.use(cors()); // Enable CORS for all routes

// PostgreSQL setup
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'landwho',
  password: 'geDteDd0Ltg2135FJYQ6rjNYHYkGQa70',
  port: 5432,
});


app.post('/mintParcel', async (req, res) => {
  const { parcel_uuid, parcel_price, parcel_royalty, parcel_points, parcel_land_id, parcel_land_name, parcel_owner_wallet } = req.body;

  // Log the received parcel information
  console.log('Received Parcel Info:', {
    parcel_uuid,
    parcel_price,
    parcel_royalty,
    parcel_points,
    parcel_land_id,
    parcel_land_name,
    parcel_owner_wallet,
  });

  // You can optionally store this information in the database or perform other actions

  res.status(200).json({ message: 'Parcel info received successfully' });
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

app.listen(3001, () => {
  console.log('Server running on port 3001');
});
