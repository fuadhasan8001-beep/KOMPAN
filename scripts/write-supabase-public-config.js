#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const url = process.env.SUPABASE_URL || "https://bchuctwtlfhxevzewbeh.supabase.co";
const anonKey = process.env.SUPABASE_ANON_KEY || "";
const output = path.join(__dirname, "..", "assets", "js", "supabase-config.js");

if (!url.startsWith("https://") || !url.endsWith(".supabase.co")) {
  throw new Error("SUPABASE_URL must be an https Supabase project URL.");
}

fs.writeFileSync(
  output,
  `window.KOMPAN_SUPABASE_CONFIG = Object.freeze(${JSON.stringify({ url, anonKey })});\n`,
);
console.log(`Wrote browser Supabase config${anonKey ? " with publishable key" : " without a key"}.`);
