# Arsip dan Sorotan dari Google Drive

Situs mengambil metadata dari satu berkas `konten.json` di Google Drive. Foto juga disimpan di Drive. Google Sheets tidak digunakan. Perubahan pada JSON tampil saat pengunjung memuat ulang situs, tanpa deploy ulang GitHub Pages.

## Siapkan folder Drive

1. Buat folder Drive bernama `KOMPAN Konten`.
2. Upload foto ke folder itu. Untuk setiap foto yang dipakai situs, ubah akses berbagi menjadi **Siapa saja yang memiliki link — Viewer**.
3. Upload berkas `konten.json` dari folder ini ke folder Drive tersebut. Edit berkas itu menggunakan editor teks yang mendukung JSON (misalnya VS Code), lalu upload ulang versi terbaru setiap ada perubahan.
4. Salin ID folder dari URL Drive. URL biasanya berbentuk `https://drive.google.com/drive/folders/ID_FOLDER`; ID adalah bagian sesudah `/folders/`.

Di dalam `konten.json`, isi daftar `archive` dan `highlights`. Setiap item yang ingin ditampilkan harus memiliki `status` bernilai `terbit`; `draft` menyembunyikannya. Isi `gambar` dengan link berbagi Drive foto. Apps Script mengubah link itu menjadi link gambar otomatis. Untuk Arsip, `tahun` dan `judul` wajib diisi. Untuk Sorotan, `judul` wajib diisi. `isi` berisi cerita lengkap yang tampil setelah kartu dibuka; tulis paragraf dengan baris baru. Jika kosong, halaman detail menampilkan `deskripsi`. `url` boleh kosong.

## Sambungkan Apps Script ke folder

1. Buka proyek Apps Script yang sudah Anda terbitkan sebelumnya.
2. Ganti isi `Code.gs` dengan isi file `Code.gs` dari folder ini.
3. ID folder Drive Anda sudah diisi pada `DRIVE_FOLDER_ID` di kode.
4. Simpan. Pilih fungsi `authorizeDrive` dari daftar fungsi di editor, klik **Run**, lalu izinkan akses Drive.
5. Klik **Deploy → Manage deployments**, pilih deployment Web app Anda, klik ikon pensil, pilih **New version**, lalu **Deploy**. URL `/exec` tetap sama.

## Tampilkan di situs

URL Apps Script yang sudah dipasang di `assets/js/google-content-config.js` tetap digunakan. Buka situs dan muat ulang setelah perubahan pada Drive. Jika Arsip atau Sorotan belum tampil, pastikan nama file tepat `konten.json`, ID folder benar, foto dapat diakses dengan link, serta status item `terbit`.
