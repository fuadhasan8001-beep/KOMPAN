#!/usr/bin/env python3
"""Local KOMPAN site, SQLite database, and admin article dashboard."""

from __future__ import annotations

import argparse
import base64
from contextlib import contextmanager
import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import sqlite3
import sys
import time
import unicodedata
import uuid
from datetime import date, datetime, timezone
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, unquote, urlsplit
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("KOMPAN_DATA_DIR", Path.home() / ".local" / "share" / "kompan")).expanduser()
DB_PATH = DATA_DIR / "kompan.sqlite3"
UPLOAD_DIR = DATA_DIR / "uploads"
PORT = int(os.environ.get("KOMPAN_PORT", "8080"))
SESSION_HOURS = 12
PASSWORD_ITERATIONS = 310_000
REMOTE_TABLES = ("profiles", "articles", "activities", "media", "comments", "site_settings")
MIME_EXTENSIONS = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


@contextmanager
def connect_db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH, timeout=15)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    db.execute("PRAGMA busy_timeout = 15000")
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db() -> None:
    with connect_db() as db:
        db.execute("PRAGMA journal_mode = WAL")
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS profiles (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
                password_salt TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS articles (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                slug TEXT NOT NULL UNIQUE,
                excerpt TEXT NOT NULL DEFAULT '',
                content TEXT NOT NULL,
                date TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'Artikel',
                author TEXT NOT NULL DEFAULT 'KOMPAN',
                image TEXT NOT NULL DEFAULT '',
                tags_json TEXT NOT NULL DEFAULT '[]',
                status TEXT NOT NULL DEFAULT 'published',
                source TEXT NOT NULL DEFAULT 'admin',
                created_by TEXT,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS articles_published_created_idx
                ON articles(status, created_at DESC);
            CREATE TABLE IF NOT EXISTS activities (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                slug TEXT NOT NULL UNIQUE,
                excerpt TEXT NOT NULL DEFAULT '',
                content TEXT NOT NULL,
                date TEXT NOT NULL DEFAULT '',
                category TEXT NOT NULL DEFAULT 'Kegiatan',
                author TEXT NOT NULL DEFAULT 'KOMPAN',
                image TEXT NOT NULL DEFAULT '',
                tags_json TEXT NOT NULL DEFAULT '[]',
                status TEXT NOT NULL DEFAULT 'published',
                source TEXT NOT NULL DEFAULT 'markdown',
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS media (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                path TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                source TEXT NOT NULL DEFAULT 'local',
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS comments (
                id TEXT PRIMARY KEY,
                article_id TEXT,
                author TEXT NOT NULL DEFAULT '',
                content TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS site_settings (
                setting_key TEXT PRIMARY KEY,
                value_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                expires_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS legacy_supabase_records (
                table_name TEXT NOT NULL,
                row_id TEXT NOT NULL,
                data_json TEXT NOT NULL,
                imported_at TEXT NOT NULL,
                PRIMARY KEY(table_name, row_id)
            );
            """
        )
        now = utc_now()
        defaults = {
            "site_name": "KOMPAN",
            "site_full_name": "Komunitas Padhang Njingglang",
            "database_mode": "local-sqlite",
        }
        for key, value in defaults.items():
            db.execute(
                "INSERT OR IGNORE INTO site_settings(setting_key,value_json,updated_at) VALUES(?,?,?)",
                (key, json.dumps(value), now),
            )
        db.execute("DELETE FROM sessions WHERE expires_at < ?", (int(time.time()),))
    seed_markdown()
    seed_local_admin()
    scan_local_media()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def parse_frontmatter(text: str) -> tuple[dict, str]:
    if not text.startswith("---"):
        return {}, text.strip()
    parts = text.split("---", 2)
    if len(parts) < 3:
        return {}, text.strip()
    metadata: dict[str, object] = {}
    for line in parts[1].splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        key, value = key.strip(), value.strip()
        if value.startswith(("'", '"')) and value.endswith(("'", '"')):
            value = value[1:-1]
        elif key == "tags":
            value = value.strip("[]")
            metadata[key] = [tag.strip().strip("'\"") for tag in value.split(",") if tag.strip()]
            continue
        metadata[key] = value
    return metadata, parts[2].strip()


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", ascii_text)).strip("-")[:90] or "artikel"


def seed_markdown() -> None:
    now = utc_now()
    with connect_db() as db:
        for directory, table in ((ROOT / "content" / "artikel", "articles"), (ROOT / "content" / "kegiatan", "activities")):
            if not directory.exists():
                continue
            for source_file in sorted(directory.glob("*.md")):
                metadata, content = parse_frontmatter(source_file.read_text(encoding="utf-8"))
                title = str(metadata.get("title", "")).strip()
                if not title:
                    continue
                slug = str(metadata.get("slug") or source_file.stem)
                status = str(metadata.get("status", "published")).lower()
                date_value = str(metadata.get("date", ""))
                tags = metadata.get("tags", [])
                if not isinstance(tags, list):
                    tags = []
                common = (
                    str(uuid.uuid5(uuid.NAMESPACE_URL, f"kompan:{table}:{slug}")),
                    title,
                    slug,
                    str(metadata.get("excerpt", "")),
                    content,
                    date_value,
                    str(metadata.get("category", "Artikel" if table == "articles" else "Kegiatan")),
                    str(metadata.get("author", "Tim KOMPAN")),
                    str(metadata.get("image", "")),
                    json.dumps(tags, ensure_ascii=False),
                    status,
                    now,
                )
                if table == "articles":
                    db.execute(
                        """INSERT OR IGNORE INTO articles
                        (id,title,slug,excerpt,content,date,category,author,image,tags_json,status,source,created_at)
                        VALUES(?,?,?,?,?,?,?,?,?,?,?,'markdown',?)""",
                        common,
                    )
                else:
                    db.execute(
                        """INSERT OR IGNORE INTO activities
                        (id,title,slug,excerpt,content,date,category,author,image,tags_json,status,source,created_at)
                        VALUES(?,?,?,?,?,?,?,?,?,?,?,'markdown',?)""",
                        common,
                    )


def read_private_env() -> dict[str, str]:
    values: dict[str, str] = {}
    env_file = ROOT / "supabase" / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            key, value = stripped.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    values.update({key: value for key, value in os.environ.items() if key.startswith("SUPABASE_")})
    return values


def password_hash(password: str, salt: bytes | None = None) -> tuple[str, str]:
    salt = salt or secrets.token_bytes(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PASSWORD_ITERATIONS)
    return salt.hex(), derived.hex()


def seed_local_admin() -> None:
    private = read_private_env()
    email = private.get("SUPABASE_AUTH_EMAIL", "").strip()
    password = private.get("SUPABASE_AUTH_PASSWORD", "")
    if not email or not password:
        return
    with connect_db() as db:
        existing = db.execute("SELECT id FROM profiles WHERE role='admin' LIMIT 1").fetchone()
        if existing:
            return
        salt, hashed = password_hash(password)
        db.execute(
            "INSERT OR IGNORE INTO profiles(id,email,role,password_salt,password_hash,created_at) VALUES(?,?,?,?,?,?)",
            (str(uuid.uuid4()), email, "admin", salt, hashed, utc_now()),
        )


def scan_local_media() -> None:
    image_dir = ROOT / "assets" / "images"
    if not image_dir.exists():
        return
    with connect_db() as db:
        for file in image_dir.iterdir():
            if not file.is_file() or file.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
                continue
            db.execute(
                "INSERT OR IGNORE INTO media(id,filename,path,mime_type,source,created_at) VALUES(?,?,?,?,?,?)",
                (str(uuid.uuid5(uuid.NAMESPACE_URL, f"kompan-media:{file.name}")), file.name, f"/assets/images/{file.name}", mimetypes.guess_type(file.name)[0] or "application/octet-stream", "repository", utc_now()),
            )


def export_supabase_rows(table: str, base: str, key: str) -> list[dict]:
    page_size = 500
    rows: list[dict] = []
    offset = 0
    while True:
        endpoint = f"{base.rstrip('/')}/rest/v1/{table}?select=*"
        request = Request(
            endpoint,
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Range": f"{offset}-{offset + page_size - 1}",
                "Prefer": "count=exact",
            },
        )
        try:
            with urlopen(request, timeout=12) as response:
                page = json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            if error.code == 404:
                return []
            raise RuntimeError(f"Table {table} export failed with HTTP {error.code}.") from None
        except (URLError, TimeoutError):
            raise RuntimeError("Supabase tidak dapat dijangkau dari laptop ini; database lokal tetap aman.") from None
        if not isinstance(page, list):
            raise RuntimeError(f"Format data pada tabel {table} tidak dikenali.")
        rows.extend(page)
        if len(page) < page_size:
            return rows
        offset += page_size


def migrate_supabase_to_local() -> None:
    values = read_private_env()
    base = values.get("SUPABASE_URL", "")
    key = values.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base or not key or "your-service-role-key" in key:
        raise RuntimeError("SUPABASE_URL atau service key tidak tersedia di supabase/.env.")

    snapshot = {table: export_supabase_rows(table, base, key) for table in REMOTE_TABLES}
    imported_at = utc_now()
    with connect_db() as db:
        for table, rows in snapshot.items():
            for index, record in enumerate(rows):
                row_id = str(record.get("id") or record.get("slug") or record.get("key") or index)
                db.execute(
                    """INSERT INTO legacy_supabase_records(table_name,row_id,data_json,imported_at)
                    VALUES(?,?,?,?) ON CONFLICT(table_name,row_id) DO UPDATE SET
                    data_json=excluded.data_json, imported_at=excluded.imported_at""",
                    (table, row_id, json.dumps(record, ensure_ascii=False), imported_at),
                )
                if table in {"articles", "activities"}:
                    title = str(record.get("title") or "").strip()
                    slug = slugify(str(record.get("slug") or title))
                    if not title:
                        continue
                    raw_tags = record.get("tags") or []
                    if not isinstance(raw_tags, list):
                        raw_tags = [str(raw_tags)]
                    values_tuple = (
                        str(record.get("id") or uuid.uuid4()), title, slug,
                        str(record.get("excerpt") or ""), str(record.get("content") or ""),
                        str(record.get("date") or ""), str(record.get("category") or ("Artikel" if table == "articles" else "Kegiatan")),
                        str(record.get("author") or "KOMPAN"), str(record.get("image") or ""),
                        json.dumps(raw_tags, ensure_ascii=False), str(record.get("status") or "published"), imported_at,
                    )
                    target = "articles" if table == "articles" else "activities"
                    db.execute(
                        f"""INSERT OR IGNORE INTO {target}
                        (id,title,slug,excerpt,content,date,category,author,image,tags_json,status,source,created_at)
                        VALUES(?,?,?,?,?,?,?,?,?,?,?,'supabase',?)""",
                        values_tuple,
                    )
    print("Supabase snapshot imported into local SQLite:")
    for table, rows in snapshot.items():
        print(f"  {table}: {len(rows)} rows")
    print(f"Local database: {DB_PATH}")


def ensure_admin(email: str, password: str) -> None:
    email = email.strip().lower()
    if "@" not in email or len(password) < 12:
        raise ValueError("Gunakan email valid dan kata sandi minimal 12 karakter.")
    salt, hashed = password_hash(password)
    with connect_db() as db:
        existing = db.execute("SELECT id FROM profiles WHERE email=? COLLATE NOCASE", (email,)).fetchone()
        if existing:
            db.execute(
                "UPDATE profiles SET role='admin',password_salt=?,password_hash=? WHERE id=?",
                (salt, hashed, existing["id"]),
            )
        else:
            db.execute(
                "INSERT INTO profiles(id,email,role,password_salt,password_hash,created_at) VALUES(?,?,?,?,?,?)",
                (str(uuid.uuid4()), email, "admin", salt, hashed, utc_now()),
            )


class LocalHandler(SimpleHTTPRequestHandler):
    server_version = "KOMPANLocal/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        self.send_header("X-Frame-Options", "DENY")
        super().end_headers()

    def translate_path(self, path):
        relative = unquote(urlsplit(path).path).lstrip("/")
        parts = Path(relative).parts
        blocked = {".git", ".github", "supabase", "scripts", "server", "content", "node_modules"}
        if any(part.startswith(".") or part in blocked for part in parts) or relative in {"local_app.py", "README.md", "package.json"}:
            return str(ROOT / "__local_not_found__")
        return str(ROOT / relative)

    def do_GET(self):
        parsed = urlsplit(self.path)
        if parsed.path.startswith("/api/"):
            self.handle_api_get(parsed.path, parse_qs(parsed.query))
            return
        if parsed.path.startswith("/media/"):
            self.serve_upload(unquote(parsed.path.removeprefix("/media/")))
            return
        super().do_GET()

    def do_POST(self):
        if not self.check_same_origin():
            self.send_json(403, {"error": "Permintaan lintas situs ditolak."})
            return
        route = urlsplit(self.path).path
        try:
            if route == "/api/admin/login":
                self.login()
            elif route == "/api/admin/logout":
                self.logout()
            elif route == "/api/admin/articles":
                self.create_article()
            else:
                self.send_json(404, {"error": "Rute API tidak ditemukan."})
        except ValueError as error:
            self.send_json(400, {"error": str(error)})
        except Exception:
            self.send_json(500, {"error": "Permintaan gagal diproses."})

    def do_PUT(self):
        if not self.check_same_origin():
            self.send_json(403, {"error": "Permintaan lintas situs ditolak."})
            return
        article_id = self.article_id_from_path()
        if not article_id:
            self.send_json(404, {"error": "Artikel tidak ditemukan."})
            return
        try:
            self.update_article(article_id)
        except ValueError as error:
            self.send_json(400, {"error": str(error)})
        except Exception:
            self.send_json(500, {"error": "Artikel gagal diperbarui."})

    def do_DELETE(self):
        if not self.check_same_origin():
            self.send_json(403, {"error": "Permintaan lintas situs ditolak."})
            return
        article_id = self.article_id_from_path()
        if not article_id:
            self.send_json(404, {"error": "Artikel tidak ditemukan."})
            return
        if not self.require_admin():
            self.send_json(401, {"error": "Login admin diperlukan."})
            return
        with connect_db() as db:
            article = db.execute("SELECT image FROM articles WHERE id=? AND source='admin'", (article_id,)).fetchone()
            if not article:
                self.send_json(404, {"error": "Artikel tidak ditemukan."})
                return
            db.execute("DELETE FROM articles WHERE id=? AND source='admin'", (article_id,))
            db.execute("DELETE FROM media WHERE path=? AND source='admin-upload'", (article["image"],))
        self.remove_uploaded_image(article["image"])
        self.send_json(200, {"deleted": True})

    def article_id_from_path(self) -> str:
        prefix = "/api/admin/articles/"
        route = urlsplit(self.path).path
        if not route.startswith(prefix):
            return ""
        article_id = unquote(route[len(prefix):])
        return article_id if article_id and "/" not in article_id else ""

    @staticmethod
    def remove_uploaded_image(image_path: str):
        if not image_path.startswith("/media/"):
            return
        filename = image_path.removeprefix("/media/")
        if Path(filename).name == filename:
            (UPLOAD_DIR / filename).unlink(missing_ok=True)

    def update_article(self, article_id: str):
        admin = self.require_admin()
        if not admin:
            self.send_json(401, {"error": "Login admin diperlukan."})
            return
        payload = self.read_json()
        title = str(payload.get("title", "")).strip()
        content = str(payload.get("content", "")).strip()
        category = str(payload.get("category", "Artikel")).strip() or "Artikel"
        if not title or len(title) > 160:
            raise ValueError("Judul wajib diisi dan maksimal 160 karakter.")
        if len(content) < 30 or len(content) > 200_000:
            raise ValueError("Isi artikel harus 30–200.000 karakter.")

        image_data = str(payload.get("imageData", ""))
        mime = str(payload.get("imageMime", ""))
        new_image = ""
        new_filename = ""
        if image_data:
            if mime not in MIME_EXTENSIONS:
                raise ValueError("Format gambar harus JPG, PNG, atau WebP.")
            try:
                image_bytes = base64.b64decode(image_data, validate=True)
            except Exception:
                raise ValueError("Data gambar tidak valid.")
            if not image_bytes or len(image_bytes) > 5 * 1024 * 1024:
                raise ValueError("Ukuran gambar maksimal 5 MB.")
            new_filename = f"{uuid.uuid4().hex}{MIME_EXTENSIONS[mime]}"
            (UPLOAD_DIR / new_filename).write_bytes(image_bytes)
            new_image = f"/media/{new_filename}"

        old_image = ""
        try:
            with connect_db() as db:
                old = db.execute("SELECT image FROM articles WHERE id=? AND source='admin'", (article_id,)).fetchone()
                if not old:
                    raise ValueError("Artikel tidak ditemukan.")
                old_image = old["image"]
                excerpt = re.sub(r"\s+", " ", content)[:220]
                image_clause = ", image=:image" if new_image else ""
                db.execute(
                    f"UPDATE articles SET title=:title,excerpt=:excerpt,content=:content,category=:category{image_clause} WHERE id=:id AND source='admin'",
                    {"id": article_id, "title": title, "excerpt": excerpt, "content": content, "category": category, "image": new_image},
                )
                if new_image:
                    db.execute(
                        "INSERT INTO media(id,filename,path,mime_type,source,created_at) VALUES(?,?,?,?,?,?)",
                        (str(uuid.uuid4()), new_filename, new_image, mime, "admin-upload", utc_now()),
                    )
                    db.execute("DELETE FROM media WHERE path=? AND source='admin-upload'", (old_image,))
                updated = db.execute("SELECT id,title,slug,excerpt,content,date,category,author,image,status FROM articles WHERE id=?", (article_id,)).fetchone()
        except Exception:
            if new_filename:
                (UPLOAD_DIR / new_filename).unlink(missing_ok=True)
            raise
        if new_image:
            self.remove_uploaded_image(old_image)
        self.send_json(200, {"article": dict(updated)})

    def check_same_origin(self) -> bool:
        origin = self.headers.get("Origin")
        return not origin or urlsplit(origin).netloc == self.headers.get("Host")

    def read_json(self, max_bytes: int = 8 * 1024 * 1024) -> dict:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            raise ValueError("Ukuran permintaan tidak valid.")
        if length <= 0 or length > max_bytes:
            raise ValueError("Ukuran permintaan melebihi batas.")
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise ValueError("Isi permintaan tidak valid.")
        if not isinstance(data, dict):
            raise ValueError("Format permintaan tidak valid.")
        return data

    def send_json(self, status: int, payload: dict, extra_headers: dict | None = None):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        if extra_headers:
            for key, value in extra_headers.items():
                self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def session_user(self):
        cookie = SimpleCookie(self.headers.get("Cookie", ""))
        morsel = cookie.get("kompan_session")
        if not morsel:
            return None
        token_hash = hashlib.sha256(morsel.value.encode()).hexdigest()
        with connect_db() as db:
            row = db.execute(
                """SELECT p.id,p.email,p.role FROM sessions s
                JOIN profiles p ON p.id=s.profile_id
                WHERE s.token_hash=? AND s.expires_at>?""",
                (token_hash, int(time.time())),
            ).fetchone()
        return dict(row) if row else None

    def require_admin(self):
        user = self.session_user()
        return user if user and user["role"] == "admin" else None

    def handle_api_get(self, route: str, query: dict):
        if route == "/api/admin/session":
            user = self.session_user()
            if not user or user["role"] != "admin":
                self.send_json(200, {"authenticated": False})
            else:
                self.send_json(200, {"authenticated": True, "email": user["email"], "role": user["role"]})
            return
        if route == "/api/admin/articles":
            if not self.require_admin():
                self.send_json(401, {"error": "Login admin diperlukan."})
                return
            with connect_db() as db:
                rows = db.execute(
                    "SELECT id,title,slug,date,status FROM articles WHERE source='admin' ORDER BY created_at DESC"
                ).fetchall()
            self.send_json(200, {"articles": [dict(row) for row in rows]})
            return
        if route == "/api/articles":
            slug = (query.get("slug") or [""])[0]
            with connect_db() as db:
                if slug:
                    row = db.execute(
                        "SELECT id,title,slug,excerpt,content,date,category,author,image FROM articles WHERE slug=? AND status='published' AND source!='markdown'",
                        (slug,),
                    ).fetchone()
                    self.send_json(200, {"article": dict(row) if row else None})
                    return
                try:
                    limit = min(max(int((query.get("limit") or ["12"])[0]), 1), 24)
                except ValueError:
                    limit = 12
                rows = db.execute(
                    """SELECT title,slug,excerpt,date,category,image FROM articles
                    WHERE status='published' AND source!='markdown'
                    ORDER BY created_at DESC LIMIT ?""",
                    (limit,),
                ).fetchall()
            self.send_json(200, {"articles": [dict(row) for row in rows]})
            return
        self.send_json(404, {"error": "Rute API tidak ditemukan."})

    def login(self):
        payload = self.read_json(16_384)
        email = str(payload.get("email", "")).strip().lower()
        password = str(payload.get("password", ""))
        with connect_db() as db:
            user = db.execute(
                "SELECT id,email,role,password_salt,password_hash FROM profiles WHERE email=? COLLATE NOCASE",
                (email,),
            ).fetchone()
            if not user or user["role"] != "admin":
                self.send_json(401, {"error": "Email atau kata sandi tidak cocok."})
                return
            calculated = hashlib.pbkdf2_hmac(
                "sha256", password.encode(), bytes.fromhex(user["password_salt"]), PASSWORD_ITERATIONS
            ).hex()
            if not hmac.compare_digest(calculated, user["password_hash"]):
                self.send_json(401, {"error": "Email atau kata sandi tidak cocok."})
                return
            token = secrets.token_urlsafe(32)
            expires = int(time.time() + SESSION_HOURS * 3600)
            db.execute(
                "INSERT INTO sessions(token_hash,profile_id,expires_at) VALUES(?,?,?)",
                (hashlib.sha256(token.encode()).hexdigest(), user["id"], expires),
            )
        self.send_json(
            200,
            {"authenticated": True, "email": user["email"], "role": user["role"]},
            {"Set-Cookie": f"kompan_session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age={SESSION_HOURS * 3600}"},
        )

    def logout(self):
        cookie = SimpleCookie(self.headers.get("Cookie", ""))
        morsel = cookie.get("kompan_session")
        if morsel:
            with connect_db() as db:
                db.execute("DELETE FROM sessions WHERE token_hash=?", (hashlib.sha256(morsel.value.encode()).hexdigest(),))
        self.send_json(200, {"authenticated": False}, {"Set-Cookie": "kompan_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"})

    def create_article(self):
        admin = self.require_admin()
        if not admin:
            self.send_json(401, {"error": "Login admin diperlukan."})
            return
        payload = self.read_json()
        title = str(payload.get("title", "")).strip()
        content = str(payload.get("content", "")).strip()
        category = str(payload.get("category", "Artikel")).strip() or "Artikel"
        image_data = str(payload.get("imageData", ""))
        mime = str(payload.get("imageMime", ""))
        if not title or len(title) > 160:
            raise ValueError("Judul wajib diisi dan maksimal 160 karakter.")
        if len(content) < 30 or len(content) > 200_000:
            raise ValueError("Isi artikel harus 30–200.000 karakter.")
        if mime not in MIME_EXTENSIONS:
            raise ValueError("Format gambar harus JPG, PNG, atau WebP.")
        try:
            image_bytes = base64.b64decode(image_data, validate=True)
        except Exception:
            raise ValueError("Data gambar tidak valid.")
        if not image_bytes or len(image_bytes) > 5 * 1024 * 1024:
            raise ValueError("Ukuran gambar maksimal 5 MB.")

        filename = f"{uuid.uuid4().hex}{MIME_EXTENSIONS[mime]}"
        upload_path = UPLOAD_DIR / filename
        upload_path.write_bytes(image_bytes)
        now = utc_now()
        slug_base = slugify(title)
        slug = f"{slug_base}-{uuid.uuid4().hex[:8]}"
        excerpt = re.sub(r"\s+", " ", content)[:220]
        article = {
            "id": str(uuid.uuid4()), "title": title, "slug": slug, "excerpt": excerpt,
            "content": content, "date": date.today().isoformat(), "category": category,
            "author": admin["email"], "image": f"/media/{filename}", "tags_json": "[]",
            "status": "published", "source": "admin", "created_by": admin["id"], "created_at": now,
        }
        try:
            with connect_db() as db:
                db.execute(
                    """INSERT INTO articles
                    (id,title,slug,excerpt,content,date,category,author,image,tags_json,status,source,created_by,created_at)
                    VALUES(:id,:title,:slug,:excerpt,:content,:date,:category,:author,:image,:tags_json,:status,:source,:created_by,:created_at)""",
                    article,
                )
                db.execute(
                    "INSERT INTO media(id,filename,path,mime_type,source,created_at) VALUES(?,?,?,?,?,?)",
                    (str(uuid.uuid4()), filename, article["image"], mime, "admin-upload", now),
                )
        except Exception:
            upload_path.unlink(missing_ok=True)
            raise
        self.send_json(201, {"article": {key: value for key, value in article.items() if key != "tags_json"}})

    def serve_upload(self, filename: str):
        if not filename or Path(filename).name != filename or filename.startswith("."):
            self.send_error(404)
            return
        path = (UPLOAD_DIR / filename).resolve()
        if path.parent != UPLOAD_DIR.resolve() or not path.is_file():
            self.send_error(404)
            return
        content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "public, max-age=86400")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main():
    parser = argparse.ArgumentParser(description="KOMPAN local website and database")
    parser.add_argument("command", choices=("init", "serve", "create-admin", "reset-admin-password", "migrate-supabase"), nargs="?", default="serve")
    parser.add_argument("email", nargs="?")
    args = parser.parse_args()

    if args.command == "create-admin":
        import getpass
        init_db()
        email = args.email or input("Email admin: ").strip()
        password = getpass.getpass("Kata sandi baru (min. 12 karakter): ")
        confirm = getpass.getpass("Ulangi kata sandi: ")
        if password != confirm:
            raise SystemExit("Kata sandi tidak cocok.")
        ensure_admin(email, password)
        print(f"Admin lokal disiapkan: {email}")
        print(f"Database lokal: {DB_PATH}")
        return
    if args.command == "reset-admin-password":
        import getpass
        init_db()
        email = args.email or input("Email admin: ").strip()
        password = getpass.getpass("Kata sandi baru (min. 12 karakter): ")
        confirm = getpass.getpass("Ulangi kata sandi: ")
        if password != confirm:
            raise SystemExit("Kata sandi tidak cocok.")
        ensure_admin(email, password)
        print(f"Kata sandi admin lokal diperbarui: {email}")
        return
    init_db()
    if args.command == "init":
        with connect_db() as db:
            counts = {table: db.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0] for table in ("profiles", "articles", "activities", "media", "comments", "site_settings")}
        print(f"Database KOMPAN lokal siap: {DB_PATH}")
        for table, count in counts.items():
            print(f"  {table}: {count}")
        if not counts["profiles"]:
            print("Buat admin: python3 local_app.py create-admin")
        return
    if args.command == "migrate-supabase":
        migrate_supabase_to_local()
        return
    server = ThreadingHTTPServer(("127.0.0.1", PORT), LocalHandler)
    print(f"Situs dan database lokal berjalan di http://127.0.0.1:{PORT}/")
    print(f"Dashboard admin: http://127.0.0.1:{PORT}/admin/")
    print(f"Database: {DB_PATH}")
    print("Hanya laptop ini yang dapat mengakses server. Hentikan dengan Ctrl+C.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ValueError) as error:
        print(error, file=sys.stderr)
        sys.exit(1)
