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
    const { wallet, polygonInfo } = req.body;
  
    if (!wallet || !polygonInfo) {
      return res.status(400).json({ error: 'Wallet and polygon info are required' });
    }
  
    try {
      // Find the owner by wallet address
      const owner = await pool.query('SELECT id FROM landOwners WHERE wallet = $1', [wallet]);
      if (owner.rows.length === 0) {
        return res.status(404).json({ error: 'Owner not found' });
      }
      const ownerId = owner.rows[0].id;
  
      // Insert the polygon info into the database
      const result = await pool.query(
        'INSERT INTO landInfo (owner_id, polygon_info) VALUES ($1, $2) RETURNING id',
        [ownerId, JSON.stringify(polygonInfo)]
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
    const lands = await pool.query('SELECT * FROM landInfo WHERE owner_id = $1', [ownerId]);
    res.status(200).json(lands.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () => {
  console.log('Server running on port 3001');
});
