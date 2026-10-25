#!/usr/bin/env node
/**
 * Build script statis untuk KOMPAN.
 * Tidak memerlukan npm install.
 */
const fs = require("node:fs");
const path = require("node:path");
const mdParser = require("./markdown.js");
const { renderPage } = require("./layout.js");
const config = require("./site.config.js");

const listIntro = {
  kegiatan:
    "Agenda rutin KOMPAN: pameran, lokakarya literasi, dan kegiatan sosial bersama warga. Pilih satu kegiatan untuk melihat detail, jadwal, dan caraologías-CRASH.",
  berita:
    "Kabar, catatan, dan cerita dari perjalanan komunitas Padhang Jingglang sejak 2009.",
};

const ROOT = path.resolve(__dirname, "..");

function write(p, content) {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, content, "utf8");
}

function slugFromPath(fp) {
  return path.basename(fp, ".md");
}

function collectFiles(dir) {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".md") && !f.startsWith("."))
      .map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

/* ---------- Proses Markdown ---------- */
function buildFromMarkdown(dir, labelName, hrefPrefix) {
  const files = collectFiles(dir);
  const published = files.filter((fp) => {
    const { front } = mdParser.parseFrontmatter(fs.readFileSync(fp, "utf8"));
    return (front.status || "published") === "published";
  });
  const drafts = files.filter((fp) => {
    const { front } = mdParser.parseFrontmatter(fs.readFileSync(fp, "utf8"));
    return (front.status || "published") === "draft";
  });

  const items = published.map((fp) => {
    const { front, body } = mdParser.parseFrontmatter(
      fs.readFileSync(fp, "utf8"),
    );
    const slug = front.slug || slugFromPath(fp);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new Error(
        `Slug tidak valid: "${slug}" (file ${fp}). Slug hanya boleh huruf kecil, angka, dan tanda hubung.`,
      );
    }
    if (!front.title) throw new Error(`Frontmatter "title" wajib ada di ${fp}`);
    return {
      ...front,
      slug,
      description: front.excerpt || front.title,
      image: front.image || "",
      body: mdParser.markdownToHtml(body),
    };
  });

  // Deteksi slug bentrok (URL detail tidak boleh saling bertabrakan)
  const seen = new Set();
  for (const it of items) {
    if (seen.has(it.slug))
      throw new Error(`Slug duplikat pada ${labelName}: "${it.slug}"`);
    seen.add(it.slug);
  }

  // ---------- Halaman daftar: pencarian + filter kategori + pagination ----------
  const esc = (v) =>
    String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  // Kartu:_search_ dipakai mesin pencari sisi-klien, data-category untuk filter.
  const listHtml = items
    .map(
      (it) =>
        `<a data-search="${esc((it.title + " " + (it.description || "") + " " + (it.category || "")).toLowerCase())}" data-category="${esc(it.category || labelName)}" href="./${it.slug}/index.html" class="group block rounded-xl overflow-hidden bg-surface-container shadow-sm hover:shadow-md transition-all duration-300"><div class="h-48 sm:h-56 overflow-hidden"><img src="${esc(it.image)}" alt="${esc(it.title)}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/></div><div class="p-space-md flex flex-col gap-space-xs"><span class="font-label-sm text-label-sm bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full self-start">${esc(it.category || labelName)}</span><h3 class="font-headline-sm text-headline-sm text-on-surface font-semibold group-hover:text-primary transition-colors">${esc(it.title)}</h3><p class="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">${esc(it.description || "")}</p><div class="flex items-center justify-between mt-1"><span class="font-label-sm text-label-sm text-on-surface-variant">${esc(it.date || "")}</span><span class="font-label-sm text-label-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">Lihat detail &rarr;</span></div></div></a>`,
    )
    .join("\n");

  // Tombol filter kategori (hanya kategori yang benar-benar ada)
  const cats = Array.from(new Set(items.map((it) => it.category || labelName)));
  const catButtons = [
    `<button type="button" data-category-filter="all" aria-pressed="true" class="font-label-md text-label-md bg-primary-container text-on-primary px-4 py-2 rounded-full transition-colors hover:opacity-90">Semua</button>`,
    ...cats.map(
      (c) =>
        `<button type="button" data-category-filter="${esc(c)}" aria-pressed="false" class="font-label-md text-label-md bg-surface-container text-on-surface-variant px-4 py-2 rounded-full transition-colors hover:bg-surface-container-high">${esc(c)}</button>`,
    ),
  ].join("");

  const perPage = config.pagination[hrefPrefix] || 6;

  const listBody = `<section class="w-full bg-surface py-space-xl lg:py-24"><div class="max-w-[1280px] mx-auto px-margin-mobile md:px-margin">
    <div class="flex flex-col gap-space-xs mb-space-md">
      <div class="inline-flex items-center gap-1.5 text-primary font-label-sm text-label-sm font-bold uppercase tracking-wider"><span class="material-symbols-outlined text-[16px]">folder_special</span><span>${labelName}</span></div>
      <h1 class="font-headline-lg-mobile lg:font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-on-surface tracking-tight">Daftar ${labelName}</h1>
      <p class="font-body-md text-body-md text-on-surface-variant max-w-2xl">${esc(listIntro[hrefPrefix] || "")}</p>
    </div>

    <div class="flex flex-col gap-space-md mb-space-lg">
      <div class="flex flex-wrap items-center gap-space-xs" id="category-filters" role="group" aria-label="Filter kategori">${catButtons}</div>
      <div class="flex flex-col sm:flex-row sm:items-center gap-space-sm">
        <label class="sr-only" for="search-input">Cari ${labelName.toLowerCase()}</label>
        <div class="relative flex-1">
          <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant pointer-events-none">search</span>
          <input id="search-input" type="search" autocomplete="off" placeholder="Cari judul, ringkasan, atau kategori&hellip;" class="w-full font-body-md text-body-md pl-12 pr-4 py-3 rounded-full border border-outline-variant bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/40"/>
        </div>
        <p id="result-count" class="font-body-sm text-body-sm text-on-surface-variant whitespace-nowrap" role="status" aria-live="polite"></p>
      </div>
    </div>

    <div id="search-results" data-per-page="${perPage}">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-md">${listHtml}</div>
    </div>

    <p id="search-empty" class="hidden text-center font-body-md text-body-md text-on-surface-variant py-space-xl">Tidak ada ${labelName.toLowerCase()} yang cocok dengan pencarian atau filter ini. <button type="button" id="reset-filters" class="underline font-bold text-primary">Reset pencarian</button></p>

    <nav id="pagination" class="flex items-center justify-center gap-2 mt-space-xl" aria-label="Paginasi ${labelName}"></nav>
  </div></section>`;

  const listPage = renderPage({
    title: `Daftar ${labelName} — KOMPAN`,
    description:
      listIntro[hrefPrefix] ||
      `Daftar ${labelName} Komunitas Padhang Jingglang`,
    depth: 1,
    body: listBody,
    activeNav: hrefPrefix === "kegiatan" ? "kegiatan" : "berita",
  });

  write(path.join(ROOT, hrefPrefix, "index.html"), listPage);

  // Detail pages
  items.forEach((it) => {
    const detailHtml = `<section class="w-full bg-surface py-space-xl lg:py-24"><div class="max-w-[1280px] mx-auto px-margin-mobile md:px-margin"><a href="../index.html" class="inline-flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant hover:text-primary mb-space-md"><span class="material-symbols-outlined text-[16px]">arrow_back</span> Kembali ke daftar ${labelName}</a><div class="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm"><img src="${it.image}" alt="${it.title}" loading="lazy" class="w-full h-64 sm:h-80 object-cover"/><div class="p-space-lg sm:p-space-xl flex flex-col gap-space-sm"><span class="font-label-sm text-label-sm bg-secondary-container text-on-secondary-container px-2.5 py-0.5 rounded-full self-start">${it.category || labelName}</span><h2 class="font-headline-lg-mobile lg:font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-on-surface tracking-tight">${it.title}</h2><div class="flex items-center gap-space-sm text-on-surface-variant font-label-sm text-label-sm"><span>${it.date || ""}</span><span>•</span><span>${it.author || "Tim KOMPAN"}</span></div><div class="pt-space-md border-t border-outline-variant">${it.body}</div></div></div></div></section>`;
    const page = renderPage({
      title: it.title,
      description: it.description || it.title,
      depth: hrefPrefix ? 2 : 1,
      body: detailHtml,
      activeNav:
        hrefPrefix === "kegiatan/"
          ? "kegiatan"
          : hrefPrefix === "berita/"
            ? "berita"
            : "beranda",
    });
    write(path.join(ROOT, hrefPrefix, it.slug, "index.html"), page);
  });

  console.log(
    `Built: ${labelName} (${items.length} published, ${drafts.length} drafts excluded)`,
  );
}

