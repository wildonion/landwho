// src/app/layout.js
import 'leaflet/dist/leaflet.css';
import './globals.css';

export default function Layout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}