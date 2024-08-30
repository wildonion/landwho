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

  const drawGrid1 = (polygon) => {
    if (!mapRef) {
      console.error("Map reference is not set");
      return;
    }
  
    const closedPolygon = [...polygon];
    if (
      closedPolygon[0][0] !== closedPolygon[closedPolygon.length - 1][0] ||
      closedPolygon[0][1] !== closedPolygon[closedPolygon.length - 1][1]
    ) {
      closedPolygon.push(closedPolygon[0]); // Close the polygon
    }
  
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
  
      // Attach a click event listener to each grid cell
      cellLayer.on('click', () => {
        // Check if the grid cell intersects with the polygon
        const intersects = turf.booleanIntersects(cell, polygonGeoJson);
  
        if (intersects) {
          // Change the cell color to yellow
          cellLayer.setStyle({
            color: 'yellow',
            fillColor: 'yellow'
          }); 
  
          // Log the cell's latitude and longitude
          const latLngs = cellLayer.getLatLngs()[0];
          latLngs.forEach(latLng => {
            console.log(`Latitude: ${latLng.lat}, Longitude: ${latLng.lng}`);
          });
        } else {
          console.log('Cell does not intersect with the polygon.');
        }
      });
  
      return cellLayer;
    });
  
    console.log("Grid cells generated:", newGridLayers.length);
    setGridLayers(newGridLayers); // Save grid layers to state to show on map
  };


  // draw and select grids that are fully or partially inside the polygon
  const drawGrid = (polygon) => {
    if (!mapRef) {
      console.error("Map reference is not set");
      return;
    }
  
    const closedPolygon = [...polygon];
    if (
      closedPolygon[0][0] !== closedPolygon[closedPolygon.length - 1][0] ||
      closedPolygon[0][1] !== closedPolygon[closedPolygon.length - 1][1]
    ) {
      closedPolygon.push(closedPolygon[0]); // Close the polygon
    }
  
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
  
      // when a grid is select it checks the intersection with polygon and change the color
      // Attach a click event listener to each grid cell
      cellLayer.on('click', () => {

      console.log("cell", cell);

        // Convert Leaflet polygon coordinates to GeoJSON polygon
        let turf_polygon_cell = turf.polygon([cell.geometry.coordinates[0]]);
  
        // Check if the grid cell intersects with the polygon
        const intersects = turf.booleanIntersects(turf_polygon_cell, polygonGeoJson);

        if (intersects) {
          console.log("Cell intersects with the polygon.");
  
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
  
              // Log the intersection's latitude and longitude
              const latLngs = intersectionLayer.getLatLngs()[0];
              latLngs.forEach(latLng => {
                console.log(`Latitude: ${latLng.lat}, Longitude: ${latLng.lng}`);
              });
  
              // Replace the original cell with the intersection
              const newLayers = gridLayers.map(layer => layer === cellLayer ? intersectionLayer : layer);
              setGridLayers(newLayers);
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
  
  

  const loadLandOnMap = (polygonInfo) => {
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
                setMapRef={setMapRef} // Ensure setMapRef is passed here
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
