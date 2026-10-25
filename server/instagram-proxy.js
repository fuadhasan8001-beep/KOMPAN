/** * Server-Side Instagram Feed Proxy * * This file provides a secure
server-side proxy for Instagram feed data. * * Key Security Principles: * -
Sensitive credentials (access tokens, app secrets) NEVER leave this file * - The
frontend receives only sanitized, public data * - Caching reduces API calls and
improves performance * - Environment variables control which account source is
active * * Usage: * NODE_ENV=production node server/instagram-proxy.js * * The
frontend (index.html) reads from `window.KOMPAN_CONFIG` which can * reference
this proxy endpoint: /api/instagram/feed */ const express = require("express");
const fetch = require("node-fetch"); require("dotenv").config({ path:
`.env.${process.env.NODE_ENV || "development"}`, }); const app = express();
const PORT = process.env.INSTAGRAM_PROXY_PORT || 3001; const {
INSTAGRAM_ACCOUNT_SOURCE, INSTAGRAM_USER_ID, INSTAGRAM_ACCESS_TOKEN,
META_APP_ID, META_APP_SECRET, GRAPH_API_VERSION, INSTAGRAM_FEED_CACHE_TTL,
INSTAGRAM_MAX_POSTS, } = process.env; // Cache management let feedCache = null;
let cacheExpiry = 0; const CACHE_TTL = parseInt(INSTAGRAM_FEED_CACHE_TTL) ||
3600; const MAX_POSTS = parseInt(INSTAGRAM_MAX_POSTS) || 12; /** * Fetch feed
from Meta Graph API * Credentials stay server-side only */ async function
fetchInstagramFeed() { // Return cached data if available if (feedCache &&
Date.now() < cacheExpiry) { return feedCache; } // Ensure token exists before
making request if (!INSTAGRAM_ACCESS_TOKEN || !INSTAGRAM_USER_ID) { throw new
Error( "Instagram credentials not configured for environment: " +
INSTAGRAM_ACCOUNT_SOURCE, ); } const url =
`https://graph.facebook.com/${GRAPH_API_VERSION}/${INSTAGRAM_USER_ID}/media?fields=id,caption,media_type,media_url,permalink,timestamp,thumbnail_url,username&access_token=${INSTAGRAM_ACCESS_TOKEN}&limit=${MAX_POSTS}`;
const response = await fetch(url); const data = await response.json(); if
(data.error) { throw new Error(`Graph API Error: ${data.error.message}`); } //
Cache the result (public data only, no credentials) feedCache = data.data || [];
cacheExpiry = Date.now() + CACHE_TTL * 1000; return feedCache; } /** * Public
endpoint - serves sanitized feed data only * No credentials are exposed to
clients */ app.get("/api/instagram/feed", async (req, res) => { try { const feed
= await fetchInstagramFeed(); // Return only public-facing data res.json({
accountSource: INSTAGRAM_ACCOUNT_SOURCE, data: feed, cached: !!feedCache &&
Date.now() < cacheExpiry, timestamp: new Date().toISOString(), }); } catch
(error) { console.error("Instagram proxy error:", error.message);
res.status(500).json({ error: "Failed to fetch Instagram feed", message:
error.message, accountSource: INSTAGRAM_ACCOUNT_SOURCE, }); } }); /** * Health
check endpoint */ app.get("/api/instagram/health", (req, res) => { res.json({
status: "ok", accountSource: INSTAGRAM_ACCOUNT_SOURCE, environment:
process.env.NODE_ENV || "development", hasCredentials: !!(INSTAGRAM_ACCESS_TOKEN
&& INSTAGRAM_USER_ID), cacheActive: !!feedCache && Date.now() < cacheExpiry, });
}); // Start server app.listen(PORT, () => { console.log(`Instagram Feed Proxy
running on port ${PORT}`); console.log(`Environment: ${process.env.NODE_ENV ||
"development"}`); console.log(`Account Source: ${INSTAGRAM_ACCOUNT_SOURCE}`);
console.log( `Credentials Configured: ${!!(INSTAGRAM_ACCESS_TOKEN &&
INSTAGRAM_USER_ID)}`, ); if (!INSTAGRAM_ACCESS_TOKEN || !INSTAGRAM_USER_ID) {
console.warn( "WARNING: Instagram credentials missing. Configure .env file.", );
} }); module.exports = { app, fetchInstagramFeed };
