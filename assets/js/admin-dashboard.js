(() => {
  const loginView = document.getElementById("admin-login-view");
  const dashboardView = document.getElementById("admin-dashboard-view");
  const loginForm = document.getElementById("admin-login-form");
  const articleForm = document.getElementById("admin-article-form");
  const articleIdInput = document.getElementById("article-id");
  const imageInput = document.getElementById("article-image");
  const message = document.getElementById("admin-message");
  const loginMessage = document.getElementById("login-message");

  const showMessage = (element, text, isError = false) => {
    element.textContent = text;
    element.classList.toggle("error", isError);
    element.hidden = !text;
  };

  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Permintaan gagal.");
    return payload;
  }

  function setSignedIn(user) {
    const signedIn = Boolean(user?.authenticated && user.role === "admin");
    loginView.hidden = signedIn;
    dashboardView.hidden = !signedIn;
    if (signedIn) {
      document.getElementById("admin-account").textContent = user.email;
      showMessage(loginMessage, "");
      loadRecentArticles();
    }
    return signedIn;
  }

  async function loadRecentArticles() {
    const list = document.getElementById("admin-recent-articles");
    list.replaceChildren();
    try {
      const { articles } = await api("/api/admin/articles");
      if (!articles.length) {
        list.textContent = "Belum ada artikel dari dashboard.";
        return;
      }
      articles.forEach((article) => {
        const row = document.createElement("li");
        const info = document.createElement("span");
        info.textContent = article.title;
        const status = document.createElement("small");
        status.textContent = `${article.status === "published" ? "Terbit" : "Draf"} · ${article.date || ""}`;
        info.append(document.createElement("br"), status);
        const actions = document.createElement("div");
        actions.className = "article-actions";
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "button secondary";
        edit.textContent = "Edit";
        edit.addEventListener("click", () => beginEdit(article.id));
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "button secondary";
        remove.textContent = "Hapus";
        remove.addEventListener("click", () => deleteArticle(article));
        actions.append(edit, remove);
        row.append(info, actions);
        list.append(row);
      });
    } catch {
      list.textContent = "Belum dapat memuat daftar artikel.";
    }
  }

  function resetArticleForm() {
    articleForm.reset();
    articleIdInput.value = "";
    imageInput.required = true;
    document.getElementById("article-form-heading").textContent = "Tulis artikel baru";
    document.getElementById("article-submit").textContent = "Terbitkan artikel";
    document.getElementById("article-cancel-edit").hidden = true;
    document.getElementById("image-preview").replaceChildren();
  }

  async function beginEdit(id) {
    showMessage(message, "Memuat artikel…");
    try {
      const { articles } = await api("/api/admin/articles");
      const row = articles.find((item) => item.id === id);
      if (!row) throw new Error("Artikel tidak ditemukan.");
      const { article } = await api(`/api/articles?slug=${encodeURIComponent(row.slug)}`);
      if (!article) throw new Error("Isi artikel tidak ditemukan.");
      articleIdInput.value = article.id;
      articleForm.elements.title.value = article.title;
      articleForm.elements.category.value = article.category || "";
      articleForm.elements.content.value = article.content || "";
      imageInput.required = false;
      const preview = document.getElementById("image-preview");
      preview.replaceChildren();
      if (article.image) {
        const image = document.createElement("img");
        image.src = article.image;
        image.alt = "Gambar artikel saat ini";
        preview.append(image);
      }
      document.getElementById("article-form-heading").textContent = "Edit artikel";
      document.getElementById("article-submit").textContent = "Simpan perubahan";
      document.getElementById("article-cancel-edit").hidden = false;
      showMessage(message, "Ubah judul, kategori, isi, atau pilih gambar baru. Kosongkan gambar untuk mempertahankan gambar saat ini.");
      articleForm.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      showMessage(message, error.message || "Artikel gagal dimuat.", true);
    }
  }

  async function deleteArticle(article) {
    if (!window.confirm(`Hapus artikel “${article.title}” secara permanen?`)) return;
    try {
      await api(`/api/admin/articles/${encodeURIComponent(article.id)}`, { method: "DELETE" });
      if (articleIdInput.value === article.id) resetArticleForm();
      showMessage(message, "Artikel dan gambar unggahannya sudah dihapus.");
      await loadRecentArticles();
    } catch (error) {
      showMessage(message, error.message || "Artikel gagal dihapus.", true);
    }
  }

  document.getElementById("article-cancel-edit").addEventListener("click", resetArticleForm);

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = loginForm.querySelector("button[type=submit]");
    button.disabled = true;
    showMessage(loginMessage, "Memeriksa akun…");
    const values = new FormData(loginForm);
    try {
      const user = await api("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ email: values.get("email"), password: values.get("password") }),
      });
      setSignedIn(user);
    } catch (error) {
      showMessage(loginMessage, error.message || "Email atau kata sandi tidak cocok.", true);
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById("admin-signout").addEventListener("click", async () => {
    await api("/api/admin/logout", { method: "POST", body: "{}" }).catch(() => {});
    dashboardView.hidden = true;
    loginView.hidden = false;
    loginForm.reset();
  });

  imageInput.addEventListener("change", () => {
    const file = imageInput.files?.[0];
    const preview = document.getElementById("image-preview");
    preview.replaceChildren();
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) {
      imageInput.value = "";
      showMessage(message, "Pilih JPG, PNG, atau WebP maksimal 5 MB.", true);
      return;
    }
    const image = document.createElement("img");
    image.src = URL.createObjectURL(file);
    image.alt = "Pratinjau gambar artikel";
    preview.append(image);
    showMessage(message, "");
  });

  articleForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = articleForm.querySelector("button[type=submit]");
    const values = new FormData(articleForm);
    const file = values.get("image");
    const isEditing = Boolean(articleIdInput.value);
    if ((!file || !file.size) && !isEditing) {
      showMessage(message, "Pilih gambar utama artikel.", true);
      return;
    }

    button.disabled = true;
    button.textContent = "Menyimpan artikel…";
    showMessage(message, "Menyimpan artikel ke database lokal…");
    try {
      let imageData = "";
      if (file?.size) {
        imageData = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",", 2)[1] || "");
          reader.onerror = () => reject(new Error("Gambar tidak dapat dibaca."));
          reader.readAsDataURL(file);
        });
      }
      const payload = {
        title: values.get("title"),
        category: values.get("category"),
        content: values.get("content"),
        imageMime: file?.type || "",
        imageData,
      };
      await api(isEditing ? `/api/admin/articles/${encodeURIComponent(articleIdInput.value)}` : "/api/admin/articles", {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      resetArticleForm();
      showMessage(message, isEditing ? "Perubahan artikel tersimpan." : "Artikel tersimpan di laptop dan tampil di Beranda serta halaman Artikel.");
      await loadRecentArticles();
    } catch (error) {
      showMessage(message, error.message || "Artikel gagal disimpan.", true);
    } finally {
      button.disabled = false;
      button.textContent = articleIdInput.value ? "Simpan perubahan" : "Terbitkan artikel";
    }
  });

  api("/api/admin/session")
    .then((user) => setSignedIn(user))
    .catch(() => showMessage(loginMessage, "Server lokal belum berjalan. Jalankan python3 local_app.py serve.", true));
})();
