/**
 * Template HTML bersama untuk semua halaman situs.
 *
 * Semua halaman dibangun dari `body` + konfigurasi global.
 * Path relatif dihitung otomatis berdasarkan `depth` halaman sehingga situs
 * tetap benar baik di domain custom maupun di URL repository GitHub Pages.
 *
 *   depth 0 → index.html                  (rel = ./)
 *   depth 1 → tentang.html, kegiatan/    (rel = ./)
 *   depth 2 → kegiatan/{slug}/index.html  (rel = ../../)
 */

const config = require("./site.config.js");

function computeRel(depth) {
  const d = depth || 0;
  if (d === 0) return "./";
  return new Array(d).fill("..").join("/") + "/";
}

function generateHeader(activeKey, depth) {
  const rel = computeRel(depth);
  const navItems = config.nav
    .map((n) => {
      const isActive = n.key === activeKey;
      const ariaCurrent = isActive ? ' aria-current="page"' : "";
      const cls = isActive
        ? "bg-primary-container text-on-primary font-label-lg text-label-lg rounded-full px-space-md py-space-xs"
        : "font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors py-space-xs px-space-sm";
      return `<a${ariaCurrent} class="transition-colors ${cls}" data-path="${n.key}" href="${rel}${n.href}">${n.label}</a>`;
    })
    .join("");

  const mobileNav = config.nav
    .map(
      (n) =>
        `<a class="font-label-lg text-label-lg text-on-surface hover:text-primary transition-colors py-space-xs" href="${rel}${n.href}">${n.label}</a>`,
    )
    .join("");

  const ctaBtn = `<a class="hidden xl:inline-flex items-center bg-primary-container text-on-primary font-label-lg text-label-lg px-6 py-3 rounded-full hover:bg-primary transition-all shadow-[0_8px_24px_-4px_rgba(36,91,75,0.12)]" href="${rel}kegiatan/">Jelajahi Kegiatan</a>`;

  const igIcon = `<a aria-label="Instagram KOMPAN" class="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors" href="${config.social.instagram}" rel="noopener noreferrer" target="_blank"><span class="material-symbols-outlined text-[20px]">photo_camera</span></a>`;

  return `<nav class="flex lg:hidden items-center" aria-label="Mobile navigation">
<button aria-label="Buka menu" aria-expanded="false" aria-controls="mobile-menu" class="w-10 h-10 rounded-full bg-surface-container text-primary flex items-center justify-center shadow-sm">
<span class="material-symbols-outlined text-[20px]">menu</span>
</button>
</nav>
<div id="mobile-menu" class="hidden lg:hidden absolute top-20 left-0 w-full bg-surface/95 backdrop-blur-xl border-t border-surface-container shadow-xl z-50 flex-col gap-space-sm px-margin-mobile py-space-md" aria-label="Menu mobile">
${mobileNav}
</div>
<nav class="hidden lg:flex items-center gap-space-md">${navItems}</nav><div class="flex items-center gap-space-sm">${ctaBtn}${igIcon}</div>`;
}

