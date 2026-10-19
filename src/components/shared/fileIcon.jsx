// A file's symbol by its kind, so a folder's contents read at a glance: the picture, the PDF and the
// spreadsheet are told apart before their names are read.
//
// The kind comes from the MIME type the upload declared and, when that says nothing useful (none,
// or application/octet-stream), from the name's extension. Anything else is the plain file symbol.
import {
  MdFolder,
  MdInsertDriveFile,
  MdImage,
  MdPictureAsPdf,
  MdVideoFile,
  MdAudioFile,
  MdDescription,
  MdTableChart,
  MdSlideshow,
  MdFolderZip,
  MdTextSnippet,
} from "react-icons/md";

const BY_EXTENSION = {
  image: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "tif", "tiff", "heic", "psd", "ai", "eps"],
  pdf: ["pdf"],
  video: ["mp4", "mov", "avi", "mkv", "webm", "wmv"],
  audio: ["mp3", "wav", "ogg", "m4a", "flac", "aac"],
  document: ["doc", "docx", "odt", "rtf", "pages", "indd"],
  sheet: ["xls", "xlsx", "ods", "csv", "numbers"],
  slides: ["ppt", "pptx", "odp", "key"],
  archive: ["zip", "rar", "7z", "tar", "gz"],
  text: ["txt", "md", "json", "xml"],
};

const SYMBOLS = {
  folder: MdFolder,
  image: MdImage,
  pdf: MdPictureAsPdf,
  video: MdVideoFile,
  audio: MdAudioFile,
  document: MdDescription,
  sheet: MdTableChart,
  slides: MdSlideshow,
  archive: MdFolderZip,
  text: MdTextSnippet,
  file: MdInsertDriveFile,
};

/** The kind a MIME type names, or null when it is missing or says nothing useful. */
function kindOfMime(mime) {
  if (!mime || mime === "application/octet-stream") return null;
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime === "text/csv") return "sheet";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "slides";
  if (mime.includes("wordprocessing") || mime === "application/msword") return "document";
  if (mime.includes("zip") || mime.includes("compressed") || mime.includes("x-tar")) return "archive";
  if (mime.startsWith("text/") || mime === "application/json") return "text";
  return null;
}

/** The kind a file name's extension suggests, or the plain file. */
function kindOfName(name) {
  const extension = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  const kind = Object.keys(BY_EXTENSION).find((key) => BY_EXTENSION[key].includes(extension));
  return kind ?? "file";
}

/**
 * A file's or a folder's symbol, decorative: the name is written beside it.
 *
 * @param {{ name?: string, mime?: string|null, folder?: boolean }} props
 */
function FileIcon({ name = "", mime = null, folder = false }) {
  const kind = folder ? "folder" : (kindOfMime(mime) ?? kindOfName(name));
  const Glyph = SYMBOLS[kind];
  return <Glyph className={`file-icon is-${kind}`} aria-hidden="true" />;
}

export default FileIcon;
