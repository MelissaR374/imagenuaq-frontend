// The whole file tree, for a role holding `document.browse` (RF-ARC-02). Everyone else reaches
// files through the project they work on, so there is no "my files" screen. Every root is listed:
// a project's folder carries the project's key as its name.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import { shortDate } from "../shared/format.js";
import FolderBrowser from "./folderBrowser.jsx";
import "./documents.css";

function Documents() {
  const [roots, setRoots] = useState(null);
  const [areas, setAreas] = useState([]);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.listTopFolders(), api.listAreas()])
      .then(([folders, areaList]) => {
        if (cancelled) return;
        setRoots(folders.folders);
        setAreas(areaList.areas);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error !== null) return <p className="documents-error">{error}</p>;
  if (roots === null) return <p className="documents-note">Cargando…</p>;

  const needle = query.trim().toLowerCase();
  const shown = roots.filter((root) => root.name.toLowerCase().includes(needle));

  return (
    <div className="documents">
      <aside className="documents-roots">
        <input
          className="documents-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar carpeta o clave de proyecto"
        />

        {shown.length === 0 ? (
          <p className="documents-note">Ninguna carpeta.</p>
        ) : (
          <ul className="documents-list">
            {shown.map((root) => (
              <li key={root.id}>
                <button
                  className={`documents-root ${open?.id === root.id ? "is-active" : ""}`}
                  type="button"
                  onClick={() => setOpen(root)}
                >
                  <span className="documents-root-name">{root.name}</span>
                  <span className="documents-root-date">{shortDate(root.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className="documents-view">
        {open === null ? (
          <p className="documents-note">Elige una carpeta.</p>
        ) : (
          <FolderBrowser key={open.id} root={open} areas={areas} />
        )}
      </section>
    </div>
  );
}

export default Documents;
