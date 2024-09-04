"use client";

import { MapContainer, TileLayer, Polygon, FeatureGroup, useMap } from 'react-leaflet';
import { useState, useEffect, useRef } from 'react';
import { EditControl } from 'react-leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import L from 'leaflet';  // Import Leaflet for custom icons

const MyMap = ({ onPolygonCreated, setMapRef, initialPolygons = [], showPopup }) => {
  const [polygons, setPolygons] = useState(initialPolygons);
  const [selectedPolygon, setSelectedPolygon] = useState(null);
  const [isGeolocationInitialized, setIsGeolocationInitialized] = useState(false); // Track if geolocation has initialized
  const mapRef = useRef(null);
  const popupRef = useRef(null);

  const MapComponent = () => {
    const map = useMap();

    useEffect(() => {
      if (map) {
        mapRef.current = map;
        setMapRef(mapRef.current);
        console.log('Setting map reference:', mapRef.current);
      }

      // Geolocation: Run only once on the initial load
      if (!isGeolocationInitialized && "geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userLat = position.coords.latitude;
            const userLng = position.coords.longitude;

            // Set a custom marker icon for the user's location
            const userLocationIcon = L.icon({
              iconUrl: '/location.png', // Replace with your own image path
              iconSize: [40, 40],  // Size of the icon
              iconAnchor: [20, 40],  // Anchor to the center of the icon (half of its size)
              popupAnchor: [0, -30],  // Popup anchor position relative to the icon
            });

            // Create a marker using the custom icon
            const userLocationMarker = L.marker([userLat, userLng], { icon: userLocationIcon }).addTo(map);

            // Center the map on the user's location initially
            map.setView([userLat, userLng], 13);

            // Show a popup at the user's location
            userLocationMarker.bindPopup("You are here!").openPopup();

            // Set the flag to prevent resetting the map on interactions
            setIsGeolocationInitialized(true);
          },
          (error) => {
            console.error("Error getting user location: ", error);
          },
          { enableHighAccuracy: true, timeout: 1000, maximumAge: 0 }
        );
      }
    }, [map, isGeolocationInitialized]);

    return null;
  };

  const handlePolygonCreated = (e) => {
    const { layer } = e;
    const polygonInfo = layer.getLatLngs()[0].map((latLng) => [latLng.lat, latLng.lng]);

    console.log('Polygon created:', polygonInfo);
    setSelectedPolygon(polygonInfo);
  };

  const handleSavePolygon = () => {
    if (selectedPolygon) {
      onPolygonCreated(selectedPolygon);
      setPolygons([...polygons, selectedPolygon]);
      setSelectedPolygon(null);
    }
  };

  useEffect(() => {
    if (showPopup && mapRef.current) {
      const { polygon, center } = showPopup;

      // If there is an existing popup, remove it first
      if (popupRef.current) {
        popupRef.current.remove();
      }

      // Create a new popup
      popupRef.current = L.popup()
        .setLatLng(center)
        .setContent(`
          <div>
            <h3>Polygon Points</h3>
            <ul>
              ${polygon.map(point => `<li>Lat: ${point[0].toFixed(5)}, Lng: ${point[1].toFixed(5)}</li>`).join('')}
            </ul>
          </div>
        `)
        .openOn(mapRef.current);
    }
  }, [showPopup]);

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <MapContainer
        center={[51.505, -0.09]} // Default location if geolocation is not available
        zoom={13}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <FeatureGroup>
          <EditControl
            position="topright"
            onCreated={handlePolygonCreated}
            draw={{
              rectangle: false,
              polyline: false,
              circle: false,
              marker: false,
              circlemarker: false,
            }}
          />
          {polygons.map((polygon, index) => (
            <Polygon key={index} positions={polygon} />
          ))}
        </FeatureGroup>
        <MapComponent />
      </MapContainer>
      {selectedPolygon && (
        <>
          <button
            onClick={handleSavePolygon}
            style={{
              position: 'absolute',
              top: '10px',
              left: '10px',
              zIndex: 1000,
              backgroundColor: '#007bff',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Register Land
          </button>
        </>
      )}
    </div>
  );
};

export default MyMap;