function generateFooter(depth) {
  const rel = computeRel(depth);
  const links = config.footerNav
    .map(
      (n) =>
        `<li><a href="${rel}${n.href}" class="text-on-surface-variant hover:text-primary transition-colors">${n.label}</a></li>`,
    )
    .join("");
  const ig = `<a aria-label="Instagram KOMPAN" href="${config.social.instagram}" rel="noopener noreferrer" target="_blank" class="w-9 h-9 rounded-full flex items-center justify-center bg-surface-container text-primary hover:bg-primary-container hover:text-on-primary transition-colors"><span class="material-symbols-outlined text-[18px]">photo_camera</span></a>`;
  const email = `<a aria-label="Email KOMPAN" href="mailto:${config.social.email}" class="w-9 h-9 rounded-full flex items-center justify-center bg-surface-container text-primary hover:bg-primary-container hover:text-on-primary transition-colors"><span class="material-symbols-outlined text-[18px]">mail</span></a>`;
  const wa = config.social.whatsapp
    ? `<a aria-label="WhatsApp KOMPAN" href="${config.social.whatsapp}" rel="noopener noreferrer" target="_blank" class="w-9 h-9 rounded-full flex items-center justify-center bg-surface-container text-primary hover:bg-primary-container hover:text-on-primary transition-colors"><span class="material-symbols-outlined text-[18px]">chat</span></a>`
    : "";

  return `<footer class="w-full bg-surface-container-low"><div class="max-w-[1280px] mx-auto px-margin-mobile md:px-margin pt-space-xl pb-space-lg"><div class="grid grid-cols-1 md:grid-cols-12 gap-space-lg pb-space-xl"><div class="md:col-span-5 flex flex-col gap-space-sm"><div class="flex items-center gap-space-sm"><span class="font-headline-sm text-headline-sm text-primary">KOMPAN</span><span class="bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-label-sm px-2.5 py-0.5 rounded-full">Est. 2009</span></div><p class="font-body-md text-body-md text-on-surface-variant max-w-sm">Didirikan Anang Prasetyo pada 2009, KOMPAN menggerakkan kegiatan BCMK dan Aktivasi Memori Bahagia bersama anak-anak dan generasi muda.</p><div class="flex items-center gap-space-sm pt-space-xs">${ig}${email}${wa}</div></div><div class="md:col-span-3 flex flex-col gap-space-sm"><span class="font-label-lg text-label-lg text-on-surface">Tautan Navigasi</span><ul class="flex flex-col gap-space-xs">${links}</ul></div><div class="md:col-span-4 flex flex-col gap-space-sm"><span class="font-label-lg text-label-lg text-on-surface">Hubungi Kami</span><ul class="flex flex-col gap-space-xs"><li><a href="mailto:${config.contact.email}" class="text-on-surface-variant hover:text-primary transition-colors">${config.contact.email}</a></li><li><span class="text-on-surface-variant">${config.contact.address}</span></li><li><span class="text-on-surface-variant">${config.contact.hours}</span></li></ul></div></div><div class="pt-space-md border-t border-outline-variant flex flex-wrap items-center justify-between gap-2"><span class="font-body-sm text-body-sm text-on-surface-variant">&copy; ${new Date().getFullYear()} KOMPAN — Komunitas Padhang Njingglang</span><a href="${rel}kebijakan-privasi.html" class="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors">Kebijakan Privasi</a></div></div></footer>`;
}

const TAILWIND_CONFIG = `tailwind.config={darkMode:"class",theme:{extend:{"colors":{"on-error-container":"#93000a","tertiary-fixed-dim":"#ebc246","on-secondary-fixed":"#171e00","surface-container-highest":"#dbe5dc","on-secondary-fixed-variant":"#3e4c00","secondary-fixed-dim":"#b4d337","tertiary-fixed":"#ffe08b","surface-container-high":"#e1ebe1","on-primary-fixed":"#002118","surface-container":"#e6f1e7","on-tertiary-fixed-variant":"#584400","tertiary":"#745b00","surface-container-lowest":"#ffffff","surface":"#f2fcf2","error":"#ba1a1a","primary-container":"#245b4b","surface-container-low":"#ecf6ed","on-primary-container":"#99d1bc","on-tertiary-container":"#4f3d00","error-container":"#ffdad6","on-error":"#ffffff","on-surface-variant":"#404945","on-background":"#151e18","primary":"#044335","on-secondary-container":"#596c00","primary-fixed":"#b5eed9","inverse-on-surface":"#e9f3ea","outline-variant":"#c0c9c3","secondary":"#536500","secondary-container":"#d0f052","on-primary-fixed-variant":"#175040","secondary-fixed":"#d0f052","surface-variant":"#dbe5dc","on-surface":"#151e18","on-tertiary":"#ffffff","outline":"#707975","on-primary":"#ffffff","inverse-primary":"#9ad2be","primary-fixed-dim":"#9ad2be","surface-tint":"#326857","background":"#f2fcf2","surface-dim":"#d3ddd3","tertiary-container":"#cda72b","on-tertiary-fixed":"#241a00","inverse-surface":"#29332c","on-secondary":"#ffffff","surface-bright":"#f2fcf2"},"borderRadius":{"DEFAULT":"0.25rem","lg":"0.5rem","xl":"0.75rem","full":"9999px"},"spacing":{"gutter-mobile":"1rem","gutter":"1.5rem","space-md":"1rem","space-xl":"2.5rem","space-lg":"1.5rem","margin":"3rem","space-xs":"0.25rem","margin-mobile":"1.25rem","space-sm":"0.5rem"},"fontFamily":{"label-sm":["Plus Jakarta Sans"],"headline-md":["Epilogue"],"headline-lg":["Epilogue"],"body-sm":["Plus Jakarta Sans"],"headline-lg-mobile":["Epilogue"],"body-md":["Plus Jakarta Sans"],"display-hero-mobile":["Epilogue"],"body-lg":["Plus Jakarta Sans"],"display-hero":["Epilogue"],"headline-sm":["Epilogue"],"label-lg":["Plus Jakarta Sans"],"label-md":["Plus Jakarta Sans"]},"fontSize":{"label-sm":["11px",{"lineHeight":"16px","letterSpacing":"0.04em","fontWeight":"700"}],"headline-md":["28px",{"lineHeight":"36px","fontWeight":"600"}],"headline-lg":["40px",{"lineHeight":"48px","letterSpacing":"-0.015em","fontWeight":"700"}],"body-sm":["14px",{"lineHeight":"20px","fontWeight":"400"}],"headline-lg-mobile":["28px",{"lineHeight":"36px","fontWeight":"700"}],"body-md":["16px",{"lineHeight":"24px","fontWeight":"400"}],"display-hero-mobile":["36px",{"lineHeight":"44px","letterSpacing":"-0.01em","fontWeight":"800"}],"body-lg":["18px",{"lineHeight":"28px","fontWeight":"400"}],"display-hero":["56px",{"lineHeight":"64px","letterSpacing":"-0.02em","fontWeight":"800"}],"headline-sm":["22px",{"lineHeight":"30px","fontWeight":"600"}],"label-lg":["15px",{"lineHeight":"20px","letterSpacing":"0.01em","fontWeight":"600"}],"label-md":["13px",{"lineHeight":"18px","letterSpacing":"0.02em","fontWeight":"600"}]}}}};`;

