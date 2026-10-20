// A file card's picture, as Google Drive shows it: the image itself for an image file, else the
// big symbol of its kind. The bytes are fetched with the session token, since an `<img src>`
// cannot send it, and the object URL is revoked when the card goes away.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import FileIcon from "../shared/fileIcon.jsx";

/** @param {{ file: { id: number, name: string, mime: string | null } }} props */
function Thumbnail({ file }) {
  const [url, setUrl] = useState(null);
  const isImage = file.mime?.startsWith("image/") ?? false;

  useEffect(() => {
    if (!isImage) return;
    let cancelled = false;
    let made = null;
    api
      .downloadFile(file.id)
      .then((blob) => {
        if (cancelled) return;
        made = URL.createObjectURL(blob);
        setUrl(made);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (made !== null) URL.revokeObjectURL(made);
    };
  }, [file.id, isImage]);

  return (
    <span className="drive-thumb">
      {url === null ? (
        <FileIcon name={file.name} mime={file.mime} />
      ) : (
        <img className="drive-thumb-image" src={url} alt="" draggable={false} />
      )}
    </span>
  );
}

export default Thumbnail;