/* ---------- 2. Build lists + details ---------- */
buildFromMarkdown(
  path.join(ROOT, "content", "kegiatan"),
  "Kegiatan",
  "kegiatan",
);
buildFromMarkdown(path.join(ROOT, "content", "berita"), "Berita", "berita");

/* ---------- 3. Static pages ---------- */
const STATIC_ACTIVE_NAV = {
  tentang: "tentang",
  organisasi: "tentang",
  galeri: "galeri",
  kontak: "kontak",
  "kebijakan-privasi": "beranda",
  404: "beranda",
};

function makeStaticPage(name, title, depth, bodyContent) {
  const page = renderPage({
    title,
    description: title + " — KOMPAN Komunitas Padhang Jingglang",
    depth,
    body: bodyContent,
    activeNav: STATIC_ACTIVE_NAV[name] || "beranda",
  });
  write(path.join(ROOT, name + ".html"), page);
}

// index.html TIDAK dihasilkan oleh build: file ini adalah sumber desain utama
// yang dipelihara manual. Build hanya memvalidasinya.
if (!fs.existsSync(path.join(ROOT, "index.html"))) {
  console.error(
    "ERROR: index.html hilang. Dipulihkan dari git: git checkout -- index.html",
  );
  process.exit(1);
}

makeStaticPage(
  "tentang",
  "Tentang Kami — Jejak Perjalanan",
  0,
  `<section class="w-full bg-surface py-space-xl lg:py-24" id="tentang-kami"><div class="max-w-[1280px] mx-auto px-margin-mobile md:px-margin"><h2 class="font-headline-lg text-headline-lg text-on-surface tracking-tight mb-space-lg">Bertumbuh Bersama Sejak 2009</h2><p class="font-body-md text-body-md text-on-surface-variant leading-relaxed max-w-3xl">Kata <strong>Padhang Jingglang</strong> berarti terang benderang tanpa halangan. Sejak 2009, komunitas ini menyediakan ruang belajar alternatif yang bebas kompetisi, mengedepankan kreativitas otentik, kebersamaan inklusif, kebahagiaan anak, dan pendidikan humanis.</p><div class="grid grid-cols-2 lg:grid-cols-4 gap-space-md mt-space-lg"><div class="bg-surface-container-low p-space-md rounded-lg shadow-sm"><span class="font-display-hero-mobile text-display-hero-mobile text-primary font-bold">15+</span><span class="font-label-md text-label-md text-on-surface font-semibold block mt-1">Tahun Mengabdi</span></div><div class="bg-surface-container-low p-space-md rounded-lg shadow-sm"><span class="font-display-hero-mobile text-display-hero-mobile text-secondary font-bold">50+</span><span class="font-label-md text-label-md text-on-surface font-semibold block mt-1">Pameran & Workshop</span></div><div class="bg-surface-container-low p-space-md rounded-lg shadow-sm"><span class="font-display-hero-mobile text-display-hero-mobile text-tertiary font-bold">1.000+</span><span class="font-label-md text-label-md text-on-surface font-semibold block mt-1">Anak Berkarya</span></div><div class="bg-surface-container-low p-space-md rounded-lg shadow-sm"><span class="font-display-hero-mobile text-display-hero-mobile text-primary-container font-bold">100%</span><span class="font-label-md text-label-md text-on-surface font-semibold block mt-1">Guyub & Mandiri</span></div></div></div></section>`,
);

