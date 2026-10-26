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
  artikel:
    "Artikel, kabar, dan cerita dari perjalanan Komunitas Padhang Njingglang sejak 2009.",
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

  const liveArticleSection =
    hrefPrefix === "artikel"
      ? `<section id="live-articles-section" data-live-articles-section class="mt-space-xl" hidden><h2 class="font-headline-md text-headline-md text-on-surface mb-space-md">Artikel terbaru dari KOMPAN</h2><div id="live-article-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-md"></div></section>`
      : "";
  const articleScripts =
    hrefPrefix === "artikel"
      ? `<script src="../assets/js/supabase-config.js" defer></script><script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2" defer></script><script src="../assets/js/articles-live.js" defer></script>`
      : "";

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

    ${liveArticleSection}

    <p id="search-empty" class="hidden text-center font-body-md text-body-md text-on-surface-variant py-space-xl">Tidak ada ${labelName.toLowerCase()} yang cocok dengan pencarian atau filter ini. <button type="button" id="reset-filters" class="underline font-bold text-primary">Reset pencarian</button></p>

    <nav id="pagination" class="flex items-center justify-center gap-2 mt-space-xl" aria-label="Paginasi ${labelName}"></nav>
  </div></section>`;

  const listPage = renderPage({
    title: `Daftar ${labelName} — KOMPAN`,
    description:
      listIntro[hrefPrefix] ||
      `Daftar ${labelName} Komunitas Padhang Njingglang`,
    depth: 1,
    body: listBody,
    activeNav: hrefPrefix === "kegiatan" ? "kegiatan" : "artikel",
    extraScripts: articleScripts,
  });

  write(path.join(ROOT, hrefPrefix, "index.html"), listPage);

  if (hrefPrefix === "artikel") {
    const liveDetailBody = `<section class="w-full bg-surface py-space-xl lg:py-24"><div class="max-w-4xl mx-auto px-margin-mobile md:px-margin"><div id="live-article-detail" class="text-on-surface-variant" aria-live="polite">Memuat artikel…</div></div></section>`;
    const liveDetailPage = renderPage({
      title: "Artikel — KOMPAN",
      description: "Artikel terbaru Komunitas Padhang Njingglang.",
      depth: 1,
      body: liveDetailBody,
      activeNav: "artikel",
      extraScripts: `<script src="../assets/js/supabase-config.js" defer></script><script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2" defer></script><script src="../assets/js/article-detail.js" defer></script>`,
    });
    write(path.join(ROOT, "artikel", "baca.html"), liveDetailPage);
  }

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
          : hrefPrefix === "artikel/"
            ? "artikel"
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
buildFromMarkdown(path.join(ROOT, "content", "artikel"), "Artikel", "artikel");

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
    description: title + " — KOMPAN Komunitas Padhang Njingglang",
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
  "Tentang Kami — KOMPAN",
  0,
  `<section class="w-full bg-surface py-space-xl lg:py-24" id="tentang-kami">
    <div class="max-w-[1280px] mx-auto px-margin-mobile md:px-margin">
      <h2 class="font-headline-lg text-headline-lg text-on-surface tracking-tight mb-space-lg">Berawal dari Kepedulian terhadap Dunia Anak</h2>
      <div class="font-body-md text-body-md text-on-surface-variant leading-relaxed max-w-4xl space-y-4">
        <p>Komunitas Padhang Njingglang didirikan pada 2009 oleh Anang Prasetyo, seorang seniman sekaligus pendidik. KOMPAN lahir dari kegelisahan terhadap pergeseran dunia anak: dari permainan tradisional yang bersifat sosial dan komunal menuju permainan digital modern yang lebih individual.</p>
        <p>KOMPAN menjadi wadah bagi generasi muda yang peduli terhadap perkembangan generasi bangsa. Kegiatan rutinnya mencakup pemberdayaan sosial serta pelatihan bagi mahasiswa untuk menjadi pecinta dan pendidik anak melalui BCMK: bermain, cerita, menyanyi, dan kreativitas.</p>
        <p>Pada awalnya, kegiatan BCMK digelar di Alun-alun Tulungagung dan di base camp KOMPAN. Gerakan ini kemudian menjangkau anak-anak di Yogyakarta, Tuban, Batu, Kediri, dan Blitar. Melalui kegiatan tersebut, KOMPAN menjalankan AMB (Aktivasi Memori Bahagia).</p>
        <p>Sejumlah stasiun televisi lokal dan nasional, antara lain Trans Corp., RCTI, Metro TV, NET, AB, dan JTV, pernah meliput kegiatan KOMPAN. Pada 2021, pendirian perkumpulan Komunitas Padhang Njingglang disahkan melalui SK Menteri Hukum dan Hak Asasi Manusia Republik Indonesia No. AHU-0005818.AH.01.07.TH.2021, dengan notaris Fariz Firdaus, S.H., S.T., M.Kn.</p>
        <p>Pada 2025, KOMPAN memasuki usia ke-15. Ke depan, komunitas ini berharap dapat memberi manfaat lebih luas bagi pembinaan generasi bangsa, membantu menuntaskan permasalahan sosial, serta ikut mewujudkan Indonesia yang lebih maju, beradab, dan bermartabat.</p>
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-space-md mt-space-lg">
        <div class="bg-surface-container-low p-space-md rounded-lg shadow-sm"><span class="font-display-hero-mobile text-display-hero-mobile text-primary font-bold">2009</span><span class="font-label-md text-label-md text-on-surface font-semibold block mt-1">Tahun Berdiri</span></div>
        <div class="bg-surface-container-low p-space-md rounded-lg shadow-sm"><span class="font-display-hero-mobile text-display-hero-mobile text-secondary font-bold">BCMK</span><span class="font-label-md text-label-md text-on-surface font-semibold block mt-1">Metode Kegiatan</span></div>
        <div class="bg-surface-container-low p-space-md rounded-lg shadow-sm"><span class="font-display-hero-mobile text-display-hero-mobile text-tertiary font-bold">AMB</span><span class="font-label-md text-label-md text-on-surface font-semibold block mt-1">Aktivasi Memori Bahagia</span></div>
        <div class="bg-surface-container-low p-space-md rounded-lg shadow-sm"><span class="font-display-hero-mobile text-display-hero-mobile text-primary-container font-bold">2021</span><span class="font-label-md text-label-md text-on-surface font-semibold block mt-1">Pengesahan Perkumpulan</span></div>
      </div>
    </div>
  </section>`,
);

