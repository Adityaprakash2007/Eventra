#!/usr/bin/env node
/**
 * Zero-dependency static server for the Eventra demo preview.
 * Serves preview.html (self-contained build with inlined demo API) at /
 * plus /data/* from public/. No MySQL required.
 * Usage: node scripts/serve-preview.cjs [port]   (default 3000)
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.argv[2] || process.env.PORT || 3000);
const ROOT = path.resolve(__dirname, "..");
const previewHtml = () => fs.readFileSync(path.join(ROOT, "preview.html"));

const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  if (url.startsWith("/data/")) {
    const file = path.join(ROOT, "public", url);
    if (fs.existsSync(file)) {
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      return res.end(fs.readFileSync(file));
    }
  }
  if (url === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    return res.end(JSON.stringify({ status: "ok", mode: "demo" }));
  }
  // App shell (assets are inlined; hash routing handles paths client-side)
  // no-store: the bundle is inlined into this file, so a cached page = stale app.
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  res.end(previewHtml());
});

server.listen(PORT, () => console.log(`Eventra demo server on http://localhost:${PORT}`));
