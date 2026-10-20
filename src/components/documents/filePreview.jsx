// A full-screen preview after Google Drive's: the name and actions along the top, arrows to the
// neighbouring files. The bytes are fetched with the session token, or through a share link
// when given its token, and shown through an object URL, revoked when the file changes or the
// preview closes. Images go in an `<img>`, PDFs in an `<iframe>`; the caller only passes files
// of those kinds.
import { useEffect, useState } from "react";
import { MdChevronLeft, MdChevronRight, MdClose, MdDownload } from "react-icons/md";

import * as api from "../../api/client.js";
import { saveBlob } from "../shared/download.js";
import FileIcon from "../shared/fileIcon.jsx";

/**
 * @param {{
 *   files: Array<{ id: number, name: string, mime: string }>,
 *   index: number,
 *   onIndex: (index: number) => void,
 *   onClose: () => void,
 *   shareToken?: string | null,
 * }} props `shareToken` fetches through that read-only link instead of the session.
 */
function FilePreview({ files, index, onIndex, onClose, shareToken = null }) {
  const [loaded, setLoaded] = useState(null);
  const [failed, setFailed] = useState(null);

  const file = files[index];
  const ready = loaded?.id === file.id ? loaded : null;
  const error = failed?.id === file.id ? failed.message : null;

  useEffect(() => {
    let cancelled = false;
    let url = null;
    const load =
      shareToken === null ? api.downloadFile(file.id) : api.downloadSharedFile(shareToken, file.id);
    load
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setLoaded({ id: file.id, blob, url });
      })
      .catch((err) => {
        if (!cancelled) setFailed({ id: file.id, message: err.message });
      });
    return () => {
      cancelled = true;
      if (url !== null) URL.revokeObjectURL(url);
    };
  }, [file.id, shareToken]);

  function keyDown(event) {
    if (event.key === "ArrowLeft" && index > 0) onIndex(index - 1);
    if (event.key === "ArrowRight" && index < files.length - 1) onIndex(index + 1);
  }

  return (
    <dialog
      className="drive-preview"
      ref={(element) => {
        if (element && !element.open) element.showModal();
      }}
      onClose={onClose}
      onKeyDown={keyDown}
    >
      <div className="drive-preview-bar">
        <span className="drive-preview-name">
          <FileIcon name={file.name} mime={file.mime} />
          {file.name}
        </span>
        <button
          className="drive-icon-btn"
          type="button"
          onClick={() => saveBlob(ready?.blob, file.name)}
          disabled={ready === null}
          aria-label="Descargar"
          title="Descargar"
        >
          <MdDownload />
        </button>
        <button
          className="drive-icon-btn"
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          title="Cerrar"
        >
          <MdClose />
        </button>
      </div>

      <div className="drive-preview-stage">
        <button
          className="drive-preview-nav"
          type="button"
          onClick={() => onIndex(index - 1)}
          disabled={index === 0}
          aria-label="Anterior"
        >
          <MdChevronLeft />
        </button>

        {error !== null ? (
          <p className="drive-preview-note">{error}</p>
        ) : ready === null ? (
          <p className="drive-preview-note">Cargando…</p>
        ) : file.mime.startsWith("image/") ? (
          <img className="drive-preview-body" src={ready.url} alt={file.name} />
        ) : (
          <iframe className="drive-preview-body" src={ready.url} title={file.name} />
        )}

        <button
          className="drive-preview-nav"
          type="button"
          onClick={() => onIndex(index + 1)}
          disabled={index === files.length - 1}
          aria-label="Siguiente"
        >
          <MdChevronRight />
        </button>
      </div>
    </dialog>
  );
}

export default FilePreview;
