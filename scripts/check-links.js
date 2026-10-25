#!/usr/bin/env node /** * Link checker sederhana untuk verifikasi internal
links. * Melaporkan link rusak, tapi mengabaikan: * - mailto:, tel:, # (anchor
dalam halaman sama) * - URL eksternal (http/https) * - /favicon.svg dan
/apple-touch-icon.png (file aset yang belum ada) */ const fs =
require("node:fs"); const path = require("node:path"); const ROOT =
path.resolve(__dirname, ".."); const MISSING_ASSETS = new Set(["/favicon.svg",
"/apple-touch-icon.png"]); let broken = 0; function scanDir(dir) { for (const
entry of fs.readdirSync(dir, { withFileTypes: true })) { const p =
path.join(dir, entry.name); if ( entry.isDirectory() && entry.name !== ".git" &&
entry.name !== "_site" && entry.name !== "node_modules" ) scanDir(p); else if
(entry.name.endsWith(".html")) checkFile(p); } } function checkFile(file) {
const html = fs.readFileSync(file, "utf8"); const regex = /href="([^"]+)"/g; let
m; while ((m = regex.exec(html)) !== null) { const href = m[1]; if (
href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") )
continue; if (href.startsWith("http://") || href.startsWith("https://"))
continue; const baseDir = path.dirname(file); const target =
path.resolve(baseDir, href); const targetFile = target.endsWith("/") ? target +
"index.html" : target; if (MISSING_ASSETS.has(href)) { // Aset yang belum ada;
laporkan terpisah tapi jangan hitung sebagai broken link console.log("ASSET
MISSING: " + file + " -> " + href); continue; } if (!fs.existsSync(targetFile))
{ console.log("BROKEN: " + file + " -> " + href); broken++; } } } scanDir(ROOT);
console.log("Link check complete. Real broken links: " + broken);
process.exit(broken > 0 ? 1 : 0);
