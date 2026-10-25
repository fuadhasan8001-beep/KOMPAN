/** * Konfigurasi global situs KOMPAN – Komunitas Padhang Jingglang. * * File
ini adalah SATU-SATUNYA sumber kebenaran untuk: * - identitas situs (nama,
deskripsi, domain), * - tautan media sosial & kontak, * - daftar item navigasi
utama. * * Semua halaman (statis maupun hasil build Markdown) mengambil data
dari sini, * sehingga tidak ada lagi tautan yang ditulis manual per halaman. */
const site = { name: "KOMPAN", fullName: "Komunitas Padhang Jingglang", tagline:
"Ruang belajar alternatif, seni rupa, literasi dan kebahagiaan anak-anak
Nusantara sejak 2009.", description: "KOMPAN – Komunitas Padhang Jingglang,
ruang belajar alternatif, seni rupa, literasi dan kebahagiaan anak-anak
Nusantara sejak 2009.", locale: "id_ID", lang: "id", // Domain custom. Kosongkan
bila hanya dipakai pada URL repository GitHub Pages. customDomain:
"kompan.or.id", // Disediakan otomatis oleh workflow: dipanggil dengan
--base=/<nama-repo>
  basePath: "/", }; /** * Tautan eksternal. * * PENTING: `instagram` masih
  berupa placeholder. Akun resmi Padhang Jingglang * belum dikonfirmasi, jadi
  jangan dianggap sudah benar sebelum dikonfirmasi * lewat dashboard Fouita /
  hackedown. Ubah hanya di satu tempat ini. */ const social = { instagram:
  "https://instagram.com/", // TODO(konfirmasi): ganti dengan handle resmi
  Padhang Jingglang email: "kontak@kompan.org", whatsapp:
  "https://wa.me/6285855216681", }; /** * Navigasi utama. `key` dipakai untuk
  menandai halaman aktif (aria-current). * `href` relatif terhadap root situs
  agar bekerja pada domain custom maupun * pada URL bawaan repository GitHub
  Pages (/<nama-repo
    >/). */ const nav = [ { key: "beranda", label: "Beranda", href: "index.html"
    }, { key: "tentang", label: "Tentang Kami", href: "tentang.html" }, { key:
    "kegiatan", label: "Kegiatan", href: "kegiatan/" }, { key: "berita", label:
    "Berita", href: "berita/" }, { key: "galeri", label: "Galeri", href:
    "galeri.html" }, { key: "kontak", label: "Kontak", href: "kontak.html" }, ];
    /** Halaman pendukung yang hanya muncul di footer. */ const footerNav = [ {
    label: "Tentang Kami", href: "tentang.html" }, { label: "Struktur
    Organisasi", href: "organisasi.html" }, { label: "Daftar Kegiatan", href:
    "kegiatan/" }, { label: "Daftar Berita", href: "berita/" }, { label: "Galeri
    Dokumentasi", href: "galeri.html" }, { label: "Kebijakan Privasi", href:
    "kebijakan-privasi.html" }, { label: "Kontak", href: "kontak.html" }, ]; /**
    Alamat & jam layanan yang ditampilkan pada halaman kontak & footer. */ const
    contact = { email: social.email, whatsapp: social.whatsapp, address:
    "Sanggar Padhang Jingglang, Yogyakarta, Jawa Timur, Indonesia", hours:
    "Senin–Sabtu, 09.00–16.00 WIB (dengan janji temu)", mapsQuery: "Padhang
    Jingglang, Yogyakarta", }; /** Pengaturan pagination untuk halaman daftar.
    */ const pagination = { kegiatan: 3, berita: 3, }; module.exports = { site,
    social, nav, footerNav, contact, pagination };
  </nama-repo></nama-repo
>