makeStaticPage(
  "organisasi",
  "Struktur Organisasi — KOMPAN",
  0,
  `<section class="w-full bg-surface py-space-xl lg:py-24"><div class="max-w-[1280px] mx-auto px-margin-mobile md:px-margin"><h2 class="font-headline-lg text-headline-lg text-on-surface tracking-tight mb-space-lg">Struktur Organisasi</h2><p class="font-body-md text-body-md text-on-surface-variant leading-relaxed max-w-2xl">Komunitas Padhang Jingglang digerakkan oleh gotong royong warga, seniman, pendidik, dan relawan. Struktur sederhana ini memastikan setiap suara anak didengarkan dan setiap inisiatif tetap inklusif.</p><div class="grid grid-cols-1 md:grid-cols-3 gap-space-md mt-space-lg"><div class="bg-surface-container-low p-space-md rounded-lg shadow-sm"><span class="font-label-lg text-label-lg text-on-surface font-bold">Penggerak</span><p class="font-body-sm text-body-sm text-on-surface-variant mt-2">Relawan seni, pendongeng, dan pengajar yang berdedikasi sejak 2009.</p></div><div class="bg-surface-container-low p-space-md rounded-lg shadow-sm"><span class="font-label-lg text-label-lg text-on-surface font-bold">Relawan</span><p class="font-body-sm text-body-sm text-on-surface-variant mt-2">Orang tua, mahasiswa, dan perajin lokal yang menyumbangkan waktu.</p></div><div class="bg-surface-container-low p-space-md rounded-lg shadow-sm"><span class="font-label-lg text-label-lg text-on-surface font-bold">Mitra</span><p class="font-body-sm text-body-sm text-on-surface-variant mt-2">Sekolah, perpustakaan, dan komunitas sekitar yang berkolaborasi rutin.</p></div></div></div></section>`,
);

