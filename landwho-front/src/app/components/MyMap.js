"use client";

import { MapContainer, TileLayer, Polygon, FeatureGroup, useMap } from 'react-leaflet';
import { useState, useEffect, useRef } from 'react';
import { EditControl } from 'react-leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';

const MyMap = ({ onPolygonCreated, setMapRef, initialPolygons = [], showPopup }) => {
  const [polygons, setPolygons] = useState(initialPolygons);
  const [selectedPolygon, setSelectedPolygon] = useState(null);
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
    }, [map]);

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
        center={[51.505, -0.09]}
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
            Save Polygon
          </button>
        </>
      )}
    </div>
  );
};

export default MyMap;
