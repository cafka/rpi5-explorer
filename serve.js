/**
 * Servidor HTTP local para desarrollo en computadora.
 * Sirve la carpeta app/ en http://localhost:3000
 *
 * Uso: node serve.js
 *
 * El teléfono no usa este servidor; accede por GitHub Pages (HTTPS).
 * localhost es un origen seguro para getUserMedia en el navegador local.
 */

const http = require("http");
const fs   = require("fs");
const path = require("path");

const PORT    = 3000;
const APP_DIR = path.join(__dirname, "app");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".ico":  "image/x-icon",
};

const server = http.createServer((req, res) => {
  // Normalizar la ruta; evitar path traversal
  let urlPath = req.url.split("?")[0];
  if (urlPath === "/" || urlPath === "") urlPath = "/index.html";
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(APP_DIR, safePath);

  // Asegurarse de que el archivo queda dentro de APP_DIR
  if (!filePath.startsWith(APP_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found: " + safePath);
      return;
    }
    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Servidor local: http://localhost:${PORT}`);
  console.log("Para cerrar: Ctrl+C");
});