makeStaticPage(
  "galeri",
  "Galeri Dokumentasi — KOMPAN",
  0,
  `<section class="w-full bg-surface py-space-xl lg:py-24" id="galeri"><div class="max-w-[1280px] mx-auto px-margin-mobile md:px-margin"><h2 class="font-headline-lg text-headline-lg text-on-surface tracking-tight">Goresan &amp; Momen Ceria</h2><p class="font-body-md text-body-md text-on-surface-variant mt-space-xs max-w-xl">Kumpulan momen autentik, tawa murni, dan ekspresi warna-warni yang terekam dalam setiap helatan Komunitas Padhang Jingglang.</p><div id="gallery-filters" class="flex flex-wrap gap-space-xs mb-space-lg" role="group" aria-label="Filter kategori"><button onclick="filterGallery('all',this)" class="gallery-tab bg-primary-container text-on-primary font-label-md text-label-md px-4 py-1.5 rounded-full" aria-pressed="true">Semua</button><button onclick="filterGallery('pameran',this)" class="gallery-tab bg-surface-container text-on-surface-variant font-label-md text-label-md px-4 py-1.5 rounded-full" aria-pressed="false">Pameran</button><button onclick="filterGallery('lokakarya',this)" class="gallery-tab bg-surface-container text-on-surface-variant font-label-md text-label-md px-4 py-1.5 rounded-full" aria-pressed="false">Lokakarya</button><button onclick="filterGallery('sosial',this)" class="gallery-tab bg-surface-container text-on-surface-variant font-label-md text-label-md px-4 py-1.5 rounded-full" aria-pressed="false">Sosial</button></div><div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-space-md"><button onclick="openLightbox('https://lh3.googleusercontent.com/aida-public/AB6AXuCY-Bw5_XLivatFhq7TXIMhUSpayNeRSMRh-gU-CitE05kVSWvf0Mllh645ribUfH9G0GTYZPofSuG0sLqoVo9tfctBD9E-8Oh6NKQKx5eN6mT3snnHtSGh3IVuCgMxKKdiYMW7omrMqboPqgtLm1HUtSu3UFz2OOU5qYvug7Adloq-IhXMAZv6MCIdq-p3T5158l3jKhmBuoLG-HQqlh0qt7PyF86E43mLqo4PmLIqRRx-DXQAQJSP','Pameran ART FEST','Pameran','Karya murni anak dalam pameran seni rupa tahunan.')" class="gallery-item block relative w-full rounded-xl overflow-hidden shadow-sm group" data-category="pameran"><img class="w-full h-72 object-cover group-hover:scale-105 transition-transform duration-500" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCY-Bw5_XLivatFhq7TXIMhUSpayNeRSMRh-gU-CitE05kVSWvf0Mllh645ribUfH9G0GTYZPofSuG0sLqoVo9tfctBD9E-8Oh6NKQKx5eN6mT3snnHtSGh3IVuCgMxKKdiYMW7omrMqboPqgtLm1HUtSu3UFz2OOU5qYvug7Adloq-IhXMAZv6MCIdq-p3T5158l3jKhmBuoLG-HQqlh0qt7PyF86E43mLqo4PmLIqRRx-DXQAQJSP" alt="Pameran ART FEST" loading="lazy"/><div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div><span class="absolute bottom-3 left-3 text-white font-label-md">Pameran ART FEST</span></button><button onclick="openLightbox('https://lh3.googleusercontent.com/aida-public/AB6AXuB8waW2N3HKGtrMzYe5cGPHB11lZlUJqa7KkvlYOw71qzznOex2iNkdHGKQ0GZJgwSZu90GLvPNIMiLG2eTHFBnSE1wyoVdkayrKwPh_oK2Zf4OeGUTjkwn5Dg3xKR5LVEcacFY9_OKo7jMsWMw5Y6Q_R0bBRFi8bEGuQYIpRsJJW9jYc5j29v8vTxQrv_xt_l9L-EhYKfe0_2GRvqWscWm8xgfBa6OiUvqODQdBCPuwLb5o7y2u74D','Revitalisasi Ruang Main','Sosial','Ruang bermain diperbaiki bersama warga.')" class="gallery-item block relative w-full rounded-xl overflow-hidden shadow-sm group" data-category="sosial"><img class="w-full h-72 object-cover group-hover:scale-105 transition-transform duration-500" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB8waW2N3HKGtrMzYe5cGPHB11lZlUJqa7KkvlYOw71qzznOex2iNkdHGKQ0GZJgwSZu90GLvPNIMiLG2eTHFBnSE1wyoVdkayrKwPh_oK2Zf4OeGUTjkwn5Dg3xKR5LVEcacFY9_OKo7jMsWMw5Y6Q_R0bBRFi8bEGuQYIpRsJJW9jYc5j29v8vTxQrv_xt_l9L-EhYKfe0_2GRvqWscWm8xgfBa6OiUvqODQdBCPuwLb5o7y2u74D" alt="Revitalisasi Ruang Main" loading="lazy"/><div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div><span class="absolute bottom-3 left-3 text-white font-label-md">Revitalisasi Ruang Main</span></button><button onclick="openLightbox('https://lh3.googleusercontent.com/aida-public/AB6AXuCto_B097-1x-yi9I3LQMYtmNo4VTs8YHUPKPMtHhCe7XGY7fhetEY7LJo_4F30WwWPat2233t8S-t4xW-sho0_lD3yZyyZd7aKIHsWLaf_26q8W4a5J_f-zgt-6RQq8qV7dRt9cSXvjW3LSkBreZceVnyUb7V_RVgKZEDk_rKHBWqvXGe3i9F3MOt2nLk9l4W0A8N3nykI3jK2A9wQj9MP-6ayNRRxBK3n9ggeut4rnp_EeyXSPcOmS6MjQme09ZXhpRLCla3WeRS9lXlwY6PARiliFwepEpdBkOspoqYAjlijFnn-vsNOh5-A4PHeHdleSgxIt2BdNjSeUUnT7T9UCgkAqAKnmGDP9y','Festival Semarak Padang','Pameran','Festival tahunan dengan karnaval topeng.')" class="gallery-item block relative w-full rounded-xl overflow-hidden shadow-sm group" data-category="pameran"><img class="w-full h-72 object-cover group-hover:scale-105 transition-transform duration-500" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCto_B097-1x-yi9I3LQMYtmNo4VTs8YHUPKPMtHhCe7XGY7fhetEY7LJo_4F30WwWPat2233t8S-t4xW-sho0_lD3yZyyZd7aKIHsWLaf_26q8W4a5J_f-zgt-6RQq8qV7dRt9cSXvjW3LSkBreZceVnyUb7V_RVgKZEDk_rKHBWqvXGe3i9F3MOt2nLk9l4W0A8N3nykI3jK2A9wQj9MP-6ayNRRxBK3n9ggeut4rnp_EeyXSPcOmS6MjQme09ZXhpRLCla3WeRS9lXlwY6PARiliFwepEpdBkOspoqYAjlijFnn-vsNOh5-A4PHeHdleSgxIt2BdNjSeUUnT7T9UCgkAqAKnmGDP9y" alt="Festival Semarak Padang" loading="lazy"/><div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div><span class="absolute bottom-3 left-3 text-white font-label-md">Festival Semarak Padang</span></button></div><div id="lightbox-modal" class="hidden fixed inset-0 z-[60] bg-black/80 backdrop-blur-md items-center justify-center p-4" aria-hidden="true" role="dialog" aria-modal="true" aria-label="Tampilan besar foto galeri"><button data-lightbox-close aria-label="Tutup tampilan besar" class="absolute top-4 right-4 w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"><span class="material-symbols-outlined text-[24px]">close</span></button><img id="lightbox-img" src="" alt="" class="max-w-full max-h-[80vh] rounded-xl shadow-2xl object-contain"/><div class="absolute bottom-6 left-0 w-full text-center px-4"><h3 id="lightbox-title" class="font-headline-md text-headline-md text-white"></h3><p id="lightbox-category" class="font-label-sm text-label-sm text-white/80"></p><p id="lightbox-desc" class="font-body-sm text-body-sm text-white/70"></p></div></div></div></section>`,
);

