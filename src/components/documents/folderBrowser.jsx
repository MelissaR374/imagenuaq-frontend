// One folder tree, browsed from a root: a project's folder in its detail, or any root from the
// «Archivos» tab (RF-ARC-01, RF-ARC-02). What the caller may do comes back with the folder as
// `access` (owner, write or read); the server still decides, and its refusal is shown as sent.
//
// Read-only links (RF-ARC-03, RF-EXT-03) are issued per folder. The token comes back once, on
// creation, so the link is shown then and never again.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import { saveBlob } from "../shared/download.js";
import { sharedLink } from "../../config.js";
import { fileSize, shortDate } from "../shared/format.js";
import FileIcon from "../shared/fileIcon.jsx";
import "./folderBrowser.css";

const LINK_DAYS = 7;

/** A date `days` from today as the yyyy-mm-dd a date input takes. */
function inDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}


/**
 * @param {{ root: { id: number, name: string }, areas: Array<{ id: number, name: string }> }} props
 *   Remount it with `key={root.id}` to browse another root.
 */
function FolderBrowser({ root, areas }) {
  const [path, setPath] = useState([root]);
  const [folder, setFolder] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [newFolder, setNewFolder] = useState("");
  const [links, setLinks] = useState(null);
  const [linkUntil, setLinkUntil] = useState(inDays(LINK_DAYS));
  const [issued, setIssued] = useState(null);
  const [grants, setGrants] = useState(null);

  const current = path[path.length - 1];

  useEffect(() => {
    let cancelled = false;
    api
      .getFolder(current.id)
      .then((data) => {
        if (!cancelled) setFolder(data.folder);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [current.id, reload]);

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setReload((n) => n + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function open(child) {
    setFolder(null);
    setLinks(null);
    setIssued(null);
    setGrants(null);
    setPath([...path, { id: child.id, name: child.name }]);
  }

  function goTo(index) {
    if (index === path.length - 1) return;
    setFolder(null);
    setLinks(null);
    setIssued(null);
    setGrants(null);
    setPath(path.slice(0, index + 1));
  }

  function upload(event) {
    const files = [...event.target.files];
    event.target.value = "";
    run(async () => {
      for (const file of files) await api.uploadFile(current.id, file);
    });
  }

  function createFolder(event) {
    event.preventDefault();
    const name = newFolder.trim();
    if (name === "") return;
    run(async () => {
      await api.createFolder(current.id, name);
      setNewFolder("");
    });
  }

  function renameFolder(child) {
    const name = window.prompt("Nuevo nombre de la carpeta", child.name);
    if (name === null || name.trim() === "" || name === child.name) return;
    run(() => api.updateFolder(child.id, { name: name.trim() }));
  }

  function deleteFolder(child) {
    if (!window.confirm(`¿Eliminar «${child.name}» con todo lo que tiene dentro?`)) return;
    run(() => api.deleteFolder(child.id));
  }

  function renameFile(file) {
    const name = window.prompt("Nuevo nombre del archivo", file.name);
    if (name === null || name.trim() === "" || name === file.name) return;
    run(() => api.updateFile(file.id, { name: name.trim() }));
  }

  function deleteFile(file) {
    if (!window.confirm(`¿Eliminar «${file.name}»?`)) return;
    run(() => api.deleteFile(file.id));
  }

  async function download(file) {
    setError(null);
    try {
      saveBlob(await api.downloadFile(file.id), file.name);
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleLinks() {
    if (links !== null) {
      setLinks(null);
      setIssued(null);
      return;
    }
    setError(null);
    try {
      setLinks((await api.listFolderLinks(current.id)).links);
    } catch (err) {
      setError(err.message);
    }
  }

  function createLink(event) {
    event.preventDefault();
    run(async () => {
      const expiresAt = new Date(`${linkUntil}T23:59:59`).toISOString();
      const { link } = await api.createFolderLink(current.id, expiresAt);
      setIssued(sharedLink(link.token));
      setLinks((await api.listFolderLinks(current.id)).links);
    });
  }

  function revoke(link) {
    run(async () => {
      await api.revokeLink(link.id);
      setLinks((await api.listFolderLinks(current.id)).links);
    });
  }

  function toggleGrants() {
    if (grants !== null) {
      setGrants(null);
      return;
    }
    const levels = {};
    for (const grant of folder.areas) levels[grant.areaId] = grant.level;
    setGrants(levels);
  }

  function setLevel(areaId, level) {
    setGrants({ ...grants, [areaId]: level });
  }

  function saveGrants() {
    const list = Object.entries(grants)
      .filter(([, level]) => level !== "")
      .map(([areaId, level]) => ({ areaId: Number(areaId), level }));
    run(async () => {
      await api.setFolderAreas(current.id, list);
      setGrants(null);
    });
  }

  const canWrite = folder !== null && folder.access !== "read";

  return (
    <div className="folder-browser">
      <nav className="folder-path" aria-label="Ruta de la carpeta">
        {path.map((step, index) => (
          <button
            className="folder-path-step"
            type="button"
            key={step.id}
            onClick={() => goTo(index)}
            aria-current={index === path.length - 1 ? "page" : undefined}
          >
            {step.name}
          </button>
        ))}
      </nav>

      {error !== null ? <p className="folder-error">{error}</p> : null}

      {folder === null ? (
        error === null ? <p className="folder-note">Cargando…</p> : null
      ) : (
        <>
          <div className="folder-actions">
            {canWrite ? (
              <>
                <label className="folder-btn is-primary folder-upload">
                  Subir archivos
                  <input type="file" multiple onChange={upload} disabled={busy} />
                </label>

                <form className="folder-new" onSubmit={createFolder}>
                  <input
                    value={newFolder}
                    onChange={(event) => setNewFolder(event.target.value)}
                    placeholder="Nueva carpeta"
                    maxLength={255}
                  />
                  <button className="folder-btn" type="submit" disabled={busy}>
                    Crear
                  </button>
                </form>
              </>
            ) : (
              <span className="folder-readonly">Solo lectura</span>
            )}

            <button
              className={`folder-btn ${links !== null ? "is-on" : ""}`}
              type="button"
              onClick={toggleLinks}
              aria-expanded={links !== null}
            >
              Compartir
            </button>

            {canWrite ? (
              <button
                className={`folder-btn ${grants !== null ? "is-on" : ""}`}
                type="button"
                onClick={toggleGrants}
                aria-expanded={grants !== null}
              >
                Acceso por área
              </button>
            ) : null}
          </div>

          {links === null ? null : (
            <section className="folder-panel">
              <h4>Enlaces de solo lectura</h4>

              <form className="folder-link-new" onSubmit={createLink}>
                <label>
                  Vence el
                  <input
                    type="date"
                    value={linkUntil}
                    min={inDays(0)}
                    onChange={(event) => setLinkUntil(event.target.value)}
                    required
                  />
                </label>
                <button className="folder-btn is-primary" type="submit" disabled={busy}>
                  Crear enlace
                </button>
              </form>

              {issued === null ? null : (
                <p className="folder-issued">
                  Copia este enlace para compartir los archivos del proyecto. Solo se mostrara una vez
                  <input readOnly value={issued} onFocus={(event) => event.target.select()} />
                </p>
              )}

              {links.length === 0 ? (
                <p className="folder-note">Ningún enlace vigente.</p>
              ) : (
                <ul className="folder-links">
                  {links.map((link) => (
                    <li key={link.id}>
                      <span>
                        Creado el {shortDate(link.createdAt)}, vence el {shortDate(link.expiresAt)}
                      </span>
                      <button
                        className="folder-quiet"
                        type="button"
                        onClick={() => revoke(link)}
                        disabled={busy}
                      >
                        Revocar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {grants === null ? null : (
            <section className="folder-panel">
              <h4>Acceso por área</h4>
              <p className="folder-note">
                Vale para esta carpeta y todo lo que tiene dentro, salvo donde una subcarpeta tenga
                el suyo.
              </p>
              <ul className="folder-grants">
                {areas.map((area) => (
                  <li key={area.id}>
                    <span>{area.name}</span>
                    <select
                      value={grants[area.id] ?? ""}
                      onChange={(event) => setLevel(area.id, event.target.value)}
                    >
                      <option value="">Sin acceso</option>
                      <option value="read">Ver</option>
                      <option value="write">Ver y editar</option>
                    </select>
                  </li>
                ))}
              </ul>
              <div className="folder-panel-actions">
                <button
                  className="folder-btn is-primary"
                  type="button"
                  onClick={saveGrants}
                  disabled={busy}
                >
                  Guardar acceso
                </button>
              </div>
            </section>
          )}

          {folder.folders.length === 0 && folder.files.length === 0 ? (
            <p className="folder-empty">
              {canWrite ? "Carpeta vacía. Sube archivos o crea una carpeta." : "Carpeta vacía."}
            </p>
          ) : (
            <div className="folder-table-wrap">
              <table className="folder-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Tamaño</th>
                    <th>Fecha</th>
                    <th>
                      <span className="folder-hidden">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {folder.folders.map((child) => (
                    <tr className="folder-row folder-row-folder" key={`d${child.id}`}>
                      <td>
                        <span className="folder-name">
                          <FileIcon folder />
                          <button className="folder-open" type="button" onClick={() => open(child)}>
                            {child.name}
                          </button>
                        </span>
                      </td>
                      <td>—</td>
                      <td>{shortDate(child.createdAt)}</td>
                      <td className="folder-row-actions">
                        {canWrite ? (
                          <>
                            <button
                              className="folder-quiet"
                              type="button"
                              onClick={() => renameFolder(child)}
                              disabled={busy}
                            >
                              Renombrar
                            </button>
                            <button
                              className="folder-quiet is-danger"
                              type="button"
                              onClick={() => deleteFolder(child)}
                              disabled={busy}
                            >
                              Eliminar
                            </button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {folder.files.map((file) => (
                    <tr className="folder-row folder-row-file" key={`f${file.id}`}>
                      <td>
                        <span className="folder-name">
                          <FileIcon name={file.name} mime={file.mime} />
                          {file.name}
                        </span>
                      </td>
                      <td>{fileSize(file.size)}</td>
                      <td>{shortDate(file.createdAt)}</td>
                      <td className="folder-row-actions">
                        <button className="folder-quiet" type="button" onClick={() => download(file)}>
                          Descargar
                        </button>
                        {canWrite ? (
                          <>
                            <button
                              className="folder-quiet"
                              type="button"
                              onClick={() => renameFile(file)}
                              disabled={busy}
                            >
                              Renombrar
                            </button>
                            <button
                              className="folder-quiet is-danger"
                              type="button"
                              onClick={() => deleteFile(file)}
                              disabled={busy}
                            >
                              Eliminar
                            </button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default FolderBrowser;
