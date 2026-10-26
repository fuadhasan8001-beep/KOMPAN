#!/usr/bin/env python3
"""Upload gambar lokal ke Supabase Storage bucket 'kompan-media'."""

import os
from pathlib import Path
import requests
from dotenv import load_dotenv

load_dotenv()

BASE = os.getenv("SUPABASE_URL")
KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

BUCKET = "kompan-media"
IMAGES_DIR = Path("/home/fuad-hasan/Projects/KOMPAN/assets/images")

headers = {"Authorization": f"Bearer {KEY}"}

# 1. Buat bucket jika belum ada (via REST tidak langsung, tapi bisa dicek)
print(f"📁 Upload gambar dari: {IMAGES_DIR}")

for img_path in IMAGES_DIR.glob("*.{webp,jpg,jpeg,png,gif}"):
    filename = img_path.name
    url = f"{BASE}/storage/v1/object/{BUCKET}/{filename}"
    with open(img_path, "rb") as f:
        files = {"file": (filename, f, "image/webp" if filename.endswith(".webp") else "image/jpeg")}
        # Upload menggunakan REST (jika Storage API tersedia dengan service key)
        try:
            r = requests.post(url, headers={**headers, "x-upsert": "true"}, files=files, timeout=30)
            if r.status_code in (200, 201, 204):
                print(f"✅ Upload: {filename}")
            else:
                print(f"⚠️ {filename}: {r.status_code} {r.text[:60]}")
        except Exception as e:
            print(f"❌ {filename}: {e}")

print("\n📋 Catatan: Bucket 'kompan-media' harus dibuat manual di dashboard Supabase → Storage → Create bucket (nama: kompan-media, public: ✅)")
