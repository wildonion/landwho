"use client";

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import axios from 'axios';
import { connectWallet } from '../utils/chain';
import * as turf from '@turf/turf'; // Import Turf.js

const MyMap = dynamic(() => import('./components/MyMap'), { ssr: false });

export default function Home() {
  const [wallet, setWallet] = useState(null);
  const [lands, setLands] = useState([]);
  const [mapRef, setMapRef] = useState(null);
  const [showPopup, setShowPopup] = useState(null);
  const [gridLayers, setGridLayers] = useState([]);
  const [selectedPolygon, setSelectedPolygon] = useState(null);
  const [showSelectButton, setShowSelectButton] = useState(false);
  const [isButtonDisabled, setIsButtonDisabled] = useState(false);
  const [showModal, setShowModal] = useState(false); // State to control modal visibility
  const [landName, setLandName] = useState(''); // State to store the land name input
  const [searchQuery, setSearchQuery] = useState(''); // State for the search box

  useEffect(() => {
    if (wallet) {
      fetchLands(wallet);
    }
  }, [wallet]);

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
    setShowModal(true);
    setSelectedPolygon(polygonInfo);
  };

  const handleSaveLand = async () => {
    if (!landName || !selectedPolygon) return;

    try {
      await axios.post('http://localhost:3001/registerLand', {
        wallet,
        polygonInfo: selectedPolygon,
        name: landName,
      });
      fetchLands(wallet);
      setShowModal(false);
      setLandName(''); // Reset the land name input after saving
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

  // Helper function to close a polygon
  const closePolygon = (coordinates) => {
    const firstPoint = coordinates[0];
    const lastPoint = coordinates[coordinates.length - 1];
    if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
      coordinates.push(firstPoint); // Close the polygon
    }
    return coordinates;
  };

  // Draw and select grids inside the polygon
  const drawGrid = (polygon) => {
    if (!mapRef) {
      console.error("Map reference is not set");
      return;
    }

    setSelectedPolygon(polygon);
    const closedPolygon = closePolygon([...polygon]);
    const polygonGeoJson = turf.polygon([closedPolygon.map(coord => [coord[1], coord[0]])]);

    let bbox = turf.bbox(polygonGeoJson);
    const expandBy = 0.01;
    bbox = [
      bbox[0] - expandBy,
      bbox[1] - expandBy,
      bbox[2] + expandBy,
      bbox[3] + expandBy
    ];

    const cellSide = 100;
    const grid = turf.squareGrid(bbox, cellSide, { units: 'meters' });

    const newGridLayers = grid.features.map((cell) => {
      const cellLayer = L.polygon(cell.geometry.coordinates[0].map(coord => [coord[1], coord[0]]), {
        color: 'red',
        weight: 1,
        fillOpacity: 0.2,
        fillColor: 'red'
      }).addTo(mapRef);

      cellLayer.on('click', () => {
        let turf_polygon_cell = turf.polygon([closePolygon(cell.geometry.coordinates[0])]);
        const intersects = turf.booleanIntersects(turf_polygon_cell, polygonGeoJson);

        if (intersects) {
          const intersection = turf.intersect(turf.featureCollection([turf_polygon_cell, polygonGeoJson]));
          if (intersection && intersection.geometry && intersection.geometry.type === 'Polygon') {
            const intersectionCoords = intersection.geometry.coordinates[0];
            if (intersectionCoords.length >= 4) {
              mapRef.removeLayer(cellLayer);
              const intersectionLayer = L.polygon(intersectionCoords.map(coord => [coord[1], coord[0]]), {
                color: 'yellow',
                weight: 1,
                fillOpacity: 0.5,
                fillColor: 'yellow'
              }).addTo(mapRef);

              setGridLayers((prevLayers) => prevLayers.filter(layer => layer !== cellLayer).concat(intersectionLayer));
            } else {
              console.error("Invalid intersection polygon: less than 4 positions.");
            }
          } else {
            console.error("Intersection could not be calculated.");
          }
        } else {
          console.log('Cell does not intersect with the polygon.');
        }
      });

      return cellLayer;
    });

    setGridLayers(newGridLayers);
  };

  const selectAllGridCells = () => {
    if (!gridLayers || gridLayers.length === 0 || !selectedPolygon) return;

    const closedPolygon = [...selectedPolygon];
    if (closedPolygon[0][0] !== closedPolygon[closedPolygon.length - 1][0] ||
        closedPolygon[0][1] !== closedPolygon[closedPolygon.length - 1][1]) {
      closedPolygon.push(closedPolygon[0]);
    }

    const polygonGeoJson = turf.polygon([closedPolygon.map(coord => [coord[1], coord[0]])]);

    gridLayers.forEach(layer => {
      const coordinates = layer.getLatLngs()[0].map(coord => [coord.lng, coord.lat]);

      if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
          coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
        coordinates.push(coordinates[0]);
      }

      const layerGeoJson = turf.polygon([coordinates]);
      const intersects = turf.booleanIntersects(layerGeoJson, polygonGeoJson);

      if (intersects) {
        const intersection = turf.intersect(turf.featureCollection([layerGeoJson, polygonGeoJson]));
        if (intersection && intersection.geometry && intersection.geometry.type === 'Polygon') {
          const intersectionCoords = intersection.geometry.coordinates[0];
          if (intersectionCoords.length >= 4) {
            mapRef.removeLayer(layer);
            const intersectionLayer = L.polygon(intersectionCoords.map(coord => [coord[1], coord[0]]), {
              color: 'yellow',
              weight: 1,
              fillOpacity: 0.5,
              fillColor: 'yellow'
            }).addTo(mapRef);

            setGridLayers((prevLayers) => prevLayers.filter(existingLayer => existingLayer !== layer).concat(intersectionLayer));
          }
        }
      }
    });

    setIsButtonDisabled(true);
  };

  const resetMap = () => {
    if (selectedPolygon) {
      loadLandOnMap(selectedPolygon);
      setIsButtonDisabled(false);
    }
  };

  const loadLandOnMap = (polygonInfo) => {
    if (mapRef) {
      const L = require('leaflet');

      gridLayers.forEach(layer => mapRef.removeLayer(layer));
      setGridLayers([]);

      mapRef.eachLayer((layer) => {
        if (layer instanceof L.Polygon || layer instanceof L.Popup) {
          mapRef.removeLayer(layer);
        }
      });

      const polygon = L.polygon(polygonInfo, { color: 'blue' }).addTo(mapRef);
      const bounds = polygon.getBounds();
      mapRef.fitBounds(bounds);
      mapRef.setView(bounds.getCenter(), 13);

      setShowPopup({
        polygon: polygonInfo,
        center: bounds.getCenter()
      });

      drawGrid(polygonInfo);
      setShowSelectButton(true);
    }
  };

  const filteredLands = lands.filter(land => 
    land.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    land.id.toString().includes(searchQuery)
  );

  return (
    <div className="container">
      <Head>
        <title>LandWho Platform</title>
        <meta name="description" content="A platform to register and purchase land as NFTs" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="main-content">
        {!wallet ? (
          <button 
            className="connect-button" 
            onClick={handleConnectWallet} 
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px', // Positioned in the top-right corner
              padding: '5px 10px',
              fontSize: '14px'
            }}
          >
            Connect Wallet
          </button>
        ) : (
          <div className="content">
            <div className="map-container">
              <MyMap
                onPolygonCreated={registerLand}
                setMapRef={setMapRef}
                initialPolygons={lands.map((land) => land.polygon_info)}
                showPopup={showPopup}
              />
              {showSelectButton && (
                <>
                  <button 
                    onClick={selectAllGridCells} 
                    disabled={isButtonDisabled}
                    style={{
                      position: 'absolute',
                      top: '60px',
                      left: '10px',
                      zIndex: 1000,
                      backgroundColor: isButtonDisabled ? 'gray' : '#28a745',
                      color: 'white',
                      padding: '5px 10px',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: isButtonDisabled ? 'not-allowed' : 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    {isButtonDisabled ? "Select Grid Manually" : "Select All Grid Cells"}
                  </button>
                  <button 
                    onClick={resetMap} 
                    style={{
                      position: 'absolute',
                      top: '100px',
                      left: '10px',
                      zIndex: 1000,
                      backgroundColor: '#17a2b8',
                      color: 'white',
                      padding: '5px 10px',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Reset
                  </button>
                </>
              )}
            </div>
            <div className="land-list">
              <h2>Your Registered Lands:</h2>
              <input 
                type="text" 
                placeholder="Search lands..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                style={{ 
                  marginBottom: '10px', 
                  padding: '5px', 
                  width: 'calc(100% - 20px)', 
                  marginLeft: '10px',
                  marginRight: '10px',
                  boxSizing: 'border-box' 
                }}
              />
              {filteredLands.length > 0 ? (
                <ul>
                  {filteredLands.map((land) => (
                    <li key={land.id}>
                      <button 
                        onClick={() => loadLandOnMap(land.polygon_info)} 
                        style={{
                          backgroundColor: selectedPolygon === land.polygon_info ? '#28a745' : 'transparent',
                          color: selectedPolygon === land.polygon_info ? 'white' : 'black',
                          padding: '5px',
                          marginBottom: '5px',
                          borderRadius: '3px',
                          textAlign: 'left',
                          width: 'calc(100% - 20px)',
                          marginLeft: '10px',
                          marginRight: '10px',
                          cursor: 'pointer'
                        }}
                      >
                        {land.name}'s land with ID {land.id} - {new Date(land.created_at).toLocaleString()}
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

      {showModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000
          }}
        >
          <div 
            style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '10px',
              width: '300px',
              textAlign: 'center'
            }}
          >
            <h3>Enter Land Name</h3>
            <input 
              type="text" 
              value={landName} 
              onChange={(e) => setLandName(e.target.value)} 
              style={{
                width: '100%',
                padding: '10px',
                marginBottom: '10px',
                boxSizing: 'border-box'
              }}
            />
            <button 
              onClick={handleSaveLand} 
              style={{
                backgroundColor: '#28a745',
                color: 'white',
                padding: '10px 15px',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              Save
            </button>
            <button 
              onClick={() => setShowModal(false)} 
              style={{
                backgroundColor: '#dc3545',
                color: 'white',
                padding: '10px 15px',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