makeStaticPage(
  "kontak",
  "Kontak — KOMPAN",
  0,
  `<section class="w-full bg-surface py-space-xl lg:py-24" id="tentang-kami"><div class="max-w-[1280px] mx-auto px-margin-mobile md:px-margin"><h2 class="font-headline-lg text-headline-lg text-on-surface tracking-tight">Hubungi KOMPAN</h2><p class="font-body-md text-body-md text-on-surface-variant max-w-xl mt-space-xs">Kami senang mendengar dari Anda. Kirim pesan melalui formulir berikut atau langsung ke email kami.</p><form id="contact-form" class="grid grid-cols-1 md:grid-cols-2 gap-space-md mt-space-lg bg-surface-container-low p-space-md rounded-xl shadow-sm"><div class="flex flex-col gap-space-xs"><label for="nama" class="font-label-md text-label-md text-on-surface">Nama</label><input id="nama" name="nama" type="text" required class="font-body-md text-body-md p-3 rounded-lg bg-surface border border-outline-variant text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40" placeholder="Nama Anda"/></div><div class="flex flex-col gap-space-xs"><label for="email" class="font-label-md text-label-md text-on-surface">Email</label><input id="email" name="email" type="email" required class="font-body-md text-body-md p-3 rounded-lg bg-surface border border-outline-variant text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40" placeholder="email@anda.com"/></div><div class="md:col-span-2 flex flex-col gap-space-xs"><label for="pesan" class="font-label-md text-label-md text-on-surface">Pesan</label><textarea id="pesan" name="pesan" rows="4" required class="font-body-md text-body-md p-3 rounded-lg bg-surface border border-outline-variant text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40" placeholder="Tulis pesan Anda..."></textarea></div><div class="md:col-span-2"><button type="submit" class="inline-flex items-center gap-2 bg-primary-container text-on-primary font-label-lg text-label-lg px-6 py-3 rounded-full hover:bg-primary transition-all shadow-sm">Kirim Pesan <span class="material-symbols-outlined text-[18px]">arrow_forward</span></button></div></form><p id="contact-message" class="hidden mt-space-sm font-body-md text-body-md text-on-surface-variant"></p></div></section>`,
);

