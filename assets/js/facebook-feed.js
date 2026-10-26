(() => {
  const containers = document.querySelectorAll("[data-facebook-feed]");
  if (!containers.length) return;

  const profileUrl = "https://www.facebook.com/anang.prasetyo.967";
  const scriptUrl = document.currentScript?.src || `${location.origin}/assets/js/facebook-feed.js`;
  const dataUrl = new URL("../data/facebook-posts.json", scriptUrl);
  dataUrl.searchParams.set("v", String(Date.now()));

  const formatDate = (value) => {
    if (!value) return "Facebook · Anang Prasetyo";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Facebook · Anang Prasetyo";
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  };

  function makePost(post) {
    const card = document.createElement("article");
    card.className = "overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm flex flex-col";

    if (post.image && /^https:\/\//i.test(post.image)) {
      const image = document.createElement("img");
      image.src = post.image;
      image.alt = "Foto dari postingan Facebook Anang Prasetyo";
      image.loading = "lazy";
      image.className = "w-full aspect-[4/3] object-cover";
      card.append(image);
    }

    const body = document.createElement("div");
    body.className = "flex flex-1 flex-col p-space-md";

    const date = document.createElement("time");
    date.className = "font-label-sm text-label-sm text-on-surface-variant";
    date.textContent = formatDate(post.createdAt);
    if (post.createdAt) date.dateTime = post.createdAt;
    body.append(date);

    const message = document.createElement("p");
    message.className = "mt-2 font-body-sm text-body-sm text-on-surface whitespace-pre-line line-clamp-5";
    message.textContent = post.message || "Lihat cerita dan dokumentasi terbaru dari Anang Prasetyo.";
    body.append(message);

    const link = document.createElement("a");
    link.href = post.permalink && /^https:\/\/(www\.)?facebook\.com\//i.test(post.permalink)
      ? post.permalink
      : profileUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "mt-auto pt-space-md inline-flex items-center gap-2 font-label-md text-label-md text-primary hover:underline";
    link.textContent = "Buka postingan di Facebook ↗";
    body.append(link);
    card.append(body);
    return card;
  }

  fetch(dataUrl, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("Feed belum tersedia");
      return response.json();
    })
    .then((feed) => {
      containers.forEach((container) => {
        container.replaceChildren();
        const posts = Array.isArray(feed.posts) ? feed.posts : [];
        if (!posts.length) {
          const empty = document.createElement("p");
          empty.className = "sm:col-span-2 lg:col-span-3 rounded-xl bg-surface-container-low p-space-lg text-on-surface-variant";
          empty.textContent = "Feed otomatis menunggu koneksi Meta. Kunjungi profil Anang untuk melihat postingan terbaru.";
          container.append(empty);
          return;
        }
        posts.forEach((post) => container.append(makePost(post)));
      });
    })
    .catch(() => {
      containers.forEach((container) => {
        container.replaceChildren();
        const message = document.createElement("p");
        message.className = "sm:col-span-2 lg:col-span-3 rounded-xl bg-surface-container-low p-space-lg text-on-surface-variant";
        message.textContent = "Postingan terbaru belum dapat dimuat. Kunjungi profil Facebook Anang.";
        container.append(message);
      });
    });
})();
