"use client";

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import axios from 'axios';
import { connectWallet } from '../utils/chain';
import * as turf from '@turf/turf';
import { v4 as uuidv4 } from 'uuid';
import L from 'leaflet';
import 'leaflet-draw/dist/leaflet.draw.css'; // Import leaflet draw styles

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
  const [showModal, setShowModal] = useState(false);
  const [showParcelModal, setShowParcelModal] = useState(false);
  const [landName, setLandName] = useState('');
  const [landId, setLandId] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [landGridSelected, setLandGridSelected] = useState({});
  const [selectedGrids, setSelectedGrids] = useState([]);
  const [parcelPrice, setParcelPrice] = useState('');
  const [parcelRoyalty, setParcelRoyalty] = useState('');
  const [parcelUUID, setParcelUUID] = useState('');
  const [parcelLatLngs, setParcelLatLngs] = useState([]);
  const [parcelInfo, setParcelInfo] = useState({});
  const [selectedLand, setSelectedLand] = useState(null);  // Store the full land object
  const [isLoading, setIsLoading] = useState(false);
  const [mintSuccessMessage, setMintSuccessMessage] = useState('');
  const [mintedSuccessfully, setMintedSuccessfully] = useState(false);
  const [txHash, setTxHash] = useState(''); // Initialize txHash in state

  
  useEffect(() => {
    if (wallet) {
      fetchLands(wallet);
    }
  }, [wallet]);

  useEffect(() => {
    if (lands.length > 0) {
      loadLandOnMap(lands[0]);
    }
  }, [lands]);

  useEffect(() => {
    if (parcelInfo.parcel_uuid) {
      console.log("Parcel info ready for on-chain:", parcelInfo);
    }
  }, [parcelInfo]);

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
      setLandName('');
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

  const closePolygon = (coordinates) => {
    const firstPoint = coordinates[0];
    const lastPoint = coordinates[coordinates.length - 1];
    if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
      coordinates.push(firstPoint);
    }
    return coordinates;
  };

  const drawGrid = (polygon, mintedParcels = []) => {
    if (!mapRef) {
      console.error("Map reference is not set");
      return;
    }
  
    setSelectedPolygon(polygon);
    const closedPolygon = closePolygon([...polygon]);
    const polygonGeoJson = turf.polygon([closedPolygon.map(coord => [coord[1], coord[0]])]);
  
    let bbox = turf.bbox(polygonGeoJson);
    const expandBy = 0.00005;
    bbox = [
      bbox[0] - expandBy,
      bbox[1] - expandBy,
      bbox[2] + expandBy,
      bbox[3] + expandBy,
    ];
  
    const cellSide = 10; // 100 meters each parcel
    const grid = turf.squareGrid(bbox, cellSide, { units: 'meters' });
  
    const newGridLayers = grid.features.map((cell) => {
      const cellCoords = closePolygon(cell.geometry.coordinates[0]);
      const turfCell = turf.polygon([cellCoords]);
      const intersects = turf.booleanIntersects(turfCell, polygonGeoJson);
  
      // Check if the parcel is minted using intersection instead of exact match
      const matchingMintedParcel = mintedParcels.find((parcel) => {
        const parcelTurf = turf.polygon([parcel.parcel_points]);
        // Use intersection to match parcels, ensuring partial matches are also considered
        const intersection = turf.intersect(turf.featureCollection([turfCell, parcelTurf]));
        return intersection !== null && turf.booleanIntersects(turfCell, parcelTurf);
      });
  
      if (matchingMintedParcel && intersects) {
        // This cell is minted, color it red
        const intersection = turf.intersect(turf.featureCollection([turfCell, polygonGeoJson]));
        if (intersection && intersection.geometry && intersection.geometry.type === "Polygon") {
          const intersectionCoords = intersection.geometry.coordinates[0];
          if (intersectionCoords.length >= 4) {
            const mintedLayer = L.polygon(intersectionCoords.map((coord) => [coord[1], coord[0]]), {
              color: "red",
              weight: 1,
              fillOpacity: 0.5,
              fillColor: "red",
            }).addTo(mapRef);
  
            // Attach the popup to the red minted parcel
            mintedLayer.on("click", () => {
              const popupContent = `
                <div style="text-align: left;">
                  <strong>Parcel UUID:</strong> ${matchingMintedParcel.parcel_uuid}<br>
                  <strong>Owner Wallet:</strong> ${matchingMintedParcel.parcel_owner_wallet}<br>
                  <strong>Minted At:</strong> ${new Date(matchingMintedParcel.created_at).toLocaleString()}<br>
                  <strong>Royalty:</strong> ${matchingMintedParcel.parcel_royalty}%<br>
                  <a href="https://amoy.polygonscan.com/tx/${matchingMintedParcel.tx_hash}" target="_blank" rel="noopener noreferrer">
                    <button style="background-color: #800080; color: white; padding: 5px 10px; border: none; border-radius: 5px; cursor: pointer;">
                      See Transaction
                    </button>
                  </a>
                </div>
              `;
              const popup = L.popup()
                .setLatLng(mintedLayer.getBounds().getCenter())
                .setContent(popupContent)
                .openOn(mapRef);
            });
  
            return mintedLayer;
          }
        }
      } else if (intersects) {
        // Non-minted parcel, color it green
        const cellLayer = L.polygon(cellCoords.map((coord) => [coord[1], coord[0]]), {
          color: "green",
          weight: 1,
          fillOpacity: 0.2,
          fillColor: "green",
        }).addTo(mapRef);
  
        const attachPopup = (layer, coords) => {
          if (layer) {
            layer.on("mouseover", (e) => {
              const popupContent =
                '<button id="nft-parcel-button" style="background-color: #ff7f00; color: white; padding: 5px 10px; border: none; border-radius: 5px; cursor: pointer;">NFT Parcel</button>';
              const popup = L.popup().setLatLng(e.latlng).setContent(popupContent).openOn(mapRef);
  
              // Attach the event listener directly to the popup's button
              popup.getElement().querySelector("#nft-parcel-button").addEventListener("click", () => {
                handleNftParcelClick(coords);
                mapRef.closePopup();
              });
            });
          }
        };
  
        attachPopup(cellLayer, cellCoords);
  
        cellLayer.on("click", () => {
          handleCellSelection(cellLayer, cellCoords, polygonGeoJson, attachPopup);
        });
  
        return cellLayer;
      }
  
      // Return null for cells that don't intersect or are already minted
      return null;
    });
  
    // Filter out any null values before setting grid layers
    setGridLayers(newGridLayers.filter((layer) => layer !== null));
  };
  

  const fetchMintedParcels = async (landId) => {
    try {
      const response = await axios.get(`http://localhost:3001/mintedParcels/${landId}`);
      console.log(response.data)
      return response.data;
    } catch (err) {
      console.error('Error fetching minted parcels:', err);
      return [];
    }
  };

  const handleNftParcelClick = (coordinates) => {
    const newUUID = uuidv4();
    setParcelUUID(newUUID);
    setParcelLatLngs(coordinates);
    setSelectedGrids((prev) => [...prev, { uuid: newUUID, latLngs: coordinates }]);
    setShowParcelModal(true);
  };

  const handleCellSelection = (cellLayer, coordinates, polygonGeoJson, attachPopup) => {
    const turfCell = turf.polygon([closePolygon(coordinates)]);
    const intersects = turf.booleanIntersects(turfCell, polygonGeoJson);
  
    if (intersects) {
      const intersection = turf.intersect(turf.featureCollection([turfCell, polygonGeoJson]));
      if (intersection && intersection.geometry && intersection.geometry.type === 'Polygon') {
        const intersectionCoords = intersection.geometry.coordinates[0];
        if (intersectionCoords.length >= 4) {
          if (cellLayer) {
            mapRef.removeLayer(cellLayer);
          }
          
          const intersectionLayer = L.polygon(intersectionCoords.map(coord => [coord[1], coord[0]]), {
            color: 'yellow',
            weight: 1,
            fillOpacity: 0.5,
            fillColor: 'yellow'
          }).addTo(mapRef);
  
          setGridLayers((prevLayers) => prevLayers.filter(layer => layer !== cellLayer).concat(intersectionLayer));
  
          // Attach the popup again to the selected yellow cell
          if (intersectionLayer) {
            attachPopup(intersectionLayer, intersectionCoords);
          }
        } else {
          console.error("Invalid intersection polygon: less than 4 positions.");
        }
      } else {
        console.error("Intersection could not be calculated.");
      }
    } else {
      console.log('Cell does not intersect with the polygon.');
    }
  };
  

  const selectAllGridCells = () => {
    if (!gridLayers || gridLayers.length === 0 || !selectedPolygon) {
        console.error('Missing grid layers or selected polygon coordinates');
        return;
    }

    const landId = lands.find(land => land.polygon_info === selectedPolygon)?.id;

    const closedPolygon = [...selectedPolygon];
    if (closedPolygon[0][0] !== closedPolygon[closedPolygon.length - 1][0] ||
        closedPolygon[0][1] !== closedPolygon[closedPolygon.length - 1][1]) {
        closedPolygon.push(closedPolygon[0]);
    }

    const polygonGeoJson = turf.polygon([closedPolygon.map(coord => [coord[1], coord[0]])]);

    gridLayers.forEach(layerGroup => {
        if (layerGroup instanceof L.LayerGroup) {
            layerGroup.eachLayer(layer => {
                if (layer instanceof L.Polygon) {
                    mapRef.removeLayer(layer);
                }
            });
        } else {
            mapRef.removeLayer(layerGroup);
        }
    });

    gridLayers.forEach(layerGroup => {
        if (layerGroup instanceof L.LayerGroup) {
            layerGroup.eachLayer(layer => {
                processLayer(layer, polygonGeoJson);
            });
        } else {
            processLayer(layerGroup, polygonGeoJson);
        }
    });

    setIsButtonDisabled(true);

    if (landId) {
        setLandGridSelected(prevState => ({
            ...prevState,
            [landId]: true
        }));
    }
  };

  const processLayer = (layer, polygonGeoJson) => {
    if (layer instanceof L.Polygon) {
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
            const intersectionLayer = L.polygon(intersectionCoords.map(coord => [coord[1], coord[0]]), {
              color: 'yellow',
              weight: 1,
              fillOpacity: 0.5,
              fillColor: 'yellow'
            }).addTo(mapRef);
  
            const newUUID = uuidv4();
            setParcelUUID(newUUID);
            setParcelLatLngs(intersectionCoords);
  
            setSelectedGrids((prev) => [...prev, { uuid: newUUID, latLngs: intersectionCoords }]);
  
            setGridLayers((prevLayers) => prevLayers.concat(intersectionLayer));
  
            // Attach the hover event to the yellow selected cells
            if (intersectionLayer) {
              intersectionLayer.on('mouseover', (e) => {
                const popup = L.popup()
                  .setLatLng(e.latlng)
                  .setContent('<button id="nft-parcel-button" style="background-color: #ff7f00; color: white; padding: 5px 10px; border: none; border-radius: 5px; cursor: pointer;">NFT Parcel</button>')
                  .openOn(mapRef);
  
                popup.getElement().querySelector("#nft-parcel-button").addEventListener("click", () => {
                  handleNftParcelClick(intersectionCoords);
                  mapRef.closePopup();
                });
              });
            }
          }
        }
      }
    }
  };
  

  const resetMap = () => {
    if (selectedLand) {  // Use the full land object
        loadLandOnMap(selectedLand);
        setIsButtonDisabled(false);
        resetParcelState();
    }
  };

  const loadLandOnMap = async (land) => {
    if (mapRef) {
      const L = require('leaflet');
  
      // Clear the existing grid layers from the map
      gridLayers.forEach(layer => mapRef.removeLayer(layer));
      setGridLayers([]);
  
      // Clear any existing polygons and popups from the map
      mapRef.eachLayer((layer) => {
        if (layer instanceof L.Polygon || layer instanceof L.Popup) {
          mapRef.removeLayer(layer);
        }
      });
  
      if (land.polygon_info && Array.isArray(land.polygon_info) && land.polygon_info.length > 0) {
        const polygon = L.polygon(land.polygon_info, { color: 'blue' }).addTo(mapRef);
        const bounds = polygon.getBounds();
        mapRef.fitBounds(bounds);
        mapRef.setView(bounds.getCenter(), 13);
  
        setLandName(land.name);
        setLandId(land.id);
        setSelectedLand(land);
        setSelectedPolygon({ coordinates: land.polygon_info, landId: land.id });
  
        setShowPopup({
          polygon: land.polygon_info,
          center: bounds.getCenter()
        });
  
        // Fetch minted parcels for the selected land
        const mintedParcels = await fetchMintedParcels(land.id);
  
        // Draw the grid and highlight minted parcels
        drawGrid(land.polygon_info, mintedParcels);
  
        setIsButtonDisabled(false);
        resetParcelState();
        setShowSelectButton(true);
      } else {
        console.error("Invalid polygon information provided for the selected land:", land.polygon_info);
      }
    }
  };
  

  const resetParcelState = () => {
    setParcelPrice('');
    setParcelRoyalty('');
    setParcelUUID('');
    setParcelLatLngs([]);
    setSelectedGrids([]);
    setShowParcelModal(false);
  };


  const handleSaveParcel = async () => {
    // Create the new parcel info
    const newParcelInfo = {
      parcel_uuid: parcelUUID,
      parcel_price: parcelPrice,
      parcel_royalty: parcelRoyalty,
      parcel_points: parcelLatLngs,
      parcel_land_id: landId,
      parcel_land_name: landName,
      parcel_owner_wallet: wallet,
    };
  
    // Update the state with the new parcel info
    setParcelInfo(newParcelInfo);
  
    // Now send the newParcelInfo to the backend
    await sendParcelInfoToBackend(newParcelInfo);
  };
  
  const sendParcelInfoToBackend = async (parcelInfo) => {
    setIsLoading(true); // Start loading
    try {
        const response = await axios.post('http://localhost:3001/mintParcel', parcelInfo);
        if (response.status === 200) {
            const txHash = response.data.txHash;
            console.log(response.data);
            setMintSuccessMessage('Parcel was minted successfully!');
            setTxHash(txHash); // Save txHash in state
            setMintedSuccessfully(true); // Update state indicating mint was successful
        } else {
            console.error('Failed to mint parcel.');
        }
    } catch (err) {
      let msg = err + ', maybe is already minted!';
        alert(msg);
        console.error('Error minting parcel:', err);
    } finally {
        setIsLoading(false); // Stop loading
    }
};


  
  // Handle Delete Land
  const handleDeleteLand = async () => {
    const confirmation = window.confirm("Are you sure you want to delete this land?");
    if (confirmation) {
      try {
        await axios.delete(`http://localhost:3001/lands/${landId}`);
        fetchLands(wallet);
        resetMap();
      } catch (err) {
        console.error('Error deleting land:', err);
      }
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
              right: '10px',
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
                    {isButtonDisabled ? "NFT Land" : "NFT Land"}
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
                    Reload Land
                  </button>
                  <button 
                    onClick={handleDeleteLand} 
                    style={{
                      position: 'absolute',
                      top: '180px',
                      left: '10px',
                      zIndex: 1000,
                      backgroundColor: '#dc3545',
                      color: 'white',
                      padding: '5px 10px',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Delete Land
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
                      onClick={() => loadLandOnMap(land)}  // Pass the full land object here
                      style={{
                        backgroundColor: landId === land.id ? '#28a745' : 'transparent',  // Green background for selected land
                        color: landId === land.id ? 'white' : 'black',  // White text for selected land
                        padding: '5px',
                        marginBottom: '5px',
                        borderRadius: '3px',
                        textAlign: 'left',
                        width: 'calc(100% - 20px)',
                        marginLeft: '10px',
                        marginRight: '10px',
                        cursor: 'pointer',
                        border: '1px solid',  // Add a border to emphasize selection
                        borderColor: landId === land.id ? '#28a745' : 'transparent'  // Match the border color with the background when selected
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

      {showParcelModal && (
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
              zIndex: 2000,
              padding: '10px'
            }}
          >
            <div 
              style={{
                backgroundColor: 'white',
                padding: '20px',
                borderRadius: '10px',
                width: '90%',
                maxWidth: '500px',
                textAlign: 'center',
                boxSizing: 'border-box',
              }}
            >
              <h3>Parcel Information</h3>
              <p>UUID: {parcelUUID}</p>
              <p>Lat/Lng: {JSON.stringify(parcelLatLngs)}</p>
              <p>Land ID: {landId}</p>
              <p>Land Name: {landName}</p>
              <p>Owner Wallet: {wallet}</p>
              <input 
                type="text" 
                placeholder="Enter price" 
                value={parcelPrice} 
                onChange={(e) => setParcelPrice(e.target.value)} 
                style={{
                  width: '100%',
                  padding: '10px',
                  marginBottom: '10px',
                  boxSizing: 'border-box'
                }}
                disabled={mintedSuccessfully || isLoading}  // Disable input after minting or during loading
              />
              <input 
                type="text" 
                placeholder="Enter Parcel Royalty" 
                value={parcelRoyalty} 
                onChange={(e) => setParcelRoyalty(e.target.value)} 
                style={{
                  width: '100%',
                  padding: '10px',
                  marginBottom: '10px',
                  boxSizing: 'border-box'
                }}
                disabled={mintedSuccessfully || isLoading}  // Disable input after minting or during loading
              />
              
              {mintSuccessMessage && (
                <p style={{ color: 'green', fontWeight: 'bold', marginTop: '10px' }}>
                  {mintSuccessMessage}
                </p>
              )}

              {/* Conditionally show transaction hash button */}
              {mintedSuccessfully && txHash && (
                <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                  <a 
                    href={`https://amoy.polygonscan.com/tx/${txHash}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    style={{ textDecoration: 'none' }}
                  >
                    <button 
                      style={{
                        backgroundColor: '#800080', // Purple color
                        color: 'white',
                        padding: '10px 15px',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                      }}
                    >
                      See Transaction
                    </button>
                  </a>

                  <button 
                    onClick={async () => {
                      setShowParcelModal(false);
                      setMintSuccessMessage('');  // Reset success message
                      setMintedSuccessfully(false);  // Reset state
                      // Reload the land on the map after closing the modal
                      await loadLandOnMap(selectedLand); // This will reload the land state when the modal is closed
                    }} 
                    style={{
                      backgroundColor: '#28a745',
                      color: 'white',
                      padding: '10px 15px',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                    }}
                  >
                    Close
                  </button>
                </div>
              )}

              {/* Conditionally render buttons */}
              {!mintedSuccessfully ? (
                <>
                  <button 
                    onClick={handleSaveParcel} 
                    disabled={isLoading}  // Disable button during loading
                    style={{
                      backgroundColor: isLoading ? 'gray' : '#28a745',
                      color: 'white',
                      padding: '10px 15px',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      marginRight: '10px',
                      width: '45%',
                    }}
                  >
                    {isLoading ? 'Minting...' : 'Mint'}
                  </button>
                  <button 
                    onClick={() => {
                      if (!isLoading) {
                        setShowParcelModal(false);
                        setMintSuccessMessage(''); // Reset success message
                        setMintedSuccessfully(false);  // Reset state
                      }
                    }} 
                    disabled={isLoading}  // Disable Cancel button during loading
                    style={{
                      backgroundColor: isLoading ? 'gray' : '#dc3545',
                      color: 'white',
                      padding: '10px 15px',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      width: '45%',
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : null}
            </div>
          </div>
      )}
    </div>
  );
}
