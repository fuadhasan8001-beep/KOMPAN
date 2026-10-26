(() => {
  const container = document.getElementById("live-article-detail");
  if (!container) return;

  const config = window.KOMPAN_SUPABASE_CONFIG || {};
  const slug = new URLSearchParams(location.search).get("slug");
  if (!slug || !config.anonKey || !window.supabase?.createClient) {
    container.textContent = "Artikel tidak tersedia.";
    return;
  }

  const client = window.supabase.createClient(config.url, config.anonKey);
  client
    .from("articles")
    .select("title, content, date, category, author, image")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle()
    .then(({ data, error }) => {
      if (error || !data) {
        container.textContent = "Artikel tidak ditemukan.";
        return;
      }
      container.replaceChildren();

      const back = document.createElement("a");
      back.href = "./index.html";
      back.className = "inline-flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant hover:text-primary mb-space-md";
      back.textContent = "← Kembali ke daftar Artikel";

      const article = document.createElement("article");
      article.className = "overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm";
      if (data.image) {
        const image = document.createElement("img");
        image.src = data.image;
        image.alt = `Gambar artikel: ${data.title}`;
        image.className = "w-full max-h-[520px] object-cover";
        article.append(image);
      }

      const body = document.createElement("div");
      body.className = "p-space-lg sm:p-space-xl";
      const category = document.createElement("span");
      category.className = "font-label-sm text-label-sm bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full";
      category.textContent = data.category || "Artikel";
      const title = document.createElement("h1");
      title.className = "mt-4 font-headline-lg-mobile lg:font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-on-surface tracking-tight";
      title.textContent = data.title;
      const meta = document.createElement("p");
      meta.className = "mt-3 font-label-sm text-label-sm text-on-surface-variant";
      meta.textContent = `${data.date || ""}${data.author ? ` · ${data.author}` : ""}`;
      const content = document.createElement("div");
      content.className = "mt-6 border-t border-outline-variant pt-6 font-body-md text-body-md text-on-surface-variant leading-relaxed whitespace-pre-line";
      content.textContent = data.content || "";
      body.append(category, title, meta, content);
      article.append(body);
      container.append(back, article);
      document.title = `${data.title} — KOMPAN`;
    });
})();
