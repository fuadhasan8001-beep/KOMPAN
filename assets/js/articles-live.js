(() => {
  const containers = document.querySelectorAll("#live-article-grid, [data-live-articles]");
  if (!containers.length) return;

  const config = window.KOMPAN_SUPABASE_CONFIG || {};
  if (!config.anonKey || !window.supabase?.createClient) return;

  const client = window.supabase.createClient(config.url, config.anonKey);
  client
    .from("articles")
    .select("title, slug, excerpt, date, category, image")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(12)
    .then(({ data, error }) => {
      if (error || !data?.length) return;
      data.forEach((article) => {
        containers.forEach((container) => {
          const card = document.createElement("a");
          const detailBase = container.dataset.detailBase || "./baca.html";
          card.href = `${detailBase}?slug=${encodeURIComponent(article.slug)}`;
          card.className = "group block overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow";

          if (article.image) {
            const image = document.createElement("img");
            image.src = article.image;
            image.alt = `Gambar artikel: ${article.title}`;
            image.loading = "lazy";
            image.className = "h-48 w-full object-cover";
            card.append(image);
          }

          const body = document.createElement("div");
          body.className = "p-space-md";
          const category = document.createElement("span");
          category.className = "font-label-sm text-label-sm bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full";
          category.textContent = article.category || "Artikel";
          const title = document.createElement("h3");
          title.className = "mt-3 font-headline-sm text-headline-sm text-on-surface font-semibold group-hover:text-primary";
          title.textContent = article.title;
          const excerpt = document.createElement("p");
          excerpt.className = "mt-2 font-body-sm text-body-sm text-on-surface-variant line-clamp-3";
          excerpt.textContent = article.excerpt || "Baca selengkapnya tentang kegiatan KOMPAN.";
          const date = document.createElement("p");
          date.className = "mt-4 font-label-sm text-label-sm text-on-surface-variant";
          date.textContent = article.date || "";
          body.append(category, title, excerpt, date);
          card.append(body);
          container.append(card);
        });
      });
      document.querySelectorAll("[data-live-articles-section]").forEach((section) => {
        section.hidden = false;
      });
    });
})();