makeStaticPage(
  "kebijakan-privasi",
  "Kebijakan Privasi — KOMPAN",
  0,
  `<section class="w-full bg-surface py-space-xl lg:py-24"><div class="max-w-[1280px] mx-auto px-margin-mobile md:px-margin"><h2 class="font-headline-lg text-headline-lg text-on-surface tracking-tight mb-space-lg">Kebijakan Privasi</h2><div class="font-body-md text-body-md text-on-surface-variant leading-relaxed space-y-3 max-w-3xl"><p>KOMPAN tidak mengumpulkan data pribadi pengunjung tanpa izin eksplisit. Formulir kontak hanya digunakan untuk membalas pesan Anda.</p><p>Cookie pihak ketiga (Fouita widget) mungkin digunakan untuk menampilkan konten Instagram; silakan periksa kebijakan privasi Fouita secara terpisah.</p><p>Foto karya anak dipasang dengan persetujuan orang tua atau wali.</p></div></div></section>`,
);

makeStaticPage(
  "404",
  "Halaman Tidak Ditemukan — KOMPAN",
  0,
  `<section class="w-full bg-surface py-space-xl lg:py-24 min-h-[calc(100vh-200px)]"><div class="max-w-[1280px] mx-auto px-margin-mobile md:px-margin text-center"><h1 class="font-display-hero text-display-hero text-on-surface tracking-tight">404</h1><p class="font-headline-md text-headline-md text-on-surface-variant mt-space-md">Halaman yang Anda cari tidak ditemukan.</p><a href="./index.html" class="inline-flex items-center gap-2 mt-space-lg bg-primary-container text-on-primary font-label-lg text-label-lg px-6 py-3 rounded-full hover:bg-primary transition-all shadow-sm">Kembali ke Beranda <span class="material-symbols-outlined text-[18px]">arrow_back</span></a></div></section>`,
);

