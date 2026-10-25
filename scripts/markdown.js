/**
 * Parser Markdown minimal tapi lengkap untuk konten berita & kegiatan.
 *
 * Tidak bergantung pada package eksternal (tidak perlu npm install),
 * sehingga build bisa dijalankan di GitHub Actions tanpa cache tambahan.
 */

function parseFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  let front = {};
  let bodyStart = 0;
  let inFrontmatter = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "---") {
      if (!inFrontmatter) {
        inFrontmatter = true;
        bodyStart = i + 1;
        continue;
      }
      bodyStart = i + 1;
      break;
    }
    if (!inFrontmatter) continue;
    if (line.includes(":")) {
      const idx = line.indexOf(":");
      const k = line.slice(0, idx).trim();
      let v = line.slice(idx + 1).trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      else if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
      if (k === "tags") {
        v = v
          .split(/[,;]\s*/)
          .map((s) => s.trim())
          .filter(Boolean);
      } else if (k === "status") {
        v = v.toLowerCase();
      }
      front[k] = v;
    }
  }
  const body = lines.slice(bodyStart).join("\n").trim();
  return { front, body, raw: text };
}

// Minimal HTML sanitizer: hanya izinkan tag yang aman (tidak izin script/style/event).
const ALLOWED_TAGS = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "strong",
  "b",
  "em",
  "i",
  "a",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code",
  "pre",
  "hr",
  "img",
  "figure",
  "figcaption",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "br",
  "span",
  "div",
  "span",
  "abbr",
]);

const ALLOWED_ATTRS = {
  a: new Set(["href", "title", "target", "rel"]),
  img: new Set(["src", "alt", "loading", "width", "height", "title"]),
  figure: new Set([]),
  figcaption: new Set([]),
  code: new Set(["class"]),
  pre: new Set(["class"]),
  span: new Set(["class", "style"]),
  div: new Set(["class", "style"]),
};

function sanitizeHtml(raw) {
  // Strip dangerous tags: script, style, iframe, form, input, button, object, embed
  let html = raw
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, "")
    .replace(/<input[^>]*>/gi, "")
    .replace(/<button[^>]*>[\s\S]*?<\/button>/gi, "")
    .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[^>]*>/gi, "");

  // Very basic tag-level sanitizer via regex (acceptable for static build only)
  html = html.replace(/<([\w-]+)([^>]*)>/gi, (match, tag, attrStr) => {
    if (!ALLOWED_TAGS.has(tag.toLowerCase())) return "";
    const allowed = ALLOWED_ATTRS[tag.toLowerCase()] || new Set();
    const cleanAttrs = [];
    const attrRegex =
      /([a-zA-Z][a-zA-Z0-9-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]*)))?/gi;
    let m;
    while ((m = attrRegex.exec(attrStr)) !== null) {
      const key = m[1].toLowerCase();
      if (allowed.has(key)) {
        const val = m[2] || m[3] || m[4] || "";
        cleanAttrs.push(`${m[1]}="${val.replace(/"/g, "&quot;")}"`);
      }
    }
    return `<${tag}${cleanAttrs.length ? " " + cleanAttrs.join(" ") : ""}>`;
  });
  return html;
}

function parseMarkdown(text) {
  const { front, body } = parseFrontmatter(text);
  // Convert to HTML
  let html = body
    // Headings
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold / italic
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Links
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" rel="noopener noreferrer" target="_blank">$1</a>',
    )
    // Images
    .replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      '<img src="$2" alt="$1" loading="lazy" class="rounded-xl shadow-sm w-full object-cover my-3">',
    )
    // Blockquote
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    // Lists (simple)
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/<li>/g, (match, offset, string) => {
      // wrap consecutive lis in ul
      return "<ul><li>";
    });
  // We use a simpler approach: just wrap lines after ul start
  // Actually let's do it with a helper below instead of regex chaos
  // Better: split lines and process sequentially for lists
  return { front, html: sanitizeHtml(html) };
}

// More reliable sequential parser for body
function markdownToHtml(body) {
  const lines = body.split(/\r?\n/);
  const out = [];
  let inList = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (trimmed === "") {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      continue;
    }
    // Heading
    const h = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      const level = h[1].length;
      out.push(`<h${level}>${sanitizeHtmlInline(h[2])}</h${level}>`);
      continue;
    }
    // Blockquote
    if (trimmed.startsWith("> ")) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      out.push(
        `<blockquote>${sanitizeHtmlInline(trimmed.slice(2))}</blockquote>`,
      );
      continue;
    }
    // List item
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      if (!inList) {
        out.push(
          '<ul class="list-disc pl-6 space-y-1 my-3 text-on-surface-variant">',
        );
        inList = true;
      }
      out.push(`<li>${sanitizeHtmlInline(trimmed.slice(2))}</li>`);
      continue;
    }
    // Paragraph
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
    // Process inline within paragraph
    out.push(
      `<p class="font-body-md text-body-md text-on-surface-variant leading-relaxed">${sanitizeHtmlInline(trimmed)}</p>`,
    );
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}

function sanitizeHtmlInline(str) {
  return str
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" rel="noopener noreferrer" target="_blank">$1</a>',
    )
    .replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      '<img src="$2" alt="$1" loading="lazy" class="rounded-xl shadow-sm w-full object-cover my-3">',
    );
}

function buildPageFromMarkdown(filePath) {
  const fs = require("node:fs");
  const text = fs.readFileSync(filePath, "utf8");
  const { front, body } = parseFrontmatter(text);
  const htmlBody = markdownToHtml(body);
  return {
    front,
    htmlBody,
    slug: front.slug || filePath.replace(/\.md$/, "").split("/").pop(),
    title: front.title || "Tanpa Judul",
  };
}

module.exports = {
  parseFrontmatter,
  sanitizeHtml,
  parseMarkdown,
  buildPageFromMarkdown,
  markdownToHtml,
};
