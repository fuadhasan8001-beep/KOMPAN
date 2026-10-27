(() => {
  const archive = document.getElementById("arsip");
  if (!archive) return;

  fetch("/api/site-settings", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("Pengaturan situs tidak tersedia.");
      return response.json();
    })
    .then((settings) => {
      archive.hidden = settings.archive_visible === false;
      archive.querySelectorAll("[data-archive-image]").forEach((image) => {
        const source = settings.archive_images?.[Number(image.dataset.archiveImage)];
        image.src = source || image.dataset.defaultSrc;
      });
    })
    .catch(() => {
      archive.hidden = false;
    });
})();