console.log(
  "Static pages built: beranda (index), tentang, organisasi, galeri, kontak, kebijakan-privasi, 404",
);

/* ---------- 4. Check links (simple HTML parser approach) ---------- */
function checkLinks() {
  const allFiles = fs
    .readdirSync(ROOT, { recursive: true })
    .map((file) => path.join(ROOT, String(file)))
    .filter((p) => p.endsWith(".html"));
  let broken = 0;
  for (const file of allFiles) {
    const html = fs.readFileSync(file, "utf8");
    const links = html.match(/href="([^"]+)"/g) || [];
    for (const linkStr of links) {
      const href = linkStr.replace(/href="/, "").replace(/"/, "");
      if (href.startsWith("http")) continue; // external ok
      if (href.startsWith("#")) continue; // anchor ok (internal to same page)
      if (href.startsWith("mailto:") || href.startsWith("tel:")) continue;
      // Resolve relative
      const baseDir = path.dirname(file);
      const target = path.resolve(baseDir, href);
      const targetFile = target.endsWith("/") ? target + "index.html" : target;
      if (!fs.existsSync(targetFile)) {
        console.log("BROKEN: " + file + " -> " + href);
        broken++;
      }
    }
  }
  console.log("Link check complete. Broken: " + broken);
}

checkLinks();
