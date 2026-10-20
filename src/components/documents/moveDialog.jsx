// Choosing where to move items, after Google Drive's «Mover»: one folder's subfolders at a time,
// starting where the browser is. The folders being moved are not offered as destinations, and the
// server refuses a move into their own subtree anyway.
import { useEffect, useState } from "react";
import { MdArrowBack, MdChevronRight, MdFolder } from "react-icons/md";

import * as api from "../../api/client.js";

/**
 * @param {{
 *   start: Array<{ id: number | null, name: string }>,
 *   count: number,
 *   excluded: number[],
 *   onMove: (folderId: number) => void,
 *   onClose: () => void,
 * }} props `start` is the browser's path; a step with a null id is the list of every root, where
 *   nothing can be moved to.
 */
function MoveDialog({ start, count, excluded, onMove, onClose }) {
  const [path, setPath] = useState(start);
  const [folders, setFolders] = useState(null);
  const [error, setError] = useState(null);

  const here = path[path.length - 1];
  const from = start[start.length - 1].id;

  useEffect(() => {
    let cancelled = false;
    const load =
      here.id === null
        ? api.listTopFolders().then((data) => data.folders)
        : api.getFolder(here.id).then((data) => data.folder.folders);
    load
      .then((list) => {
        if (!cancelled) setFolders(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [here.id]);

  function go(next) {
    setFolders(null);
    setError(null);
    setPath(next);
  }

  return (
    <dialog
      className="drive-dialog drive-move"
      ref={(element) => {
        if (element && !element.open) element.showModal();
      }}
      onClose={onClose}
    >
      <h3 className="drive-dialog-title">
        Mover {count === 1 ? "1 elemento" : `${count} elementos`}
      </h3>

      <div className="drive-move-head">
        <button
          className="drive-icon-btn"
          type="button"
          onClick={() => go(path.slice(0, -1))}
          disabled={path.length === 1}
          aria-label="Subir un nivel"
        >
          <MdArrowBack />
        </button>
        <span className="drive-move-here">{here.name}</span>
      </div>

      {error !== null ? (
        <p className="drive-error">{error}</p>
      ) : folders === null ? (
        <p className="drive-note">Cargando…</p>
      ) : folders.length === 0 ? (
        <p className="drive-note">Sin subcarpetas.</p>
      ) : (
        <ul className="drive-move-list">
          {folders.map((child) => (
            <li key={child.id}>
              <button
                className="drive-move-folder"
                type="button"
                onClick={() => go([...path, { id: child.id, name: child.name }])}
                disabled={excluded.includes(child.id)}
              >
                <MdFolder className="drive-move-icon" />
                <span className="drive-name">{child.name}</span>
                <MdChevronRight />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="drive-dialog-actions">
        <button className="drive-text-btn" type="button" onClick={onClose}>
          Cancelar
        </button>
        <button
          className="drive-text-btn is-primary"
          type="button"
          onClick={() => onMove(here.id)}
          disabled={here.id === null || here.id === from || excluded.includes(here.id)}
        >
          Mover aquí
        </button>
      </div>
    </dialog>
  );
}

export default MoveDialog;
