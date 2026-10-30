/* Optional public JSONP feed for archive and highlight cards. */
(function () {
  "use strict";

  const config = window.KOMPAN_CONTENT_API || {};
  if (!config.url || !/^https:\/\/script\.google\.com\/macros\/s\//.test(config.url)) return;

  const callbackName = `kompanContentCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const script = document.createElement("script");
  const timeout = window.setTimeout(() => finish(), 10000);
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
    if (!payload || payload.ok !== true || !Array.isArray(payload.archive) || !Array.isArray(payload.highlights)) return;
    renderArchive(payload.archive);
    renderHighlights(payload.highlights);
  };
  script.onerror = finish;
  script.src = `${config.url}${config.url.includes("?") ? "&" : "?"}callback=${encodeURIComponent(callbackName)}`;
  document.head.appendChild(script);

  function escapeText(value) {
    return String(value == null ? "" : value);
  }

  function safeUrl(value) {
    const url = escapeText(value).trim();
    return /^https:\/\//i.test(url) ? url : "";
  }

  function renderArchive(rows) {
    const grid = document.getElementById("archive-grid");
    if (!grid || rows.length === 0) return;
    const cards = rows.filter((row) => row.visible !== false && row.tahun && row.judul);
    if (!cards.length) return;
    grid.replaceChildren(...cards.map((row) => {
      const card = document.createElement("article");
      card.className = `archive-item ${escapeText(row.tahun)} bg-surface-container-lowest rounded-xl p-space-md shadow-sm hover:shadow-md transition-all flex flex-col justify-between`;
      card.dataset.year = escapeText(row.tahun);
      card.dataset.articleId = escapeText(row.id);
      const top = document.createElement("div");
      top.className = "flex items-start gap-space-sm";
      const imageUrl = safeUrl(row.gambar);
      if (imageUrl) {
        const media = document.createElement("div");
        media.className = "w-16 h-16 rounded-lg overflow-hidden bg-surface-container flex-shrink-0";
        const img = document.createElement("img");
        img.loading = "lazy";
        img.className = "w-full h-full object-cover";
        img.src = imageUrl;
        img.alt = escapeText(row.judul);
        media.append(img);
        top.append(media);
      }
      const copy = document.createElement("div");
      copy.className = "flex flex-col";
      const badge = document.createElement("span");
      badge.className = "font-label-sm text-label-sm bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full self-start mb-1";
      badge.textContent = escapeText(row.label || row.tahun);
      const title = document.createElement("h3");
      title.className = "font-headline-sm text-headline-sm text-on-surface font-semibold";
      title.textContent = escapeText(row.judul);
      const desc = document.createElement("p");
      desc.className = "font-body-sm text-body-sm text-on-surface-variant";
      desc.textContent = escapeText(row.deskripsi);
      copy.append(badge, title, desc);
      top.append(copy);
      const bottom = document.createElement("div");
      bottom.className = "pt-space-md flex items-center justify-between border-t border-outline-variant/30 mt-space-sm";
      const date = document.createElement("span");
      date.className = "font-label-sm text-label-sm text-on-surface-variant";
      date.textContent = escapeText(row.tanggal);
      bottom.append(date);
      const link = document.createElement("a");
      link.className = "font-label-md text-label-md text-primary font-bold hover:text-secondary";
      link.href = `artikel/baca.html?drive=${encodeURIComponent(row.id)}&collection=archive`;
      link.textContent = "Baca selengkapnya ↗";
      bottom.append(link);
      card.append(top, bottom);
      return card;
    }));
    const first = document.querySelector("#archive-years .archive-pill");
    if (first && typeof window.filterArchive === "function") window.filterArchive("all", first);
  }

  function renderHighlights(rows) {
    const grid = document.getElementById("highlights-grid");
    const section = document.getElementById("sorotan");
    if (!grid || !section || rows.length === 0) return;
    const cards = rows.filter((row) => row.visible !== false && row.judul);
    if (!cards.length) return;
    grid.replaceChildren(...cards.map((row) => {
      const card = document.createElement("article");
      card.className = "overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest shadow-sm";
      const imageUrl = safeUrl(row.gambar);
      if (imageUrl) {
        const img = document.createElement("img");
        img.loading = "lazy";
        img.className = "w-full h-52 object-cover";
        img.src = imageUrl;
        img.alt = escapeText(row.judul);
        card.append(img);
      }
      const body = document.createElement("div");
      body.className = "p-space-md";
      const title = document.createElement("h3");
      title.className = "font-headline-sm text-headline-sm text-on-surface font-semibold";
      title.textContent = escapeText(row.judul);
      const desc = document.createElement("p");
      desc.className = "mt-2 font-body-sm text-body-sm text-on-surface-variant";
      desc.textContent = escapeText(row.deskripsi);
      body.append(title, desc);
      const link = document.createElement("a");
      link.className = "inline-flex mt-4 font-label-md text-label-md text-primary font-bold";
      link.href = `artikel/baca.html?drive=${encodeURIComponent(row.id)}&collection=highlights`;
      link.textContent = "Baca selengkapnya ↗";
      body.append(link);
      card.append(body);
      return card;
    }));
    section.hidden = false;
  }
})();
