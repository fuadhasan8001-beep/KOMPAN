(() => {
  const container = document.getElementById("live-article-detail");
  if (!container) return;
  const slug = new URLSearchParams(location.search).get("slug");
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
      container.replaceChildren();

      const back = document.createElement("a");
      back.href = "./index.html";
      back.className = "inline-flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant hover:text-primary mb-space-md";
      back.textContent = "← Kembali ke daftar Artikel";

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
      category.textContent = article.category || "Artikel";
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
      card.append(body);
      container.append(back, card);
      document.title = `${article.title} — KOMPAN`;
    })
    .catch((error) => {
      container.textContent = error.message || "Artikel tidak ditemukan.";
    });
})();
