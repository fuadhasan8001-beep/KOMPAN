#!/usr/bin/env python3
"""Impor data Markdown KOMPAN ke Supabase (articles & activities)."""

import os
import frontmatter
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE = os.getenv("SUPABASE_URL")
KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
ADMIN_UUID = os.getenv("ADMIN_UUID", "035631b3-63ea-48fd-88e1-9da7c432a3f0")

if not BASE or not KEY:
    raise SystemExit("❌ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diisi di .env")

HEADERS = {
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}


def push(table: str, dir_path: str):
    dir_path = Path(dir_path)
    if not dir_path.exists():
        print(f"⚠️ Folder tidak ditemukan: {dir_path}")
        return

    ok_count = 0
    for md_file in sorted(dir_path.glob("*.md")):
        import yaml
        with open(md_file, "r", encoding="utf-8") as f:
            text = f.read()
        if text.startswith("---"):
            parts = text.split("---", 2)
            meta = yaml.safe_load(parts[1]) if len(parts) > 1 else {}
            meta["content"] = parts[2].strip() if len(parts) > 2 else ""
        else:
            meta = {"content": text}
        meta["filename"] = md_file.name
        data = meta
        if not data or not data.get("title") or not data.get("slug"):
            print(f"⚠️ Skip {md_file.name}: title/slug kosong")
            continue

        date_raw = data.get("date")
        payload = {
            "title": data["title"],
            "slug": data["slug"],
            "excerpt": data.get("excerpt", ""),
            "content": data.get("content", ""),
            "date": str(date_raw) if date_raw else None,
            "category": data.get("category", ""),
            "author": data.get("author", "Tim KOMPAN"),
            "image": data.get("image", ""),
            "tags": data.get("tags", []),
            "status": data.get("status", "published"),
            "created_by": ADMIN_UUID,
        }

        try:
            r = requests.post(
                f"{BASE}/rest/v1/{table}",
                headers=HEADERS,
                json=payload,
                timeout=15,
            )
            if r.status_code == 201:
                ok_count += 1
                print(f"✅ {table}: {payload['title']}")
            else:
                print(f"❌ {table}: {payload['title']} → {r.status_code} {r.text[:80]}")
        except Exception as e:
            print(f"❌ {table}: {payload['title']} → ERROR: {e}")

    print(f"\n📊 Selesai: {ok_count} item berhasil diimpor ke '{table}'.")


def main():
    print("🚀 Mulai impor data KOMPAN ke Supabase...\n")
    push(
        "articles",
        "/home/fuad-hasan/Projects/KOMPAN/content/artikel",
    )
    push(
        "activities",
        "/home/fuad-hasan/Projects/KOMPAN/content/kegiatan",
    )


if __name__ == "__main__":
    main()
