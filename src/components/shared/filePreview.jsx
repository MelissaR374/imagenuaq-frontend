// A stored file shown in place: images, PDFs and video, fetched with the session token and held in an
// object URL, since an <img> or <iframe> cannot send the header. Anything else shows nothing and is
// left to the download button beside it.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import "./filePreview.css";

/** The kinds a browser draws by itself, by extension, with the type the Blob must carry for it. */
const KINDS = {
  png: ["image", "image/png"],
  jpg: ["image", "image/jpeg"],
  jpeg: ["image", "image/jpeg"],
  gif: ["image", "image/gif"],
  webp: ["image", "image/webp"],
  svg: ["image", "image/svg+xml"],
  pdf: ["pdf", "application/pdf"],
  mp4: ["video", "video/mp4"],
  webm: ["video", "video/webm"],
};

/** What `name` previews as, or null when the browser cannot show it. */
function kindOf(name) {
  const extension = String(name).split(".").pop().toLowerCase();
  return KINDS[extension] ?? null;
}

/**
 * @param {{ fileId: number, name: string }} props
 */
function FilePreview({ fileId, name }) {
  const kind = kindOf(name);
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (kind === null) return;
    let cancelled = false;
    let made = null;
    api
      .downloadFile(fileId)
      .then((blob) => {
        if (cancelled) return;
        made = URL.createObjectURL(new Blob([blob], { type: kind[1] }));
        setUrl(made);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
      if (made !== null) URL.revokeObjectURL(made);
    };
  }, [fileId, kind]);

  if (kind === null) return null;
  if (error !== null) return <p className="file-preview-error">No se pudo mostrar el archivo: {error}</p>;
  if (url === null) return <p className="file-preview-note">Cargando el archivo…</p>;

  return (
    <div className={`file-preview is-${kind[0]}`}>
      {kind[0] === "image" ? <img src={url} alt={name} /> : null}
      {kind[0] === "pdf" ? <iframe src={url} title={name} /> : null}
      {kind[0] === "video" ? <video src={url} controls /> : null}
    </div>
  );
}

export default FilePreview;
