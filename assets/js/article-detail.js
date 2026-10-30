(() => {
  const container = document.getElementById("live-article-detail");
  if (!container) return;

  const params = new URLSearchParams(location.search);
  const driveId = params.get("drive");
  const collection = params.get("collection") === "highlights" ? "highlights" : "archive";

  function renderArticle(article, backHref, fallbackCategory) {
    container.replaceChildren();

    const back = document.createElement("a");
    back.href = backHref;
    back.className = "inline-flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant hover:text-primary mb-space-md";
    back.textContent = "← Kembali";

    const card = document.createElement("article");
    card.className = "overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm";
    if (article.image) {
      const image = document.createElement("img");
      image.src = article.image;
      image.alt = `Gambar artikel: ${article.title}`;
      image.className = "w-full max-h-[520px] object-cover";
      card.append(image);
    }

    const body = document.createElement("div");
    body.className = "p-space-lg sm:p-space-xl";
    const category = document.createElement("span");
    category.className = "font-label-sm text-label-sm bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full";
    category.textContent = article.category || fallbackCategory || "Artikel";
    const title = document.createElement("h1");
    title.className = "mt-4 font-headline-lg-mobile lg:font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-on-surface tracking-tight";
    title.textContent = article.title;
    const meta = document.createElement("p");
    meta.className = "mt-3 font-label-sm text-label-sm text-on-surface-variant";
    meta.textContent = `${article.date || ""}${article.author ? ` · ${article.author}` : ""}`;
    const content = document.createElement("div");
    content.className = "mt-6 border-t border-outline-variant pt-6 font-body-md text-body-md text-on-surface-variant leading-relaxed whitespace-pre-line";
    content.textContent = article.content || "";
    body.append(category, title, meta, content);

    if (article.url && /^https:\/\//i.test(article.url)) {
      const more = document.createElement("a");
      more.href = article.url;
      more.target = "_blank";
      more.rel = "noopener noreferrer";
      more.className = "inline-flex mt-6 font-label-md text-label-md text-primary font-bold";
      more.textContent = "Lihat tautan terkait ↗";
      body.append(more);
    }

    card.append(body);
    container.append(back, card);
    document.title = `${article.title} — KOMPAN`;
  }

  if (driveId) {
    const config = window.KOMPAN_CONTENT_API || {};
    if (!config.url) {
      container.textContent = "Sumber artikel Drive belum dikonfigurasi.";
      return;
    }

    const callbackName = `kompanArticleCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => finish(), 12000);
    let finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (payload) => {
      finish();
      const items = payload && Array.isArray(payload[collection]) ? payload[collection] : [];
      const item = items.find((entry) => String(entry.id) === driveId);
      if (!payload || payload.ok !== true || !item) {
        container.textContent = "Artikel tidak ditemukan atau belum diterbitkan.";
        return;
      }
      const section = collection === "highlights" ? "#sorotan" : "#arsip";
      renderArticle({
        title: item.judul,
        category: item.label || item.tahun,
        date: item.tanggal || item.tahun,
        image: item.gambar,
        content: item.isi || item.deskripsi,
        url: item.url,
      }, `../index.html${section}`, "KOMPAN");
    };
    script.onerror = () => {
      finish();
      container.textContent = "Artikel belum dapat dimuat. Coba muat ulang halaman.";
    };
    script.src = `${config.url}${config.url.includes("?") ? "&" : "?"}callback=${encodeURIComponent(callbackName)}`;
    document.head.appendChild(script);
    return;
  }

  const slug = params.get("slug");
  if (!slug) {
    container.textContent = "Artikel tidak tersedia.";
    return;
  }

  fetch(`/api/articles?slug=${encodeURIComponent(slug)}`, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("Artikel tidak ditemukan.");
      return response.json();
    })
    .then(({ article }) => {
      if (!article) throw new Error("Artikel tidak ditemukan.");
      renderArticle({
        title: article.title,
        category: article.category,
        date: article.date,
        author: article.author,
        image: article.image,
        content: article.content,
        url: article.url,
      }, "./index.html");
    })
    .catch((error) => {
      container.textContent = error.message || "Artikel tidak ditemukan.";
    });
})();
