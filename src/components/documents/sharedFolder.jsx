// What someone without an account sees when they open a read-only link (RF-ARC-03, RF-EXT-03):
// the folder, its subfolders and its files to download, and nothing to edit. The token in the
// address is the credential, so this renders before and without the login.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import { fileSize, shortDate } from "../shared/format.js";
import FileIcon from "../shared/fileIcon.jsx";
import "./sharedFolder.css";

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

  let content;
  if (error !== null) {
    content = <p className="shared-error">{error}</p>;
  } else if (data === null) {
    content = <p className="shared-note">Cargando…</p>;
  } else {
    content = (
      <Contents
        data={data}
        path={path}
        token={token}
        onPath={(next) => {
          setData(null);
          setPath(next);
        }}
      />
    );
  }

  return (
    <div className={`app-container shared-page ${theme}`}>
      <main className="shared">
        <p className="shared-brand">Imagen UAQ</p>
        {content}
      </main>
    </div>
  );
}

/** The folder under the link: where it is, then its subfolders and files. */
function Contents({ data, path, token, onPath }) {
  const { folder, expiresAt } = data;

  return (
    <>
      <header className="shared-head">
        <nav className="shared-path" aria-label="Ruta de la carpeta">
          <button className="shared-path-step" type="button" onClick={() => onPath([])}>
            Inicio
          </button>
          {path.map((step, index) => (
            <button
              className="shared-path-step"
              type="button"
              key={step.id}
              onClick={() => onPath(path.slice(0, index + 1))}
            >
              {step.name}
            </button>
          ))}
        </nav>
        <h1>{folder.name}</h1>
        <p className="shared-badge">Solo lectura · el enlace vence el {shortDate(expiresAt)}</p>
      </header>

      {folder.folders.length === 0 && folder.files.length === 0 ? (
        <p className="shared-empty">Carpeta vacía.</p>
      ) : (
        <ul className="shared-list">
          {folder.folders.map((child) => (
            <li className="shared-item shared-item-folder" key={`d${child.id}`}>
              <button className="shared-open" type="button" onClick={() => onPath([...path, child])}>
                <FileIcon folder />
                {child.name}
              </button>
            </li>
          ))}
          {folder.files.map((file) => (
            <li className="shared-item shared-item-file" key={`f${file.id}`}>
              <a href={api.sharedFileUrl(token, file.id)} download={file.name}>
                <FileIcon name={file.name} mime={file.mime} />
                {file.name}
              </a>
              <span className="shared-size">{fileSize(file.size)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default SharedFolder;
