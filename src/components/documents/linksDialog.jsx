// Every share link that still works, for a role holding `document.share` (RF-ARC-03, RF-EXT-03):
// which folder it opens, until when, and the way to revoke it, open the folder or manage its
// links. New links are issued from the folder's «Compartir», since the token shows only once.
import { useEffect, useState } from "react";
import { MdFolder } from "react-icons/md";

import * as api from "../../api/client.js";
import { shortDate } from "../shared/format.js";

/**
 * @param {{
 *   onOpen: (path: Array<{ id: number, name: string }>) => void,
 *   onManage: (folder: { id: number, name: string }) => void,
 *   onChange: () => void,
 *   onClose: () => void,
 * }} props `onOpen` gets the folders from the root down to the linked one.
 */
function LinksDialog({ onOpen, onManage, onChange, onClose }) {
  const [links, setLinks] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .listLinks()
      .then((data) => {
        if (!cancelled) setLinks(data.links);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  async function revoke(link) {
    setBusy(true);
    setError(null);
    try {
      await api.revokeLink(link.id);
      setReload(reload + 1);
      onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      className="drive-dialog drive-links"
      ref={(element) => {
        if (element && !element.open) element.showModal();
      }}
      onClose={onClose}
    >
      <h3 className="drive-dialog-title">Enlaces compartidos</h3>

      {error !== null ? <p className="drive-error">{error}</p> : null}

      {links === null ? (
        error === null ? <p className="drive-note">Cargando…</p> : null
      ) : links.length === 0 ? (
        <p className="drive-note">Ninguna carpeta tiene enlaces vigentes.</p>
      ) : (
        <ul className="drive-links-list">
          {links.map((link) => (
            <li className="drive-link" key={link.id}>
              <MdFolder className="drive-move-icon" />
              <span className="drive-link-text">
                <span className="drive-name">
                  {link.folder.path.map((step) => step.name).join(" › ")}
                </span>
                {link.folder.project ? (
                  <span className="drive-item-sub">{link.folder.project.title}</span>
                ) : null}
                <span className="drive-item-sub">
                  Creado el {shortDate(link.createdAt)}, vence el {shortDate(link.expiresAt)}
                </span>
              </span>
              <span className="drive-link-actions">
                <button className="drive-text-btn" type="button" onClick={() => onOpen(link.folder.path)}>
                  Abrir carpeta
                </button>
                <button
                  className="drive-text-btn"
                  type="button"
                  onClick={() => onManage({ id: link.folder.id, name: link.folder.name })}
                >
                  Gestionar
                </button>
                <button
                  className="drive-text-btn"
                  type="button"
                  onClick={() => revoke(link)}
                  disabled={busy}
                >
                  Revocar
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="drive-dialog-actions">
        <button className="drive-text-btn" type="button" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </dialog>
  );
}

export default LinksDialog;
