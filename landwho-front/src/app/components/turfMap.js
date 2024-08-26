"use client";

import { MapContainer, TileLayer, Polygon, FeatureGroup, Popup, useMap } from 'react-leaflet';
import { useState, useEffect, useRef } from 'react';
import { EditControl } from 'react-leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import * as turf from '@turf/turf'; // Import Turf.js

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
      // Divide the polygon into smaller polygons (parcels)
      const dividedPolygons = dividePolygonIntoParcels(selectedPolygon);

      // Save the smaller polygons
      setPolygons([...polygons, ...dividedPolygons]);

      // Call the onPolygonCreated callback with the divided polygons
      onPolygonCreated(dividedPolygons);

      setSelectedPolygon(null);
    }
  };

  const dividePolygonIntoParcels = (polygon) => {
    const closedPolygon = [...polygon];
    if (closedPolygon[0][0] !== closedPolygon[closedPolygon.length - 1][0] ||
        closedPolygon[0][1] !== closedPolygon[closedPolygon.length - 1][1]) {
      closedPolygon.push(closedPolygon[0]); // Close the polygon
    }
  
    // Convert to GeoJSON format
    const polygonGeoJson = turf.polygon([closedPolygon.map(coord => [coord[1], coord[0]])]);
  
    // Divide the polygon into a grid of smaller polygons
    const bbox = turf.bbox(polygonGeoJson);
    const cellSide = 0.001; // Adjust for parcel size
    const grid = turf.squareGrid(bbox, cellSide, { units: 'degrees' });
  
    const parcels = [];
    turf.featureEach(grid, (cell) => {
      try {
        // Ensure the cell is a valid geometry and intersects
        if (turf.booleanDisjoint(polygonGeoJson, cell) === false) {
          const intersection = turf.intersect(polygonGeoJson, cell);
  
          if (intersection && intersection.geometry && intersection.geometry.type === 'Polygon') {
            parcels.push(intersection.geometry.coordinates[0].map(coord => [coord[1], coord[0]]));
          }
        }
      } catch (error) {
        console.error("Intersection error:", error);
      }
    });
  
    return parcels;
  };
  
  

  const handleExportPolygon = () => {
    if (selectedPolygon) {
      const geoJson = {
        type: 'Polygon',
        coordinates: [selectedPolygon.map(coord => [coord[1], coord[0]])], // converting to [lng, lat] for GeoJSON format
      };
      const geoJsonStr = JSON.stringify(geoJson);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(geoJsonStr);

      // Create an invisible download link and click it programmatically
      const exportFileDefaultName = 'polygon.geojson';
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
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
          <button
            onClick={handleExportPolygon}
            style={{
              position: 'absolute',
              top: '50px',
              left: '10px',
              zIndex: 1000,
              backgroundColor: '#28a745',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Export Polygon
          </button>
        </>
      )}
    </div>
  );
};

export default MyMap;
