/** Public, read-only JSONP feed. Content metadata and image files live in Drive. */
const DRIVE_FOLDER_ID = "14Z7wU6qvLmbw7rg2RNGPEXQ9onXSX4jF";
const CONTENT_FILE_NAME = "konten.json";
const ALLOWED_CALLBACK = /^[A-Za-z_$][0-9A-Za-z_$]*$/;

function authorizeDrive() {
  return DriveApp.getFolderById(DRIVE_FOLDER_ID).getName();
}

function doGet(e) {
  const callback = String((e && e.parameter && e.parameter.callback) || "");
  if (!ALLOWED_CALLBACK.test(callback)) {
    return ContentService.createTextOutput("Callback tidak valid.")
      .setMimeType(ContentService.MimeType.TEXT);
  }

  let payload;
  try {
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const files = folder.getFilesByName(CONTENT_FILE_NAME);
    if (!files.hasNext()) throw new Error("konten.json tidak ditemukan");
    const content = JSON.parse(files.next().getBlob().getDataAsString("UTF-8"));
    payload = {
      ok: true,
      archive: normalizeItems(content.archive, true),
      highlights: normalizeItems(content.highlights, false),
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    payload = { ok: false, error: "Konten Drive belum dapat dibaca." };
  }

  return ContentService.createTextOutput(callback + "(" + JSON.stringify(payload) + ");")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function normalizeItems(items, isArchive) {
  if (!Array.isArray(items)) return [];
  return items.filter(function (item) {
    return item && /^(terbit|publish|published|ya|true|1)$/i.test(String(item.status || ""));
  }).map(function (item) {
    return {
      id: String(item.id || item.slug || slugify(item.judul || "")),
      tahun: String(item.tahun || ""),
      judul: String(item.judul || ""),
      deskripsi: String(item.deskripsi || ""),
      isi: String(item.isi || item.content || ""),
      tanggal: String(item.tanggal || ""),
      label: String(item.label || ""),
      gambar: normalizeDriveImage(item.gambar || ""),
      url: String(item.url || ""),
      visible: true,
    };
  }).filter(function (item) {
    return item.judul && (!isArchive || item.tahun);
  });
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeDriveImage(value) {
  const url = String(value || "").trim();
  const match = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?.*?id=)([A-Za-z0-9_-]+)/);
  if (!match) return url;
  return "https://drive.google.com/uc?export=view&id=" + match[1];
}
