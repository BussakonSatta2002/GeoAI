#!/usr/bin/env node

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function usage() {
  console.log("Usage: node convert_shapefile_map.js <input.shp> [output-directory] [output-name]");
  process.exit(1);
}

const input = process.argv[2];
if (!input) usage();

const inputPath = path.resolve(input);
if (!fs.existsSync(inputPath)) throw new Error(`Input not found: ${inputPath}`);

const outputDir = path.resolve(process.argv[3] || path.dirname(inputPath));
const baseName = process.argv[4] || path.basename(inputPath, path.extname(inputPath));
const geojsonPath = path.join(outputDir, `${baseName}.geojson`);
const htmlPath = path.join(outputDir, `${baseName}.html`);
fs.mkdirSync(outputDir, { recursive: true });

// GeoJSON coordinates must be longitude/latitude (WGS84).
execFileSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npx.cmd", 
  "--yes", "mapshaper", inputPath,
  "-proj", "wgs84",
  "-o", geojsonPath, "format=geojson", "precision=0.000001"
], { stdio: "inherit" });

const geojson = JSON.parse(fs.readFileSync(geojsonPath, "utf8"));
const safeGeojson = JSON.stringify(geojson).replace(/</g, "\\u003c");
const title = baseName.replace(/[<>&"']/g, "");

const html = `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} Interactive Map</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>
    html, body, #map { height: 100%; margin: 0; }
    .map-title { background: white; padding: 6px 10px; border-radius: 4px; font: 600 16px sans-serif; box-shadow: 0 1px 5px #777; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const data = ${safeGeojson};
    const map = L.map('map');
    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'], maxZoom: 20,
      attribution: '&copy; Google Maps'
    }).addTo(map);
    const layer = L.geoJSON(data, {
      style: { color: '#e31a1c', weight: 2, fillColor: '#ff7f00', fillOpacity: 0.25 },
      onEachFeature: (feature, item) => {
        const props = feature.properties || {};
        const rows = Object.entries(props).map(([k, v]) => '<b>' + k + '</b>: ' + v).join('<br>');
        if (rows) item.bindPopup(rows);
      }
    }).addTo(map);
    const bounds = layer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] }); else map.setView([13.5, 101], 6);
    const label = L.control({ position: 'topright' });
    label.onAdd = () => { const div = L.DomUtil.create('div', 'map-title'); div.textContent = '${title}'; return div; };
    label.addTo(map);
    L.control.scale({ imperial: false }).addTo(map);
  </script>
</body>
</html>`;

fs.writeFileSync(htmlPath, html, "utf8");
console.log(`Created: ${geojsonPath}`);
console.log(`Created: ${htmlPath}`);
