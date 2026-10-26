(() => {
  const config = window.KOMPAN_SUPABASE_CONFIG || {};
  const loginView = document.getElementById("admin-login-view");
  const dashboardView = document.getElementById("admin-dashboard-view");
  const loginForm = document.getElementById("admin-login-form");
  const articleForm = document.getElementById("admin-article-form");
  const message = document.getElementById("admin-message");
  const loginMessage = document.getElementById("login-message");

  const showMessage = (element, text, isError = false) => {
    element.textContent = text;
    element.classList.toggle("error", isError);
    element.hidden = !text;
  };

  if (!config.url || !config.anonKey) {
    showMessage(
      loginMessage,
      "Publishable/anon key belum dikonfigurasi. Tambahkan GitHub Actions secret SUPABASE_ANON_KEY, lalu jalankan ulang workflow deploy.",
      true,
    );
    loginForm.querySelectorAll("input, button").forEach((field) => {
      field.disabled = true;
    });
    return;
  }

  if (!window.supabase?.createClient) {
    showMessage(loginMessage, "Library Supabase gagal dimuat. Muat ulang halaman atau periksa koneksi.", true);
    return;
  }

  const client = window.supabase.createClient(config.url, config.anonKey);
  let signedInUser = null;

  function setSignedIn(isAdmin) {
    loginView.hidden = isAdmin;
    dashboardView.hidden = !isAdmin;
  }

  async function checkAdmin(user) {
    if (!user) {
      signedInUser = null;
      setSignedIn(false);
      return;
    }

    const { data, error } = await client
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      setSignedIn(false);
      showMessage(loginMessage, `Gagal memeriksa role admin: ${error.message}`, true);
      return;
    }
    if (data?.role !== "admin") {
      signedInUser = null;
      setSignedIn(false);
      await client.auth.signOut();
      showMessage(loginMessage, "Akun ini belum memiliki role admin.", true);
      return;
    }

    signedInUser = user;
    setSignedIn(true);
    document.getElementById("admin-account").textContent = user.email || "Admin KOMPAN";
    showMessage(loginMessage, "");
    await loadRecentArticles();
  }

  async function loadRecentArticles() {
    const list = document.getElementById("admin-recent-articles");
    list.replaceChildren();
    const { data, error } = await client
      .from("articles")
      .select("title, date, status")
      .order("created_at", { ascending: false })
      .limit(8);

    if (error) {
      list.textContent = "Belum dapat memuat daftar artikel.";
      return;
    }
    if (!data?.length) {
      list.textContent = "Belum ada artikel dari dashboard.";
      return;
    }

    data.forEach((article) => {
      const row = document.createElement("li");
      const title = document.createElement("span");
      title.textContent = article.title;
      const status = document.createElement("small");
      status.textContent = `${article.status === "published" ? "Terbit" : "Draf"} · ${article.date || ""}`;
      row.append(title, status);
      list.append(row);
    });
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = loginForm.querySelector("button[type=submit]");
    button.disabled = true;
    showMessage(loginMessage, "Memeriksa akun…");

    const form = new FormData(loginForm);
    const { data, error } = await client.auth.signInWithPassword({
      email: form.get("email").trim(),
      password: form.get("password"),
    });
    button.disabled = false;
    if (error) {
      showMessage(loginMessage, "Email atau kata sandi tidak cocok.", true);
      return;
    }
    await checkAdmin(data.user);
  });

  document.getElementById("admin-signout").addEventListener("click", async () => {
    await client.auth.signOut();
    await checkAdmin(null);
  });

  const imageInput = document.getElementById("article-image");
  imageInput.addEventListener("change", () => {
    const file = imageInput.files?.[0];
    const preview = document.getElementById("image-preview");
    preview.replaceChildren();
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      imageInput.value = "";
      showMessage(message, "Pilih file gambar JPG, PNG, atau WebP.", true);
      return;
    }
    const image = document.createElement("img");
    image.src = URL.createObjectURL(file);
    image.alt = "Pratinjau gambar artikel";
    preview.append(image);
  });

  articleForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!signedInUser) return;

    const button = articleForm.querySelector("button[type=submit]");
    const form = new FormData(articleForm);
    const title = form.get("title").trim();
    const content = form.get("content").trim();
    const file = form.get("image");
    if (!file || !file.size) {
      showMessage(message, "Pilih gambar utama artikel.", true);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showMessage(message, "Ukuran gambar maksimal 5 MB.", true);
      return;
    }
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      showMessage(message, "Format gambar yang didukung: JPG, PNG, dan WebP.", true);
      return;
    }
    if (content.length < 30) {
      showMessage(message, "Isi artikel minimal 30 karakter.", true);
      return;
    }

    button.disabled = true;
    button.textContent = "Mengunggah artikel…";
    showMessage(message, "Mengunggah gambar dan menyimpan artikel…");

    const extension = file.name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "");
    const imagePath = `${signedInUser.id}/${crypto.randomUUID()}.${extension || "jpg"}`;
    const { error: uploadError } = await client.storage
      .from("kompan-media")
      .upload(imagePath, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      showMessage(message, `Gambar gagal diunggah: ${uploadError.message}`, true);
      button.disabled = false;
      button.textContent = "Terbitkan artikel";
      return;
    }

    const { data: imageData } = client.storage
      .from("kompan-media")
      .getPublicUrl(imagePath);
    const slugBase = title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 70);
    const excerpt = content.replace(/\s+/g, " ").slice(0, 220);
    const article = {
      title,
      slug: `${slugBase || "artikel"}-${crypto.randomUUID().slice(0, 8)}`,
      excerpt,
      content,
      date: new Date().toISOString().slice(0, 10),
      category: (form.get("category") || "Artikel").trim() || "Artikel",
      author: signedInUser.user_metadata?.full_name || signedInUser.email || "KOMPAN",
      image: imageData.publicUrl,
      status: "published",
      created_by: signedInUser.id,
    };

    const { error: insertError } = await client.from("articles").insert(article);
    if (insertError) {
      await client.storage.from("kompan-media").remove([imagePath]);
      showMessage(message, `Artikel gagal disimpan: ${insertError.message}`, true);
      button.disabled = false;
      button.textContent = "Terbitkan artikel";
      return;
    }

    articleForm.reset();
    document.getElementById("image-preview").replaceChildren();
    showMessage(message, "Artikel berhasil diterbitkan. Artikel tampil di halaman Artikel.");
    button.disabled = false;
    button.textContent = "Terbitkan artikel";
    await loadRecentArticles();
  });

  client.auth.getSession().then(({ data }) => checkAdmin(data.session?.user || null));
  client.auth.onAuthStateChange((_event, session) => {
    checkAdmin(session?.user || null);
  });
})();
