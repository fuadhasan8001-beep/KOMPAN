# KOMPAN — Komunitas Padhang Njingglang

Situs multi-halaman berbahasa Indonesia. Halaman publik tetap statis; Supabase menyediakan login admin, database artikel, dan penyimpanan gambar.

## Struktur halaman

- `index.html` — Beranda (sumber desain utama, dipelihara manual)
- `tentang.html` — Tentang Kami
- `organisasi.html` — Struktur Organisasi
- `galeri.html` — Galeri Dokumentasi
- `kontak.html` — Kontak & Formulir
- `kebijakan-privasi.html` — Kebijakan Privasi
- `404.html` — Halaman Tidak Ditemukan
- `kegiatan/index.html` + `kegiatan/{slug}/index.html` — Daftar & Detail Kegiatan
- `artikel/index.html` + `artikel/{slug}/index.html` — Daftar & Detail Artikel

Konten artikel & kegiatan berasal dari Markdown (`content/`). Proses build (`node scripts/build.js`) menghasilkan halaman daftar dan detail, mengecualikan draft, memvalidasi slug unik, dan membuat URL relatif agar situs berfungsi baik pada domain custom maupun URL repository GitHub Pages.

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

1. Pastikan cabang `main` sudah memiliki semua hasil build (`index.html`, `kegiatan/`, `artikel/`, dll.).
2. GitHub Actions (`.github/workflows/deploy.yml`) akan membangun dan mempublikasikan secara otomatis saat `main` diperbarui.
3. Jika menggunakan domain custom, pastikan file `CNAME` berisi nama domain (`kompan.or.id`) dan pengaturan Pages di repo sudah menyorot domain tersebut.
4. HTTPS akan aktif secara otomatis oleh GitHub Pages.

### Feed Facebook Anang (otomatis)

Beranda dan halaman Galeri menampilkan hingga enam postingan terbaru dari profil Anang. Workflow GitHub Actions memperbarui feed setiap enam jam dan saat workflow dijalankan manual. Karena situs memakai GitHub Pages yang statis, proses pengambilan postingan berjalan di GitHub Actions; token Facebook tidak dikirim ke browser pengunjung.

Untuk mengaktifkannya, buat aplikasi Meta, minta izin `user_posts` melalui Facebook Login, lalu tambahkan token akses milik akun Anang sebagai repository secret bernama `FACEBOOK_USER_ACCESS_TOKEN` di **Settings → Secrets and variables → Actions**. Token harus memiliki izin untuk membaca postingan profil tersebut. Meta dapat meminta App Review untuk izin ini; jadwal feed akan berhenti memperbarui jika token kedaluwarsa atau izin dicabut. Jangan menaruh token di file situs atau mengirimkannya di chat.

Setelah secret tersedia, jalankan workflow **Build & Deploy KOMPAN** satu kali dari tab **Actions** untuk mengisi postingan pertama. Berikutnya feed diperbarui otomatis tiap enam jam.

### Dashboard Admin Artikel

Dashboard tersedia di `/admin/`. Admin dapat masuk, mengunggah gambar JPG/PNG/WebP hingga 5 MB, menulis judul dan isi artikel, lalu menerbitkannya. Artikel terbit langsung muncul di bagian artikel terbaru pada Beranda dan halaman `/artikel/`, serta memiliki halaman baca sendiri.

Sebelum digunakan:

1. Jalankan `supabase/admin-dashboard.sql` satu kali pada **Supabase Dashboard → SQL Editor**. SQL ini mengaktifkan role `admin`, kebijakan RLS, tabel artikel, dan bucket gambar. Di dalamnya, UID admin yang sudah ada di konfigurasi lokal dipromosikan menjadi admin; ubah UID tersebut jika akun admin yang dipakai berbeda.
2. Tambahkan publishable/anon key Supabase sebagai repository secret `SUPABASE_ANON_KEY` pada **Settings → Secrets and variables → Actions**, lalu jalankan workflow **Build & Deploy KOMPAN**. Kunci ini memang dipakai di browser; akses tulis dibatasi oleh role admin dan RLS. Jangan gunakan `service_role` key.
3. Masuk di `/admin/` memakai akun admin Supabase yang sudah dibuat. Pengguna tanpa role `admin` tidak dapat menerbitkan artikel atau mengunggah gambar.

File `supabase/.env` tidak ikut dikirim ke GitHub Pages; workflow mengecualikan folder konfigurasi Supabase dan semua file `.env` dari artefak publikasi.

## Catatan penting

- Semua tautan menggunakan path relatif (`computeRel`) sehingga tidak bergantung pada base path absolut.
- `social.instagram` masih placeholder (`https://instagram.com/`) hingga akun resmi dikonfirmasi.
- Nomor WhatsApp KOMPAN adalah `+62 858-5521-6681`.
- `favicon.svg` dan `apple-touch-icon.png` belum tersedia di repo; ini adalah masalah aset yang sudah ada sebelumnya, bukan tautan rusak.
