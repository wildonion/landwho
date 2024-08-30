"use client";

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { connectWallet } from '../utils/chain';
import axios from 'axios';
import * as turf from '@turf/turf'; // Import Turf.js

const MyMap = dynamic(() => import('./components/MyMap'), { ssr: false });

export default function Home() {
  const [wallet, setWallet] = useState(null);
  const [lands, setLands] = useState([]);
  const [mapRef, setMapRef] = useState(null); // Reference to the map
  const [showPopup, setShowPopup] = useState(null); // To trigger showing the popup
  const [gridLayers, setGridLayers] = useState([]); // State to hold grid layers
  const [selectedPolygon, setSelectedPolygon] = useState(null); // Store the selected polygon for reference
  const [selectedLandId, setSelectedLandId] = useState(null); // Store the selected land ID
  const [showSelectButton, setShowSelectButton] = useState(false); // State to show/hide the button
  const [isButtonDisabled, setIsButtonDisabled] = useState(false); // State to manage button disabled state

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
    const name = prompt("Please enter a name for your land:"); // Prompt to get the land name
    if (!name) {
      alert("Land name is required.");
      return;
    }

    try {
      await axios.post('http://localhost:3001/registerLand', { wallet, polygonInfo, name });
      fetchLands(wallet); // Refresh lands after saving
    } catch (err) {
      console.error('Error registering land:', err);
      alert('Failed to save land. Please try again.');
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

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' };
    return new Date(dateString).toLocaleString(undefined, options);
  };

  // Helper function to close a polygon by ensuring the first and last points are the same
  const closePolygon = (coordinates) => {
    const firstPoint = coordinates[0];
    const lastPoint = coordinates[coordinates.length - 1];
    if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
      coordinates.push(firstPoint); // Close the polygon
    }
    return coordinates;
  };

  // Draw and select grids that are fully or partially inside the polygon
  const drawGrid = (polygon) => {
    if (!mapRef) {
      console.error("Map reference is not set");
      return;
    }

    setSelectedPolygon(polygon); // Save the selected polygon

    const closedPolygon = closePolygon([...polygon]);

    const polygonGeoJson = turf.polygon([closedPolygon.map(coord => [coord[1], coord[0]])]);

    // Get the bounding box of the polygon
    let bbox = turf.bbox(polygonGeoJson);

    // Expand the bounding box slightly to ensure the grid covers the entire polygon
    const expandBy = 0.01; // Adjust this value as needed
    bbox = [
      bbox[0] - expandBy, // Min Longitude - expand to the left
      bbox[1] - expandBy, // Min Latitude - expand downwards
      bbox[2] + expandBy, // Max Longitude - expand to the right
      bbox[3] + expandBy  // Max Latitude - expand upwards
    ];

    const cellSide = 100; // Adjust grid size (in meters)
    const grid = turf.squareGrid(bbox, cellSide, { units: 'meters' });

    const newGridLayers = grid.features.map((cell) => {
      const cellLayer = L.polygon(cell.geometry.coordinates[0].map(coord => [coord[1], coord[0]]), {
        color: 'red',       // Default grid color
        weight: 1,          // Line thickness
        fillOpacity: 0.2,   // Transparency
        fillColor: 'red'    // Default fill color
      }).addTo(mapRef);

      // Attach a click event listener to each grid cell for manual selection
      cellLayer.on('click', () => {
        // Convert Leaflet polygon coordinates to GeoJSON polygon
        let turf_polygon_cell = turf.polygon([closePolygon(cell.geometry.coordinates[0])]);
  
        // Check if the grid cell intersects with the polygon
        const intersects = turf.booleanIntersects(turf_polygon_cell, polygonGeoJson);

        if (intersects) {
          console.log("inside DrawGrid function, Cell intersects with the polygon.");
  
          // Get the intersection of the cell with the polygon
          const intersection = turf.intersect(turf.featureCollection([turf_polygon_cell, polygonGeoJson]));
  
          // Ensure the intersection is valid and has at least 4 positions
          if (intersection && intersection.geometry && intersection.geometry.type === 'Polygon') {
            const intersectionCoords = intersection.geometry.coordinates[0];
            if (intersectionCoords.length >= 4) {

              // Clear the original cell
              mapRef.removeLayer(cellLayer);
  
              // Add the intersection as a new layer
              const intersectionLayer = L.polygon(intersectionCoords.map(coord => [coord[1], coord[0]]), {
                color: 'yellow',
                weight: 1,
                fillOpacity: 0.5,
                fillColor: 'yellow'
              }).addTo(mapRef);
  
              // Remove the original cell from gridLayers and add the new intersection layer
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

    console.log("Grid cells generated:", newGridLayers.length);
    setGridLayers(newGridLayers); // Save grid layers to state to show on map
  };

  const selectAllGridCells = () => {
    if (!gridLayers || gridLayers.length === 0 || !selectedPolygon) return;
  
    // Ensure the selected polygon is closed
    const closedPolygon = [...selectedPolygon];
    if (
      closedPolygon[0][0] !== closedPolygon[closedPolygon.length - 1][0] ||
      closedPolygon[0][1] !== closedPolygon[closedPolygon.length - 1][1]
    ) {
      closedPolygon.push(closedPolygon[0]); // Close the polygon
    }
  
    const polygonGeoJson = turf.polygon([closedPolygon.map(coord => [coord[1], coord[0]])]);
  
    gridLayers.forEach(layer => {
      const coordinates = layer.getLatLngs()[0].map(coord => [coord.lng, coord.lat]);
  
      // Ensure the grid cell polygon is closed
      if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
          coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
        coordinates.push(coordinates[0]); // Close the polygon
      }
  
      const layerGeoJson = turf.polygon([coordinates]);
  
      // Check if the grid cell intersects with the polygon
      const intersects = turf.booleanIntersects(layerGeoJson, polygonGeoJson);
  
      if (intersects) {
        console.log("Cell intersects with the polygon.");
  
        // Get the intersection of the cell with the polygon
        const intersection = turf.intersect(turf.featureCollection([layerGeoJson, polygonGeoJson]));
  
        // Ensure the intersection is valid and has at least 4 positions
        if (intersection && intersection.geometry && intersection.geometry.type === 'Polygon') {
          const intersectionCoords = intersection.geometry.coordinates[0];
          if (intersectionCoords.length >= 4) {
  
            // Clear the original cell
            mapRef.removeLayer(layer);
  
            // Add the intersection as a new layer
            const intersectionLayer = L.polygon(intersectionCoords.map(coord => [coord[1], coord[0]]), {
              color: 'yellow',
              weight: 1,
              fillOpacity: 0.5,
              fillColor: 'yellow'
            }).addTo(mapRef);
  
            // Remove the original cell from gridLayers and add the new intersection layer
            setGridLayers((prevLayers) => prevLayers.filter(existingLayer => existingLayer !== layer).concat(intersectionLayer));
          } else {
            console.error("Invalid intersection polygon: less than 4 positions.");
          }
        } else {
          console.error("Intersection could not be calculated.");
        }
      }
    });

    // Disable the button, change its text and color
    setIsButtonDisabled(true);
  };

  const resetMap = () => {
    if (selectedPolygon) {
      loadLandOnMap(selectedPolygon, selectedLandId); // Use selectedLandId to ensure the button stays highlighted
      setIsButtonDisabled(false); // Re-enable the button
    }
  };
  
  const loadLandOnMap = (polygonInfo, landId) => {
    if (mapRef) {
      const L = require('leaflet');

      // Clear any existing grid layers
      gridLayers.forEach(layer => mapRef.removeLayer(layer));
      setGridLayers([]);

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

      // Draw the grid for the selected polygon
      drawGrid(polygonInfo);

      // Show the "Select Grid Cells" button
      setShowSelectButton(true);

      // Set the selected land ID
      setSelectedLandId(landId);
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
          <button 
            className="connect-button" 
            onClick={handleConnectWallet}
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              zIndex: 1000,
              backgroundColor: '#007bff',
              color: 'white',
              padding: '5px 10px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Connect Wallet
          </button>
        ) : (
          <div className="content">
            <div className="map-container">
              <MyMap
                onPolygonCreated={registerLand}
                setMapRef={setMapRef} // Ensure setMapRef is passed here
                initialPolygons={lands.map((land) => land.polygon_info)}
                showPopup={showPopup} // Pass the showPopup state to MyMap
              />
              {showSelectButton && (
                <>
                  <button 
                    onClick={selectAllGridCells} 
                    disabled={isButtonDisabled}
                    style={{
                      position: 'absolute',
                      top: '60px',  // Adjusted position to be below the "Save Polygon" button
                      left: '10px',
                      zIndex: 1000,
                      backgroundColor: isButtonDisabled ? 'gray' : '#28a745',  // Gray when disabled, green otherwise
                      color: 'white',
                      padding: '5px 10px',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: isButtonDisabled ? 'not-allowed' : 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    {isButtonDisabled ? "Select All Grid Cells: Off" : "Select All Grid Cells"}
                  </button>
                  <button 
                    onClick={resetMap} 
                    style={{
                      position: 'absolute',
                      top: '100px',  // Positioned below the "Select All Grid Cells" button
                      left: '10px',
                      zIndex: 1000,
                      backgroundColor: '#17a2b8',  // Blue color for the reset button
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
              {lands.length > 0 ? (
                <ul>
                  {lands.map((land) => (
                    <li key={land.id}>
                      <button 
                        onClick={() => loadLandOnMap(land.polygon_info, land.id)}
                        style={{
                          backgroundColor: land.id === selectedLandId ? '#28a745' : '',  // Green if selected
                          color: land.id === selectedLandId ? 'white' : 'black',  // White text if selected
                          padding: '5px 10px',
                          border: '1px solid #ccc',
                          borderRadius: '5px',
                          marginBottom: '5px',
                          cursor: 'pointer'
                        }}
                      >
                        {land.name}&#39;s Land with ID: {land.id} registered at:
                        <br />
                        <small>{formatDate(land.created_at)}</small>
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
