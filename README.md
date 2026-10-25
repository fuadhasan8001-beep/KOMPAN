# KOMPAN — Komunitas Padhang Jingglang

Situs statis multi-halaman berbahasa Indonesia, dibangun tanpa backend atau database.

## Struktur halaman

- `index.html` — Beranda (sumber desain utama, dipelihara manual)
- `tentang.html` — Tentang Kami
- `organisasi.html` — Struktur Organisasi
- `galeri.html` — Galeri Dokumentasi
- `kontak.html` — Kontak & Formulir
- `kebijakan-privasi.html` — Kebijakan Privasi
- `404.html` — Halaman Tidak Ditemukan
- `kegiatan/index.html` + `kegiatan/{slug}/index.html` — Daftar & Detail Kegiatan
- `berita/index.html` + `berita/{slug}/index.html` — Daftar & Detail Berita

Konten berita & kegiatan berasal dari Markdown (`content/`). Proses build (`node scripts/build.js`) menghasilkan halaman daftar dan detail, mengecualikan draft, memvalidasi slug unik, dan membuat URL relatif agar situs berfungsi baik pada domain custom maupun URL repository GitHub Pages.

## Menjalankan secara lokal

```bash
node scripts/build.js   # bangun halaman dari Markdown
python3 -m http.server 8080
# atau
npm run serve
```

Buka `http://localhost:8080/`.

## Menguji tautan

```bash
node scripts/check-links.js
npm run check
```

## Deploy ke GitHub Pages

1. Pastikan cabang `main` sudah memiliki semua hasil build (`index.html`, `kegiatan/`, `berita/`, dll.).
2. GitHub Actions (`.github/workflows/deploy.yml`) akan membangun dan mempublikasikan secara otomatis saat `main` diperbarui.
3. Jika menggunakan domain custom, pastikan file `CNAME` berisi nama domain (`kompan.or.id`) dan pengaturan Pages di repo sudah menyorot domain tersebut.
4. HTTPS akan aktif secara otomatis oleh GitHub Pages.

## Catatan penting

- Semua tautan menggunakan path relatif (`computeRel`) sehingga tidak bergantung pada base path absolut.
- `social.instagram` masih placeholder (`https://instagram.com/`) hingga akun resmi dikonfirmasi.
- Nomor WhatsApp KOMPAN adalah `+62 858-5521-6681`.
- `favicon.svg` dan `apple-touch-icon.png` belum tersedia di repo; ini adalah masalah aset yang sudah ada sebelumnya, bukan tautan rusak.