makeStaticPage(
  "organisasi",
  "Penggerak Komunitas — KOMPAN",
  0,
  `<section class="w-full bg-surface py-space-xl lg:py-24">
    <div class="max-w-[1280px] mx-auto px-margin-mobile md:px-margin">
      <h2 class="font-headline-lg text-headline-lg text-on-surface tracking-tight mb-space-lg">Penggerak dan Cara Kerja</h2>
      <p class="font-body-md text-body-md text-on-surface-variant leading-relaxed max-w-3xl">KOMPAN didirikan oleh Anang Prasetyo dan berkembang sebagai wadah bagi generasi muda yang peduli pada anak. Kegiatan komunitas dijalankan melalui pemberdayaan sosial, pelatihan BCMK, dan kerja bersama di berbagai kota.</p>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-space-md mt-space-lg">
        <div class="bg-surface-container-low p-space-md rounded-lg shadow-sm"><span class="font-label-lg text-label-lg text-on-surface font-bold">Pendiri</span><p class="font-body-sm text-body-sm text-on-surface-variant mt-2"><strong>Anang Prasetyo</strong>, seniman dan pendidik yang mendirikan KOMPAN pada 2009.</p></div>
        <div class="bg-surface-container-low p-space-md rounded-lg shadow-sm"><span class="font-label-lg text-label-lg text-on-surface font-bold">Generasi Muda</span><p class="font-body-sm text-body-sm text-on-surface-variant mt-2">KOMPAN menjadi ruang bagi anak muda yang peduli terhadap perkembangan dan kebahagiaan anak.</p></div>
        <div class="bg-surface-container-low p-space-md rounded-lg shadow-sm"><span class="font-label-lg text-label-lg text-on-surface font-bold">Pelatihan BCMK</span><p class="font-body-sm text-body-sm text-on-surface-variant mt-2">Mahasiswa dilatih menjadi pecinta dan pendidik anak melalui kegiatan bermain, cerita, menyanyi, dan kreativitas.</p></div>
      </div>
    </div>
  </section>`,
);

makeStaticPage(
  "galeri",
  "Galeri Dokumentasi — KOMPAN",
  0,
  `<section class="w-full bg-surface py-space-xl lg:py-24" id="galeri"><div class="max-w-[1280px] mx-auto px-margin-mobile md:px-margin"><div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-space-md mb-space-lg"><div><div class="font-label-sm text-label-sm font-bold uppercase tracking-wider text-primary mb-space-xs">Facebook Anang Prasetyo</div><h2 class="font-headline-lg text-headline-lg text-on-surface tracking-tight">Goresan &amp; Momen Ceria</h2><p class="font-body-md text-body-md text-on-surface-variant mt-space-xs max-w-xl">Postingan terbaru tentang kegiatan dan cerita KOMPAN, langsung dari profil Anang Prasetyo.</p></div><a href="https://www.facebook.com/anang.prasetyo.967" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center gap-2 rounded-full bg-primary-container text-on-primary px-5 py-3 font-label-md text-label-md">Lihat profil Facebook <span aria-hidden="true">↗</span></a></div><div data-facebook-feed class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-space-md" aria-live="polite"><p class="text-on-surface-variant">Memuat postingan terbaru…</p></div></div><script src="./assets/js/facebook-feed.js" defer></script></section>`,
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
