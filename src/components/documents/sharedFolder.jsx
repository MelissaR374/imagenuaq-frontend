// What someone without an account sees when they open a read-only link (RF-ARC-03, RF-EXT-03),
// after Google Drive's shared view: the path, the folder's subfolders and files as a grid or a
// list, a preview for images and PDFs, and downloads; nothing to edit. The token in the address
// is the credential, so this renders before and without the login. Cards show the symbol of each
// file rather than a thumbnail, since every fetch through a link is logged as a download.
import { useEffect, useState } from "react";
import {
  MdChevronRight,
  MdDownload,
  MdGridView,
  MdSearch,
  MdViewList,
} from "react-icons/md";

import * as api from "../../api/client.js";
import { fileSize, shortDate } from "../shared/format.js";
import FileIcon from "../shared/fileIcon.jsx";
import FilePreview from "./filePreview.jsx";
import "./folderBrowser.css";
import "./sharedFolder.css";

/** MIME types the preview can show: images in an `<img>`, PDFs in an `<iframe>`. */
const PREVIEWABLE = /^(image\/|application\/pdf$)/;

/**
 * The theme the viewer last chose in the app, or their system's, as App.jsx decides it. The page
 * renders outside the app's shell, so it reads the choice itself.
 */
function themeClass() {
  let saved;
  try {
    saved = localStorage.getItem("theme");
  } catch {
    saved = null;
  }
  const dark = saved
    ? saved === "dark"
    : window.matchMedia("(prefers-color-scheme: dark)").matches;
  return dark ? "dark-mode" : "light-mode";
}