const CSP = `default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://wdg.fouita.com https://cdn.fouita.com https://connect.facebook.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.fouita.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https: data:; connect-src 'self' https://*.fouita.com https://*.supabase.co wss://*.supabase.co;`;

function renderPage({
  title,
  description,
  depth,
  body,
  activeNav,
  extraHead,
  extraScripts,
}) {
  const rel = computeRel(depth);
  return `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"/><meta content="width=device-width, initial-scale=1.0" name="viewport"/><meta name="description" content="${description || config.site.description}"/><meta property="og:title" content="${title}"/><meta property="og:description" content="${description || config.site.description}"/><meta property="og:type" content="website"/><meta http-equiv="Content-Security-Policy" content="${CSP}"/><link href="${rel}favicon.svg" rel="icon"/><link rel="apple-touch-icon" href="${rel}apple-touch-icon.png"/><link href="https://fonts.googleapis.com" rel="preconnect"/><link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect"/><link href="https://fonts.googleapis.com/css2?family=Epilogue:wght@600;700;800&amp;family=Plus+Jakarta+Sans:wght@400;600;700&amp;display=swap" rel="stylesheet"/><link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet"/><style>@layer base{html,body{margin:0;padding:0;}body{overscroll-behavior:none;}main>:first-child{margin-top:0!important;}main>:last-child{margin-bottom:0!important;}}::-webkit-scrollbar{display:none;}</style><script src="https://cdn.tailwindcss.com"></script><script id="tailwind-config">${TAILWIND_CONFIG}</script><link href="${rel}assets/css/site.css" rel="stylesheet"/>${extraHead || ""}</head><body class="bg-surface font-body-md text-on-surface antialiased"><a class="skip-link" href="#main-content">Lompat ke konten utama</a><header class="fixed top-0 left-0 w-full z-50 bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(32,41,35,0.04)]"><div class="h-20 max-w-[1280px] mx-auto px-margin-mobile md:px-margin flex items-center justify-between gap-space-md"><div class="flex items-center gap-space-sm"><a href="${rel}index.html" aria-label="Logo KOMPAN, Komunitas Padhang Njingglang, kembali ke beranda" class="flex items-center"><img alt="Logo KOMPAN — Komunitas Padhang Njingglang" class="h-12 w-auto max-w-[190px] object-contain" src="${rel}assets/kompan-logo-header.svg"/></a></div>${generateHeader(activeNav || "beranda", depth)}</div></header><main id="main-content" class="w-full pt-20 bg-surface min-h-[calc(100vh-80px)]">${body}</main>${generateFooter(depth)}<script src="${rel}assets/js/site.js" defer></script>${extraScripts || ""}</body></html>`;
}

module.exports = {
  generateHeader,
  generateFooter,
  renderPage,
  computeRel,
  TAILWIND_CONFIG,
  CSP,
};
