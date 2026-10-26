# KOMPAN — Komunitas Padhang Njingglang

Situs multi-halaman berbahasa Indonesia. Database artikel, role admin, dan unggahan gambar kini disimpan di SQLite pada laptop ini.

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

## Menjalankan situs dan database lokal

```bash
python3 local_app.py init
python3 local_app.py serve
```

Buka `http://127.0.0.1:8080/`. Dashboard admin ada di `http://127.0.0.1:8080/admin/`. Database SQLite dan gambar unggahan tersimpan di `~/.local/share/kompan/`, di luar folder situs.

Saat pertama kali dijalankan, data artikel dan kegiatan dari `content/` dimasukkan ke SQLite. Jika kredensial admin lama ada di file lokal `supabase/.env`, akun admin dibuat dengan kata sandi yang di-hash; file `.env` tidak dikirim ke website. Buat admin baru jika belum ada dengan `python3 local_app.py create-admin`. Atur ulang kata sandi dengan `python3 local_app.py reset-admin-password EMAIL`.

Database lokal mencakup profil/role, artikel, kegiatan, media, komentar, pengaturan situs, sesi login, dan arsip baris dari migrasi Supabase. Login hanya admin; server hanya menerima koneksi dari laptop ini.

Jika jaringan ke project Supabase tersedia kembali dan data remote perlu disalin, jalankan `python3 local_app.py migrate-supabase`. Perintah itu membuat salinan lokal tanpa menghapus atau mengubah database remote. Saat ini koneksi ke host Supabase belum berhasil, jadi migrasi otomatis mengambil konten lokal dari Markdown; baris remote yang belum terjangkau belum tersalin.

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

Di dashboard, admin dapat mengunggah JPG/PNG/WebP hingga 5 MB, mengisi judul dan isi, lalu menerbitkan artikel. Artikel tersimpan di database SQLite lokal dan muncul di Beranda serta halaman Artikel saat situs dibuka melalui server lokal.

GitHub Pages tetap menayangkan versi statis dan tidak dapat membaca database di laptop. Dashboard lokal tidak disertakan dalam artefak GitHub Pages.

## Catatan penting

- Semua tautan menggunakan path relatif (`computeRel`) sehingga tidak bergantung pada base path absolut.
- `social.instagram` masih placeholder (`https://instagram.com/`) hingga akun resmi dikonfirmasi.
- Nomor WhatsApp KOMPAN adalah `+62 858-5521-6681`.
- `favicon.svg` dan `apple-touch-icon.png` belum tersedia di repo; ini adalah masalah aset yang sudah ada sebelumnya, bukan tautan rusak.