/** @param {{ token: string }} props */
function SharedFolder({ token }) {
  const [path, setPath] = useState([]);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [theme] = useState(themeClass);
  const [view, setView] = useState("grid");
  const [query, setQuery] = useState("");
  const [previewIndex, setPreviewIndex] = useState(null);

  const currentId = path.length === 0 ? null : path[path.length - 1].id;

  useEffect(() => {
    let cancelled = false;
    api
      .getSharedFolder(token, currentId)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [token, currentId]);

  function go(next) {
    setData(null);
    setQuery("");
    setPath(next);
  }

  const needle = query.trim().toLowerCase();
  const folders = (data?.folder.folders ?? []).filter((item) =>
    item.name.toLowerCase().includes(needle),
  );
  const files = (data?.folder.files ?? []).filter((item) =>
    item.name.toLowerCase().includes(needle),
  );
  const previewable = files.filter((file) => PREVIEWABLE.test(file.mime ?? ""));

  function openFile(file) {
    const index = previewable.findIndex((item) => item.id === file.id);
    if (index === -1) window.location.assign(api.sharedFileUrl(token, file.id));
    else setPreviewIndex(index);
  }

  function downloadLink(file) {
    return (
      <a
        className="drive-more"
        href={api.sharedFileUrl(token, file.id)}
        download={file.name}
        aria-label={`Descargar ${file.name}`}
        title="Descargar"
        onClick={(event) => event.stopPropagation()}
      >
        <MdDownload />
      </a>
    );
  }

  return (
    <div className={`app-container shared-page ${theme}`}>
      <div className="drive shared">
        <header className="shared-top">
          <span className="shared-brand">Imagen UAQ</span>
          {data === null ? null : (
            <span className="drive-badge">
              Solo lectura · el enlace vence el {shortDate(data.expiresAt)}
            </span>
          )}
        </header>

        <div className="drive-top">
          <div className="drive-search-box">
            <label className="drive-search">
              <MdSearch className="drive-search-icon" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar en esta carpeta"
                aria-label="Buscar en esta carpeta"
              />
            </label>
          </div>
        </div>

        <div className="drive-bar">
          <nav className="drive-path" aria-label="Ruta de la carpeta">
            <span className="drive-path-part">
              <button
                className={`drive-path-step ${path.length === 0 ? "is-current" : ""}`}
                type="button"
                onClick={() => go([])}
                aria-current={path.length === 0 ? "page" : undefined}
              >
                {path.length === 0 ? (data?.folder.name ?? "…") : "Inicio"}
              </button>
            </span>
            {path.map((step, index) => (
              <span className="drive-path-part" key={step.id}>
                <MdChevronRight className="drive-path-sep" />
                <button
                  className={`drive-path-step ${index === path.length - 1 ? "is-current" : ""}`}
                  type="button"
                  onClick={() => go(path.slice(0, index + 1))}
                  aria-current={index === path.length - 1 ? "page" : undefined}
                >
                  {step.name}
                </button>
              </span>
            ))}
          </nav>

          <div className="drive-view" role="group" aria-label="Vista">
            <button
              className={`drive-icon-btn ${view === "list" ? "is-on" : ""}`}
              type="button"
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
              aria-label="Vista de lista"
              title="Vista de lista"
            >
              <MdViewList />
            </button>
            <button
              className={`drive-icon-btn ${view === "grid" ? "is-on" : ""}`}
              type="button"
              onClick={() => setView("grid")}
              aria-pressed={view === "grid"}
              aria-label="Vista de cuadrícula"
              title="Vista de cuadrícula"
            >
              <MdGridView />
            </button>
          </div>
        </div>

        <div className="drive-body">
          {error !== null ? (
            <p className="drive-error">{error}</p>
          ) : data === null ? (
            <p className="drive-note">Cargando…</p>
          ) : folders.length === 0 && files.length === 0 ? (
            <p className="drive-empty">
              {needle !== "" ? "Nada coincide con la búsqueda." : "Carpeta vacía."}
            </p>
          ) : view === "grid" ? (
            <>
              {folders.length === 0 ? null : (
                <section className="drive-section">
                  <h3 className="drive-section-title">Carpetas</h3>
                  <ul className="drive-folders">
                    {folders.map((child) => (
                      <li key={child.id}>
                        <button
                          className="drive-item shared-tile"
                          type="button"
                          onClick={() => go([...path, child])}
                        >
                          <FileIcon folder />
                          <span className="drive-name">{child.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {files.length === 0 ? null : (
                <section className="drive-section">
                  <h3 className="drive-section-title">Archivos</h3>
                  <ul className="drive-files">
                    {files.map((file) => (
                      <li
                        className="drive-item drive-card shared-card"
                        key={file.id}
                        onClick={() => openFile(file)}
                      >
                        <span className="drive-thumb">
                          <FileIcon name={file.name} mime={file.mime} />
                        </span>
                        <span className="drive-card-foot">
                          <FileIcon name={file.name} mime={file.mime} />
                          <button
                            className="shared-open"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openFile(file);
                            }}
                          >
                            <span className="drive-name">{file.name}</span>
                          </button>
                          {downloadLink(file)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          ) : (
            <table className="drive-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Fecha</th>
                  <th>Tamaño</th>
                  <th>
                    <span className="drive-hidden">Descargar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {folders.map((child) => (
                  <tr className="drive-item" key={`d${child.id}`}>
                    <td>
                      <button className="shared-open drive-cell-name" type="button" onClick={() => go([...path, child])}>
                        <FileIcon folder />
                        <span className="drive-name">{child.name}</span>
                      </button>
                    </td>
                    <td>—</td>
                    <td>—</td>
                    <td />
                  </tr>
                ))}
                {files.map((file) => (
                  <tr className="drive-item" key={`f${file.id}`}>
                    <td>
                      <button className="shared-open drive-cell-name" type="button" onClick={() => openFile(file)}>
                        <FileIcon name={file.name} mime={file.mime} />
                        <span className="drive-name">{file.name}</span>
                      </button>
                    </td>
                    <td>{shortDate(file.createdAt)}</td>
                    <td>{fileSize(file.size)}</td>
                    <td className="drive-cell-more">{downloadLink(file)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {previewIndex === null ? null : (
        <FilePreview
          files={previewable}
          index={previewIndex}
          onIndex={setPreviewIndex}
          onClose={() => setPreviewIndex(null)}
          shareToken={token}
        />
      )}
    </div>
  );
}

export default SharedFolder;
