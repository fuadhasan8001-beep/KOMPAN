#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const token = process.env.FACEBOOK_USER_ACCESS_TOKEN;
const version = process.env.FACEBOOK_GRAPH_API_VERSION || "v26.0";
const limit = Math.min(Math.max(Number(process.env.FACEBOOK_MAX_POSTS) || 6, 1), 12);
const output = path.join(__dirname, "..", "assets", "data", "facebook-posts.json");

if (!token) {
  console.log("Facebook feed skipped: FACEBOOK_USER_ACCESS_TOKEN is not configured.");
  process.exit(0);
}

async function main() {
  const url = new URL(`https://graph.facebook.com/${version}/me/posts`);
  url.searchParams.set(
    "fields",
    "id,message,created_time,permalink_url,full_picture,attachments{media,type,url,subattachments}",
  );
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("access_token", token);

  const response = await fetch(url);
  const result = await response.json();
  if (!response.ok || result.error) {
    const message = result.error?.message || `Graph API returned HTTP ${response.status}`;
    throw new Error(`Facebook feed fetch failed: ${message}`);
  }

  const posts = (result.data || []).map((post) => {
    const attachment = post.attachments?.data?.[0];
    const media = attachment?.media;
    const subattachment = attachment?.subattachments?.data?.[0];
    return {
      id: post.id,
      message: post.message || "",
      createdAt: post.created_time || null,
      permalink: post.permalink_url || "https://www.facebook.com/anang.prasetyo.967",
      image: post.full_picture || media?.image?.src || subattachment?.media?.image?.src || null,
      type: attachment?.type || null,
    };
  });

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(
    output,
    `${JSON.stringify(
      {
        profileUrl: "https://www.facebook.com/anang.prasetyo.967",
        updatedAt: new Date().toISOString(),
        posts,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Fetched ${posts.length} Facebook posts.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
