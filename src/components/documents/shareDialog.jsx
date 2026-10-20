// Sharing a folder, after Google Drive's «Compartir»: which areas may edit it (every area reads
// every folder), which covers everything inside unless a subfolder has its own (RF-USR-05), and
// read-only links for externals (RF-ARC-03, RF-EXT-03). A folder with no grants of its own uses
// its nearest ancestor's; saving here writes one per area, so the folder stops inheriting. A link's token comes back once, on creation, so it is shown
// then and never again. Without `document.share` the links section is left out.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import { sharedLink } from "../../config.js";
import { shortDate } from "../shared/format.js";

const LINK_DAYS = 7;

/** A date `days` from today as the yyyy-mm-dd a date input takes. */
function inDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * @param {{ target: { id: number, name: string }, onChange?: () => void, onClose: () => void }}
 *   props `onChange` runs after every change that succeeds.
 */
function ShareDialog({ target, onChange, onClose }) {
  const [areas, setAreas] = useState(null);
  const [grants, setGrants] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [canInherit, setCanInherit] = useState(false);
  const [inheritedFrom, setInheritedFrom] = useState(null);
  const [links, setLinks] = useState(null);
  const [linksHidden, setLinksHidden] = useState(false);
  const [linkUntil, setLinkUntil] = useState(inDays(LINK_DAYS));
  const [issued, setIssued] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.listAreas(), api.getFolder(target.id)])
      .then(([areaList, data]) => {
        if (cancelled) return;
        const inherited = data.folder.areas.length === 0 ? data.folder.inherited : null;
        const levels = {};
        for (const grant of inherited?.areas ?? data.folder.areas) levels[grant.areaId] = grant.level;
        setAreas(areaList.areas);
        setGrants(levels);
        setCanInherit(data.folder.areas.length > 0 && data.folder.parentId !== null);
        setInheritedFrom(inherited?.folderName ?? null);
        setCanEdit(data.folder.access !== "read");
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    api
      .listFolderLinks(target.id)
      .then((data) => {
        if (!cancelled) setLinks(data.links);
      })
      .catch(() => {
        if (!cancelled) setLinksHidden(true);
      });
    return () => {
      cancelled = true;
    };
  }, [target.id]);

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChange?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function saveGrants() {
    const list = areas.map((area) => ({
      areaId: area.id,
      level: grants[area.id] === "write" ? "write" : "read",
    }));
    run(async () => {
      await api.setFolderAreas(target.id, list);
      onClose();
    });
  }

  function inherit() {
    run(async () => {
      await api.setFolderAreas(target.id, []);
      onClose();
    });
  }

  function createLink(event) {
    event.preventDefault();
    run(async () => {
      const expiresAt = new Date(`${linkUntil}T23:59:59`).toISOString();
      const { link } = await api.createFolderLink(target.id, expiresAt);
      setIssued(sharedLink(link.token));
      setCopied(false);
      setLinks((await api.listFolderLinks(target.id)).links);
    });
  }

  function revoke(link) {
    run(async () => {
      await api.revokeLink(link.id);
      setLinks((await api.listFolderLinks(target.id)).links);
    });
  }

  async function copy() {
    await navigator.clipboard.writeText(issued);
    setCopied(true);
  }

  return (
    <dialog
      className="drive-dialog drive-share"
      ref={(element) => {
        if (element && !element.open) element.showModal();
      }}
      onClose={onClose}
    >
      <h3 className="drive-dialog-title">Compartir «{target.name}»</h3>

      {error !== null ? <p className="drive-error">{error}</p> : null}

      <section className="drive-share-section">
        <h4 className="drive-share-heading">Quién puede subir y borrar</h4>
        <p className="drive-note">Todas las áreas ven y descargan todos los archivos.</p>
        {areas === null ? (
          <p className="drive-note">Cargando…</p>
        ) : (
          <ul className="drive-share-areas">
            {areas.map((area) => (
              <li key={area.id}>
                <span>{area.name}</span>
                <select
                  value={grants[area.id] === "write" ? "write" : "read"}
                  onChange={(event) => setGrants({ ...grants, [area.id]: event.target.value })}
                  disabled={!canEdit}
                >
                  <option value="read">Solo ver</option>
                  <option value="write">Puede editar</option>
                </select>
              </li>
            ))}
          </ul>
        )}
        <p className="drive-note">
          {inheritedFrom !== null
            ? `Toma el acceso de «${inheritedFrom}». Guardar lo fija en esta carpeta y lo que tiene dentro.`
            : "Vale para esta carpeta y todo lo que tiene dentro, salvo donde una subcarpeta tenga el suyo."}
        </p>
        {canInherit && canEdit ? (
          <button className="drive-text-btn" type="button" onClick={inherit} disabled={busy}>
            Usar el acceso de la carpeta superior
          </button>
        ) : null}
      </section>

      {linksHidden ? null : (
        <section className="drive-share-section">
          <h4 className="drive-share-heading">Enlaces de solo lectura</h4>

          <form className="drive-share-new" onSubmit={createLink}>
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
            <button className="drive-text-btn" type="submit" disabled={busy}>
              Crear enlace
            </button>
          </form>

          {issued === null ? null : (
            <div className="drive-share-issued">
              <p className="drive-note">Este enlace solo se muestra una vez.</p>
              <input readOnly value={issued} onFocus={(event) => event.target.select()} />
              <button className="drive-text-btn" type="button" onClick={copy}>
                {copied ? "Copiado" : "Copiar enlace"}
              </button>
            </div>
          )}

          {links === null ? null : links.length === 0 ? (
            <p className="drive-note">Ningún enlace vigente.</p>
          ) : (
            <ul className="drive-share-links">
              {links.map((link) => (
                <li key={link.id}>
                  <span>
                    Creado el {shortDate(link.createdAt)}, vence el {shortDate(link.expiresAt)}
                  </span>
                  <button
                    className="drive-text-btn"
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

      <div className="drive-dialog-actions">
        <button className="drive-text-btn" type="button" onClick={onClose}>
          {canEdit ? "Cancelar" : "Cerrar"}
        </button>
        {canEdit ? (
          <button
            className="drive-text-btn is-primary"
            type="button"
            onClick={saveGrants}
            disabled={busy || grants === null}
          >
            Guardar
          </button>
        ) : null}
      </div>
    </dialog>
  );
}

export default ShareDialog;
