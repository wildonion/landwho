import { useEffect } from 'react';
import * as turf from '@turf/turf';

const PolygonViewer = ({ geoJson }) => {
  useEffect(() => {
    const parsedGeoJson = JSON.parse(decodeURIComponent(geoJson));
    const polygon = parsedGeoJson.coordinates[0];
    
    // Convert GeoJSON coordinates to [x, y] for SVG plotting
    const svgCoords = polygon.map(([lng, lat]) => ({
      x: (lng + 180) * 2, // simplistic conversion for illustration
      y: (90 - lat) * 2,
    }));

    const drawPolygon = () => {
      const svgContainer = document.getElementById('svgContainer');
      const svgNS = "http://www.w3.org/2000/svg";

      // Clear the SVG first
      svgContainer.innerHTML = '';

      // Draw the polygon
      const polygonElement = document.createElementNS(svgNS, 'polygon');
      polygonElement.setAttribute('points', svgCoords.map(pt => `${pt.x},${pt.y}`).join(' '));
      polygonElement.setAttribute('style', 'fill:lightblue;stroke:blue;stroke-width:1');
      svgContainer.appendChild(polygonElement);

      // Add a grid over the polygon (assuming 1m x 1m grid)
      const bbox = turf.bbox(parsedGeoJson);
      const grid = turf.squareGrid(bbox, 0.001, { units: 'degrees' });

      grid.features.forEach(cell => {
        const cellPolygon = cell.geometry.coordinates[0].map(([lng, lat]) => ({
          x: (lng + 180) * 2,
          y: (90 - lat) * 2,
        }));

        const cellElement = document.createElementNS(svgNS, 'polygon');
        cellElement.setAttribute('points', cellPolygon.map(pt => `${pt.x},${pt.y}`).join(' '));
        cellElement.setAttribute('style', 'fill:none;stroke:red;stroke-width:0.5');
        svgContainer.appendChild(cellElement);
      });
    };

    drawPolygon();
  }, [geoJson]);

  return (
    <div>
      <h1>Polygon Viewer</h1>
      <div id="svgContainer" style={{ width: '100%', height: '500px' }}>
        <svg id="polygonSVG" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
        </svg>
      </div>
    </div>
  );
};

export async function getServerSideProps({ query }) {
  const { geojson } = query;
  return {
    props: { geoJson: geojson || '' },
  };
}

export default PolygonViewer;
