/**
 * Interaksi situs KOMPAN — dipakai seluruh halaman.
 *
 * Fungsi yang diekspor secara global (dipakai oleh atribut onclick):
 *   - previewHighlight(title, desc)  : pratinjau umpan balik cerita
 *   - filterGallery(category, btn)    : filter galeri per kategori
 *   - openLightbox(src, title, cat, desc) / closeLightbox()
 *   - filterArchive(year, btn)        : filter arsip per tahun
 *
 * Fitur yang diinisialisasi otomatis:
 *   - menu mobile (buka/tutup, tutup saat pilih tautan, tombol ESC)
 *   - pencarian + filter kategori + pagination pada halaman daftar
 *   - validasi formulir kontak yang jujur (situs tanpa backend)
 */
(function () {
  'use strict';

  /* ================= 1. Menu mobile ================= */
  function initMobileMenu() {
    const btn = document.querySelector('button[aria-label="Buka menu"]');
    const menu = document.getElementById('mobile-menu');
    if (!btn || !menu) return;

    const setOpen = (open) => {
      menu.classList.toggle('hidden', !open);
      menu.classList.toggle('flex', open);
      btn.setAttribute('aria-expanded', String(open));
    };

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      setOpen(menu.classList.contains('hidden'));
    });

    menu.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => setOpen(false));
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !menu.classList.contains('hidden')) {
        setOpen(false);
        btn.focus();
      }
    });

    document.addEventListener('click', (e) => {
      if (menu.classList.contains('hidden')) return;
      if (!menu.contains(e.target) && e.target !== btn) setOpen(false);
    });
  }

  /* ================= 2. Pratinjau cerita ================= */
  function previewHighlight(title, desc) {
    const fb = document.getElementById('story-feedback');
    const t = document.getElementById('story-title');
    const d = document.getElementById('story-desc');
    if (!fb) return;
    if (t) t.textContent = title;
    if (d) d.textContent = desc;
    fb.classList.remove('hidden');
  }

  /* ================= 3. Filter galeri ================= */
  function filterGallery(category, btn) {
    const items = document.querySelectorAll('.gallery-item');
    const buttons = document.querySelectorAll('#gallery-filters .gallery-tab');
    buttons.forEach((b) => {
      b.classList.remove('bg-primary-container', 'text-on-primary');
      b.classList.add('bg-surface-container', 'text-on-surface-variant');
      b.setAttribute('aria-pressed', 'false');
    });
    if (btn) {
      btn.classList.remove('bg-surface-container', 'text-on-surface-variant');
      btn.classList.add('bg-primary-container', 'text-on-primary');
      btn.setAttribute('aria-pressed', 'true');
    }
    items.forEach((it) => {
      const cat = it.getAttribute('data-category') || '';
      const hasClass = it.classList.contains(category);
      it.style.display = category === 'all' || cat === category || hasClass ? 'block' : 'none';
    });
  }

  /* ================= 4. Lightbox ================= */
  function openLightbox(imgSrc, title, category, desc) {
    const modal = document.getElementById('lightbox-modal');
    if (!modal) return;
    const img = document.getElementById('lightbox-img');
    const tEl = document.getElementById('lightbox-title');
    const cEl = document.getElementById('lightbox-category');
    const dEl = document.getElementById('lightbox-desc');
    if (img) {
      img.src = imgSrc || '';
      img.alt = title || 'Foto galeri';
    }
    if (tEl) tEl.textContent = title || '';
    if (cEl) cEl.textContent = category || '';
    if (dEl) dEl.textContent = desc || '';
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    const closeBtn = modal.querySelector('[data-lightbox-close]');
    if (closeBtn) closeBtn.focus();
  }

  function closeLightbox() {
    const modal = document.getElementById('lightbox-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function initLightbox() {
    const modal = document.getElementById('lightbox-modal');
    if (!modal) return;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeLightbox();
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeLightbox();
    });
    const closeBtn = modal.querySelector('[data-lightbox-close]');
    if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
  }

  /* ================= 5. Filter arsip per tahun ================= */
  function filterArchive(year, btn) {
    const items = document.querySelectorAll('.archive-item');
    const buttons = document.querySelectorAll('#archive-years .archive-pill');
    buttons.forEach((b) => {
      b.classList.remove('bg-primary-container', 'text-on-primary');
      b.classList.add('bg-surface-container', 'text-on-surface-variant');
      b.setAttribute('aria-pressed', 'false');
    });
    if (btn) {
      btn.classList.remove('bg-surface-container', 'text-on-surface-variant');
      btn.classList.add('bg-primary-container', 'text-on-primary');
      btn.setAttribute('aria-pressed', 'true');
    }
    items.forEach((it) => {
      const y = it.getAttribute('data-year') || '';
      const clsYear = Array.from(it.classList).filter((c) => /^\d{4}$/.test(c))[0] || '';
      const itemYear = y || clsYear;
      it.style.display = year === 'all' || itemYear === year ? 'flex' : 'none';
    });
  }

  /* ============ 6. Pencarian + filter + pagination (halaman daftar) ============ */
  let listController = null;

  function initListPage() {
    const list = document.getElementById('search-results');
    if (!list) return;

    const input = document.getElementById('search-input');
    const countEl = document.getElementById('result-count');
    const emptyEl = document.getElementById('search-empty');
    const pagerEl = document.getElementById('pagination');
    const items = Array.from(list.querySelectorAll('[data-search]'));
    const perPage = parseInt(list.getAttribute('data-per-page') || '0', 10);
    let query = '';
    let category = 'all';
    let page = 1;

    const params = new URLSearchParams(window.location.search);
    if (params.get('q')) {
      query = params.get('q').toLowerCase();
      if (input) input.value = params.get('q');
    }

    function apply() {
      const matched = items.filter((it) => {
        const text = (it.getAttribute('data-search') || '').toLowerCase();
        const cat = it.getAttribute('data-category') || '';
        const textOk = !query || text.includes(query);
        const catOk = category === 'all' || cat === category;
        return textOk && catOk;
      });

      const pages = perPage > 0 ? Math.max(1, Math.ceil(matched.length / perPage)) : 1;
      if (page > pages) page = pages;
      const start = perPage > 0 ? (page - 1) * perPage : 0;
      const slice = perPage > 0 ? matched.slice(start, start + perPage) : matched;

      items.forEach((it) => {
        it.style.display = 'none';
      });
      slice.forEach((it) => {
        it.style.display = 'block';
      });

      if (countEl) {
        const total = matched.length;
        const totalAll = items.length;
        countEl.textContent =
          total === 0
            ? 'Tidak ada hasil.'
            : 'Menampilkan ' + slice.length + ' dari ' + total + ' hasil (total ' + totalAll + ' item).';
      }
      if (emptyEl) {
        emptyEl.style.display = matched.length === 0 ? 'block' : 'none';
      }
      if (pagerEl) {
        renderPager(pagerEl, pages, page, (p) => {
          page = p;
          apply();
          window.scrollTo({ top: list.offsetTop - 140, behavior: 'smooth' });
        });
      }
    }

    function renderPager(pager, pages, current, onGo) {
      pager.innerHTML = '';
      if (pages <= 1) return;
      const mk = (label, target, opts) => {
        opts = opts || {};
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.className =
          'min-w-[40px] h-10 px-3 rounded-full font-label-md text-label-md transition-colors ' +
          (opts.active
            ? 'bg-primary-container text-on-primary'
            : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high');
        if (opts.disabled) {
          b.disabled = true;
          b.classList.add('opacity-40', 'cursor-not-allowed');
        }
        if (opts.aria) b.setAttribute('aria-label', opts.aria);
        b.addEventListener('click', function () {
          onGo(target);
        });
        return b;
      };
      pager.appendChild(mk('‹', current - 1, { disabled: current === 1, aria: 'Halaman sebelumnya' }));
      for (let p = 1; p <= pages; p++) {
        pager.appendChild(mk(String(p), p, { active: p === current, aria: 'Halaman ' + p }));
      }
      pager.appendChild(mk('›', current + 1, { disabled: current === pages, aria: 'Halaman berikutnya' }));
    }

    if (input) {
      input.addEventListener('input', (e) => {
        query = (e.target.value || '').toLowerCase().trim();
        page = 1;
        apply();
      });
    }

    listController = {
      setCategory: function (cat, btn) {
        category = cat || 'all';
        page = 1;
        const catButtons = document.querySelectorAll('#category-filters button');
        catButtons.forEach((x) => {
          x.classList.remove('bg-primary-container', 'text-on-primary');
          x.classList.add('bg-surface-container', 'text-on-surface-variant');
          x.setAttribute('aria-pressed', 'false');
        });
        if (btn) {
          btn.classList.remove('bg-surface-container', 'text-on-surface-variant');
          btn.classList.add('bg-primary-container', 'text-on-primary');
          btn.setAttribute('aria-pressed', 'true');
        }
        apply();
      },
    };

    const catButtons = document.querySelectorAll('#category-filters button');
    catButtons.forEach((b) => {
      b.addEventListener('click', function () {
        const cat = b.getAttribute('data-category-filter');
        if (listController) listController.setCategory(cat === null ? 'all' : cat, b);
      });
    });

    apply();
  }

  /* ================= 7. Formulir kontak (validasi jujur) ================= */
  function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;
    const msgEl = document.getElementById('contact-message');
    const formSection = document.getElementById('contact-form-section');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = (form.querySelector('[name="nama"]') || {}).value || '';
      const email = (form.querySelector('[name="email"]') || {}).value || '';
      const msg = (form.querySelector('[name="pesan"]') || {}).value || '';
      const invalid = [];
      if (!name.trim()) invalid.push('nama');
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) invalid.push('email');
      if (!msg.trim()) invalid.push('pesan');
      invalid.forEach((n) => {
        const el = form.querySelector('[name="' + n + '"]');
        if (el) el.setAttribute('aria-invalid', 'true');
      });

      if (invalid.length) {
        if (msgEl) {
          msgEl.className =
            'mt-4 p-3 rounded-lg bg-error-container text-on-error-container font-body-md text-body-md';
          msgEl.textContent =
            'Pesan belum dapat diproses: kolom ' + invalid.join(', ') + ' belum diisi dengan benar.';
        }
        const first = form.querySelector('[name="' + invalid[0] + '"]');
        if (first) first.focus();
        return;
      }

      form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));

      if (msgEl) {
        msgEl.className =
          'mt-4 p-3 rounded-lg bg-surface-container text-on-surface font-body-md text-body-md';
        msgEl.innerHTML =
          'Terima kasih, <strong>' +
          escapeHtml(name.trim()) +
          '</strong>. Situs ini berjalan tanpa server, jadi pesan tidak terkirim otomatis. ' +
          'Silakan kirim ulang melalui surel kami: ' +
          '<a class="underline font-bold" href="mailto:kontak@kompan.org?subject=' +
          encodeURIComponent('Pesan dari ' + name.trim()) +
          '">kontak@kompan.org</a>.';
      }
      if (formSection) formSection.setAttribute('data-submitted', 'true');
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ================= Inisialisasi ================= */
  document.addEventListener('DOMContentLoaded', () => {
    initMobileMenu();
    initLightbox();
    initListPage();
    initContactForm();
  });
})();

/* Fungsi global (dipakai atribut onclick pada HTML) */
window.previewHighlight = previewHighlight;
window.filterGallery = filterGallery;
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
window.filterArchive = filterArchive;
window.filterListCategory = function (category, btn) {
  if (listController) listController.setCategory(category, btn);
};

(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const resetBtn = document.getElementById('reset-filters');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        const input = document.getElementById('search-input');
        if (input) {
          input.value = '';
          input.dispatchEvent(new Event('input'));
        }
        const allBtn = document.querySelector('#category-filters button[data-category-filter="all"]');
        if (allBtn) allBtn.click();
      });
    }
  });
})();
