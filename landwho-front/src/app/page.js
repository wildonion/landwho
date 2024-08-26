"use client";

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { connectWallet } from '../utils/chain';
import axios from 'axios';

const MyMap = dynamic(() => import('./components/MyMap'), { ssr: false });

export default function Home() {
  const [wallet, setWallet] = useState(null);
  const [lands, setLands] = useState([]);
  const [mapRef, setMapRef] = useState(null);
  const [showPopup, setShowPopup] = useState(null); // To trigger showing the popup

  useEffect(() => {
    if (wallet) {
      fetchLands(wallet);
    }
  }, [wallet]);

  const handleOpenPolygonWindow = (polygonData) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(polygonData)], { type: 'application/json' }));
    const newWindow = window.open(url, '_blank');
    newWindow.focus();
  };
  
  const fetchLands = async (wallet) => {
    try {
      const response = await axios.get(`http://localhost:3001/lands/${wallet}`);
      setLands(response.data || []);
    } catch (err) {
      console.error('Error fetching lands:', err);
      setLands([]);
    }
  };

  const registerLand = async (polygonInfo) => {
    try {
      await axios.post('http://localhost:3001/registerLand', { wallet, polygonInfo });
      fetchLands(wallet);
    } catch (err) {
      console.error('Error registering land:', err);
    }
  };

  const handleConnectWallet = async () => {
    const userWallet = await connectWallet();
    if (userWallet) {
      setWallet(userWallet);
      try {
        await axios.post('http://localhost:3001/registerOwner', { wallet: userWallet });
        fetchLands(userWallet);
      } catch (err) {
        console.error('Error registering owner:', err);
      }
    } else {
      console.error('Wallet connection failed');
    }
  };

  const loadLandOnMap = (polygonInfo) => {
    if (mapRef) {
      const L = require('leaflet');

      // Ensure the polygon is cleared before adding a new one
      mapRef.eachLayer((layer) => {
        if (layer instanceof L.Polygon || layer instanceof L.Popup) {
          mapRef.removeLayer(layer);
        }
      });

      const polygon = L.polygon(polygonInfo, { color: 'blue' }).addTo(mapRef);

      const bounds = polygon.getBounds();
      mapRef.fitBounds(bounds);

      // Center the map on the polygon's center point
      mapRef.setView(bounds.getCenter(), 13);

      // Set the popup content and position
      setShowPopup({
        polygon: polygonInfo,
        center: bounds.getCenter()
      });
    } else {
      console.error('Map reference is not set');
    }
  };

  return (
    <div className="container">
      <Head>
        <title>LandWho Platform</title>
        <meta name="description" content="A platform to register and purchase land as NFTs" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="main-content">
        {!wallet ? (
          <button className="connect-button" onClick={handleConnectWallet}>
            Connect Wallet
          </button>
        ) : (
          <div className="content">
            <div className="map-container">
              <MyMap
                onPolygonCreated={registerLand}
                setMapRef={(map) => setMapRef(map)}
                initialPolygons={lands.map((land) => land.polygon_info)}
                showPopup={showPopup} // Pass the showPopup state to MyMap
              />
            </div>
            <div className="land-list">
              <h2>Your Registered Lands:</h2>
              {lands.length > 0 ? (
                <ul>
                  {lands.map((land) => (
                    <li key={land.id}>
                      <button onClick={() => loadLandOnMap(land.polygon_info)}>
                        Land ID: {land.id}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No lands registered yet.</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
