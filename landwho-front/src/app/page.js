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
import { ToastContainer, toast } from 'react-toastify';  // Import toast for notifications
import 'react-toastify/dist/ReactToastify.css';  // Import toast styles



const MyMap = dynamic(() => import('./components/MyMap'), { ssr: false });

export default function Home() {
  const [wallet, setWallet] = useState(null);
  const [lands, setLands] = useState([]);
  const [ownerInfo, setOwnerInfo] = useState([]);
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
  const [landOwnerId, setLandOwnerId] = useState(0);
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
  const [priceError, setPriceError] = useState('');
  const [royaltyError, setRoyaltyError] = useState('');
  const [notifTimer, setNotifTimer] = useState(null);
  const [showMintedParcelsModal, setShowMintedParcelsModal] = useState(false); // State to control modal visibility
  const [mintedParcels, setMintedParcels] = useState([]); // State to store the minted parcels
  const [searchMintedQuery, setSearchMintedQuery] = useState('');


  const filteredMintedParcels = mintedParcels.filter((parcel) => {
    return (
      parcel.parcel_uuid.toLowerCase().includes(searchMintedQuery.toLowerCase()) ||
      parcel.parcel_land_name.toLowerCase().includes(searchMintedQuery.toLowerCase())
    );
  });

  // Function to open the modal and fetch the parcels by wallet owner
  const handleShowMintedParcels = async () => {
    try {
      const response = await axios.get(`http://localhost:3001/mintedParcelsByOwner/${wallet}`);
      setMintedParcels(response.data);
      setShowMintedParcelsModal(true);
    } catch (err) {
      console.error('Error fetching minted parcels:', err);
    }
  };


  // Close the modal
  const handleCloseMintedParcels = () => {
    setShowMintedParcelsModal(false);
  };


  const closeModal = () => {
    setShowParcelModal(false); // Hide the modal
    setMintSuccessMessage(''); // Reset success message
    setMintedSuccessfully(false); // Reset minting state
    resetParcelState(); // Reset input fields and parcel state
  };


  const showParcelOnMap = (parcelLatLngs) => {
    if (!mapRef) return;
  
    // First, remove any existing markers or polygons (optional cleanup)
    mapRef.eachLayer((layer) => {
      if (layer instanceof L.Polygon) {
        mapRef.removeLayer(layer);
      }
    });
  
    // Convert [lng, lat] to [lat, lng] if needed
    const correctedLatLngs = parcelLatLngs.map((coord) => [coord[1], coord[0]]);
  
    // Add a marker or polygon for the parcel using the correct [lat, lng] format
    const parcelLayer = L.polygon(correctedLatLngs, {
      color: 'purple',
      weight: 2,
      fillOpacity: 0.5,
    }).addTo(mapRef);
  
    // Fit the map bounds to the parcel
    mapRef.fitBounds(parcelLayer.getBounds());
  };
  

  // Set up polling every 5 seconds
  useEffect(() => {
    if (wallet) {
      if (notifTimer) clearInterval(notifTimer);  // Clear any previous interval
      const interval = setInterval(() => {
        console.log("calling fetch notifs");
        fetchNotifications(wallet)
      }, 5000);
      setNotifTimer(interval);
    }
    return () => clearInterval(notifTimer); // Clean up on unmount
  }, [wallet, mapRef]);

  // Fetch notifications and show them as toast messages
  const fetchNotifications = async (wallet) => {
    console.log("inside fetch notifs");
    try {
      console.log("try to fetch to notifs");
      const response = await axios.get(`http://localhost:3001/notifs/${wallet}`);
      const notifications = response.data;
      console.log(notifications);
  
      notifications.forEach((notif) => {
        const {
          parcel_uuid,
          parcel_price,
          parcel_royalty,
          parcel_land_name,
          parcel_land_id,
          parcel_owner_wallet,
          parcel_points,
          tx_hash,
        } = notif.notif_data; // Extract data from notification object
  
        // Display toast notification with properly structured content
        toast.info(
          <>
            <div><strong>Parcel UUID:</strong> {parcel_uuid}</div>
            <div><strong>Price:</strong> {parcel_price} MATIC</div>
            <div><strong>Royalty:</strong> {parcel_royalty / 100}%</div>
            <div><strong>Land Name:</strong> {parcel_land_name}</div>
            <div><strong>Land Id:</strong> {parcel_land_id}</div>
            <div><strong>Owner Wallet:</strong> {parcel_owner_wallet}</div>
            <a href={`https://amoy.polygonscan.com/tx/${tx_hash}`} target="_blank" rel="noopener noreferrer">
              <button style={{ backgroundColor: '#800080', color: 'white', padding: '5px 10px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                See Transaction
              </button>
            </a>
            <button
              onClick={() => {
                if (mapRef) {
                  showParcelOnMap(parcel_points);  // Call showParcelOnMap when the map is ready
                } else {
                  console.error("Map is not initialized.");
                }
              }}
              style={{ backgroundColor: '#28a745', color: 'white', padding: '5px 10px', marginLeft: '10px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
            >
              Show Parcel
            </button>
          </>,
          { autoClose: false }  // Disable auto-close so the user can see the notification
        );
        markNotificationAsSeen(notif.id)
      });
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const markNotificationAsSeen = async (notifId) => {
    try {
      await axios.post('http://localhost:3001/notifs/seen', { id: notifId }); // send id in the body
    } catch (err) {
      console.error('Error marking notification as seen:', err);
    }
  };
  

  useEffect(() => {
    if (showPopup) {
      const { totalParcels, mintedParcelsCount, remainingParcels, center } = showPopup;

      // Create popup content with total, minted, and remaining parcels info
      const popupContent = `
        <div style="text-align: left;">
          <strong>Total Parcels:</strong> ${totalParcels}<br>
          <strong>Minted Parcels:</strong> ${mintedParcelsCount}<br>
          <strong>Remaining Parcels:</strong> ${remainingParcels}<br>
        </div>
      `;

      const popup = L.popup()
        .setLatLng(center)
        .setContent(popupContent)
        .openOn(mapRef);
    }
  }, [showPopup]);  // Trigger this when `showPopup` is updated
  
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
      const response = await axios.get(`http://localhost:3001/lands`);
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
        const response = await axios.post('http://localhost:3001/registerOwner', { wallet: userWallet });
        setOwnerInfo(response.data.owner)
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
  
    const cellSide = 10; // 10 meters each parcel
    const grid = turf.squareGrid(bbox, cellSide, { units: 'meters' });
  
    const newGridLayers = grid.features.map((cell) => {
      const cellCoords = closePolygon(cell.geometry.coordinates[0]);
      const turfCell = turf.polygon([cellCoords]);
      const intersects = turf.booleanIntersects(turfCell, polygonGeoJson);
  
      // Check if the parcel is minted using intersection instead of exact match
      const matchingMintedParcel = mintedParcels.find((parcel) => {
        const parcelTurf = turf.polygon([parcel.parcel_points]);
        const intersection = turf.intersect(turf.featureCollection([turfCell, parcelTurf]));
        return intersection !== null && turf.booleanIntersects(turfCell, parcelTurf);
      });
  
      if (matchingMintedParcel && intersects) {
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
  
            mintedLayer.on("click", () => {
              const popupContent = `
                <div style="text-align: left; word-wrap: break-word;">
                  <strong>Parcel UUID:</strong> ${matchingMintedParcel.parcel_uuid}<br>
                  <strong>Parcel Points:</strong><br>
                  <div style="max-height: 100px; overflow-y: auto; padding-left: 10px;">
                    ${matchingMintedParcel.parcel_points
                      .map((point, index) => `(${point[0].toFixed(6)}, ${point[1].toFixed(6)})`)
                      .join('<br>')}
                  </div>
                  <strong>Owner Wallet:</strong> ${matchingMintedParcel.parcel_owner_wallet}<br>
                  <strong>Minted At:</strong> ${new Date(matchingMintedParcel.created_at).toLocaleString()}<br>
                  <strong>Minted Price:</strong> ${matchingMintedParcel.parcel_price} MATIC<br>
                  <strong>Royalty:</strong> ${matchingMintedParcel.parcel_royalty / 100}%<br>
                  <div style="display: flex; gap: 10px; margin-top: 10px;"> <!-- Added gap between buttons -->
                    <a href="https://amoy.polygonscan.com/tx/${matchingMintedParcel.tx_hash}" target="_blank" rel="noopener noreferrer">
                      <button style="background-color: #800080; color: white; padding: 5px 10px; border: none; border-radius: 5px; cursor: pointer;">
                        See Transaction
                      </button>
                    </a>
                    <a href="${matchingMintedParcel.ipfs_hash}" target="_blank" rel="noopener noreferrer">
                      <button style="background-color: #28a745; color: white; padding: 5px 10px; border: none; border-radius: 5px; cursor: pointer;">
                        Parcel Data
                      </button>
                    </a>
                  </div>
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
  
      return null;
    });
  
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
      const L = require("leaflet");
  
      gridLayers.forEach((layer) => mapRef.removeLayer(layer));
      setGridLayers([]);
  
      mapRef.eachLayer((layer) => {
        if (layer instanceof L.Polygon || layer instanceof L.Popup) {
          mapRef.removeLayer(layer);
        }
      });
  
      if (land.polygon_info && Array.isArray(land.polygon_info) && land.polygon_info.length > 0) {
        const polygon = L.polygon(land.polygon_info, { color: "blue" }).addTo(mapRef);
        const bounds = polygon.getBounds();
        mapRef.fitBounds(bounds);
        mapRef.setView(bounds.getCenter(), 13);
        
        setLandName(land.name);
        setLandId(land.id);
        setLandOwnerId(land.owner_id);
        setSelectedLand(land);
        setSelectedPolygon({ coordinates: land.polygon_info, landId: land.id });

        // Fetch minted parcels for the selected land
        const mintedParcels = await fetchMintedParcels(land.id);

        // Draw the grid and highlight minted parcels
        drawGrid(land.polygon_info, mintedParcels);

        // Calculate total parcels, minted parcels, and remaining parcels
        const totalParcels = gridLayers.length;
        const mintedParcelsCount = mintedParcels.length;
        const remainingParcels = totalParcels - mintedParcelsCount;

        // Show popup with the summary information
        setShowPopup({
          polygon: land.polygon_info,
          center: bounds.getCenter(),
          totalParcels,
          mintedParcelsCount,
          remainingParcels,
        });

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

  const validateInputs = (price, royalty) => {
    let isValid = true;

    if (!price || isNaN(price) || Number(price) <= 0) {
      setPriceError("Please enter a valid positive price.");
      isValid = false;
    } else {
      setPriceError('');
    }

    if (!royalty || isNaN(royalty) || Number(royalty) < 0 || Number(royalty) > 100) {
      setRoyaltyError("Please enter a valid royalty percentage between 0 and 100.");
      isValid = false;
    } else {
      setRoyaltyError('');
    }

    return isValid;
  };

  const handleSaveParcel = async () => {
    const royaltyBasisPoints = Math.floor(parcelRoyalty * 100); 

    if (!validateInputs(parcelPrice, parcelRoyalty)) {
      return;
    }

    const newParcelInfo = {
      parcel_uuid: parcelUUID,
      parcel_price: parcelPrice,
      parcel_royalty: royaltyBasisPoints,
      parcel_points: parcelLatLngs,
      parcel_land_id: landId,
      parcel_land_name: landName,
      parcel_owner_wallet: wallet,
    };
  
    setParcelInfo(newParcelInfo);
  
    await sendParcelInfoToBackend(newParcelInfo);
  };
  
  const sendParcelInfoToBackend = async (parcelInfo) => {
    setIsLoading(true);

    try {
      const response = await axios.post('http://localhost:3001/mintParcel', parcelInfo);

      if (response.status === 200) {
        setMintSuccessMessage('Parcel is being minted, we will notify you once the process is complete.');
        setMintedSuccessfully(true);
        setTxHash(response.data.txHash);

        // Disable buttons and show the minting message
        setMintSuccessMessage('Parcel is being minted, we will notify you.');
      } else {
        console.error('Failed to mint parcel.');
      }
    } catch (err) {
      let msg = err + ', maybe it is already (being) minted by another one!';
      alert(msg);
      console.error('Error minting parcel:', err);
    } finally {
      setIsLoading(false);
    }
  };

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
                  {landOwnerId === ownerInfo.id && (
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
                    {isButtonDisabled ? "NFT Land: Off" : "NFT Land"}
                  </button>
                  )}
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
                  {landOwnerId === ownerInfo.id && (
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
                        fontSize: '12px',
                      }}
                    >
                      Delete Land
                    </button>
                  )}

                    <button
                      onClick={handleShowMintedParcels}
                      style={{
                        position: 'absolute',
                        top: '220px',
                        left: '10px',
                        zIndex: 1000,
                        backgroundColor: '#007bff',
                        color: 'white',
                        padding: '5px 10px',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      Show Minted Parcels
                    </button>

                </>
              )}
            </div>
            <div className="land-list">
              <h2>Registered Lands:</h2>
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
                        onClick={() => loadLandOnMap(land)}
                        style={{
                          backgroundColor: landId === land.id ? '#28a745' : 'transparent',
                          color: landId === land.id ? 'white' : 'black',
                          padding: '5px',
                          marginBottom: '5px',
                          borderRadius: '3px',
                          textAlign: 'left',
                          width: 'calc(100% - 20px)',
                          marginLeft: '10px',
                          marginRight: '10px',
                          cursor: 'pointer',
                          border: '1px solid',
                          borderColor: landId === land.id ? '#28a745' : 'transparent'
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
              padding: '10px',
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
              {!mintedSuccessfully && (
                <>
                  <input
                    type="text"
                    placeholder="Enter price"
                    value={parcelPrice}
                    onChange={(e) => setParcelPrice(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      marginBottom: '10px',
                      boxSizing: 'border-box',
                    }}
                  />
                  {priceError && <p style={{ color: 'red' }}>{priceError}</p>}
                  <input
                    type="text"
                    placeholder="Enter Parcel Royalty"
                    value={parcelRoyalty}
                    onChange={(e) => setParcelRoyalty(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      marginBottom: '10px',
                      boxSizing: 'border-box',
                    }}
                  />
                  {royaltyError && <p style={{ color: 'red' }}>{royaltyError}</p>}

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
                </>
              )}
              {mintedSuccessfully && (
                  <>
                    <p style={{ color: 'green', fontWeight: 'bold', marginTop: '10px' }}>
                      Parcel is being minted. We will notify you.
                    </p>
                  </>
                )}
              <button
                onClick={closeModal}
                style={{
                  backgroundColor: '#dc3545',
                  color: 'white',
                  padding: '10px 15px',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  width: '45%',
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
        {showMintedParcelsModal && (
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
              padding: '10px',
            }}
          >
            <div
              style={{
                backgroundColor: 'white',
                padding: '20px',
                borderRadius: '10px',
                width: '90%',
                maxWidth: '700px',
                textAlign: 'center',
                boxSizing: 'border-box',
              }}
            >
              <h3>Minted Parcels</h3>

              {/* Search Box */}
              <input
                type="text"
                placeholder="Search parcels..."
                value={searchMintedQuery}
                onChange={(e) => setSearchMintedQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  marginBottom: '20px',
                  boxSizing: 'border-box',
                }}
              />

              {/* Display Filtered Parcels */}
              <div style={{ maxHeight: '400px', overflowY: 'scroll' }}>
                {filteredMintedParcels.length > 0 ? (
                  filteredMintedParcels.map((parcel) => (
                    <div
                      key={parcel.parcel_uuid}
                      style={{
                        border: '1px solid #ccc',
                        borderRadius: '10px',
                        marginBottom: '10px',
                        padding: '10px',
                        textAlign: 'left',
                      }}
                    >
                      <p><strong>Parcel UUID:</strong> {parcel.parcel_uuid}</p>
                      <p><strong>Land Name:</strong> {parcel.parcel_land_name}</p>
                      <p><strong>Price:</strong> {parcel.parcel_price} MATIC</p>
                      <p><strong>Royalty:</strong> {parcel.parcel_royalty / 100}%</p>

                      {/* Buttons */}
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <a href={`https://amoy.polygonscan.com/tx/${parcel.tx_hash}`} target="_blank" rel="noopener noreferrer">
                          <button style={{ backgroundColor: '#800080', color: 'white', padding: '5px 10px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                            See Transaction
                          </button>
                        </a>
                        <button
                          onClick={() => showParcelOnMap(parcel.parcel_points)}
                          style={{ backgroundColor: '#28a745', color: 'white', padding: '5px 10px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                        >
                          Show Parcel
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p>No minted parcels found.</p>
                )}
              </div>

              {/* Close Button */}
              <button
                onClick={() => setShowMintedParcelsModal(false)}
                style={{
                  backgroundColor: '#dc3545',
                  color: 'white',
                  padding: '10px 15px',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  marginTop: '20px',
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
        <ToastContainer />
    </div>
  );
}
