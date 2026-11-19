// One photo group: a folio table to filter by status, the open folio beside it, and the group's
// settings. A change to the download days also moves the deadline of folios already ready.
// The sheets print from here.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import { orDash, shortDate } from "../shared/format.js";
import FolioPanel from "./folioPanel.jsx";
import PhotoSheets from "./photoSheets.jsx";
import { STATUS_LABELS, pesos } from "./photoStatus.js";
import "./photos.css";

/** A moment as the value a datetime-local input takes, in the viewer's time. */
function localInput(value) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/** @param {{ groupId: number, canManage: boolean, onBack: () => void }} props */
function PhotoGroup({ groupId, canManage, onBack }) {
  const [group, setGroup] = useState(null);
  const [folios, setFolios] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [openFolio, setOpenFolio] = useState(null);
  const [editing, setEditing] = useState(null);
  const [printing, setPrinting] = useState(false);
  const [adding, setAdding] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getPhotoGroup(groupId), api.listPhotoFolios(groupId), api.listPhotoPackages()])
      .then(([groupData, folioData, packageData]) => {
        if (cancelled) return;
        setGroup(groupData.group);
        setFolios(folioData.folios);
        setCatalog(packageData.packages);
      })
      .catch((failure) => {
        if (!cancelled) setError(failure.message);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, reload]);

  function startEditing() {
    setEditing({
      name: group.name,
      eventStartsAt: localInput(group.eventStartsAt),
      eventEndsAt: localInput(group.eventEndsAt),
      presaleUntil: localInput(group.presaleUntil),
      downloadDays: String(group.downloadDays),
      packageIds: group.packages.map((pkg) => pkg.id),
    });
  }

  async function save(event) {
    event.preventDefault();
    await run(() =>
      api.updatePhotoGroup(groupId, {
        name: editing.name,
        eventStartsAt: new Date(editing.eventStartsAt).toISOString(),
        eventEndsAt: new Date(editing.eventEndsAt).toISOString(),
        presaleUntil: editing.presaleUntil ? new Date(editing.presaleUntil).toISOString() : null,
        downloadDays: Number(editing.downloadDays),
        packageIds: editing.packageIds,
      }),
    );
    setEditing(null);
  }

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setReload((n) => n + 1);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  function togglePackage(id) {
    const ids = editing.packageIds;
    setEditing({ ...editing, packageIds: ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id] });
  }

  if (printing) return <PhotoSheets group={group} onBack={() => setPrinting(false)} />;
  if (group === null) return <p className="photos-note">{error ?? "Cargando…"}</p>;

  const needle = search.trim().toLowerCase();
  const shown = folios.filter(
    (folio) =>
      (filter === "" || folio.status === filter) &&
      (needle === "" || folio.label.toLowerCase().includes(needle) || (folio.fullName ?? "").toLowerCase().includes(needle)),
  );

  return (
    <div className="photos">
      <div className="photos-toolbar">
        <button className="photos-btn-link" type="button" onClick={onBack}>
          ← Grupos
        </button>
        {canManage ? (
          <>
            <button className="photos-btn" type="button" onClick={() => setPrinting(true)}>
              Imprimir hojas
            </button>
            <button className="photos-btn" type="button" onClick={startEditing} disabled={editing !== null}>
              Configurar grupo
            </button>
          </>
        ) : null}
      </div>

      <header className="photos-card">
        <h2>
          {group.name} <span className="photos-note">{group.code}</span>
        </h2>
        <dl className="photos-facts">
          <dt>Sesión</dt>
          <dd>
            {new Date(group.eventStartsAt).toLocaleString("es-MX")} – {new Date(group.eventEndsAt).toLocaleTimeString("es-MX")}
          </dd>
          <dt>Preventa hasta</dt>
          <dd>{orDash(group.presaleUntil && shortDate(group.presaleUntil))}</dd>
          <dt>Días para descargar</dt>
          <dd>{group.downloadDays}</dd>
          <dt>Paquetes</dt>
          <dd>{group.packages.map((pkg) => `${pkg.name} (${pesos(pkg.priceNow)})`).join(", ") || "—"}</dd>
          <dt>Estado</dt>
          <dd>{group.closedAt ? `Cerrado el ${shortDate(group.closedAt)}` : "Abierto"}</dd>
        </dl>
      </header>

      {error !== null ? <p className="photos-error">{error}</p> : null}

      {editing !== null ? (
        <form className="photos-form photos-card" onSubmit={save}>
          <h3>Configurar grupo</h3>
          <label className="photos-field">
            <span>Nombre</span>
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
          </label>
          <label className="photos-field">
            <span>Inicio de la sesión</span>
            <input type="datetime-local" value={editing.eventStartsAt} onChange={(e) => setEditing({ ...editing, eventStartsAt: e.target.value })} required />
          </label>
          <label className="photos-field">
            <span>Fin de la sesión</span>
            <input type="datetime-local" value={editing.eventEndsAt} onChange={(e) => setEditing({ ...editing, eventEndsAt: e.target.value })} required />
          </label>
          <label className="photos-field">
            <span>Preventa hasta</span>
            <input type="datetime-local" value={editing.presaleUntil} onChange={(e) => setEditing({ ...editing, presaleUntil: e.target.value })} />
          </label>
          <label className="photos-field">
            <span>Días para descargar</span>
            <input type="number" min={1} value={editing.downloadDays} onChange={(e) => setEditing({ ...editing, downloadDays: e.target.value })} required />
          </label>
          <p className="photos-note">Cambiar los días también mueve la fecha límite de los folios que ya tienen sus fotos listas.</p>
          <fieldset className="photos-checks">
            <legend>Paquetes que ofrece</legend>
            {catalog
              .filter((pkg) => pkg.isActive || editing.packageIds.includes(pkg.id))
              .map((pkg) => (
                <label className="photos-check" key={pkg.id}>
                  <input type="checkbox" checked={editing.packageIds.includes(pkg.id)} onChange={() => togglePackage(pkg.id)} />
                  <span>
                    {pkg.name}
                    {pkg.isActive ? "" : " (retirado)"}
                  </span>
                </label>
              ))}
          </fieldset>
          <div className="photos-actions">
            <button className="photos-btn" type="submit" disabled={busy}>
              Guardar
            </button>
            <button className="photos-btn-link" type="button" onClick={() => setEditing(null)}>
              Cancelar
            </button>
            <button className="photos-btn-link" type="button" disabled={busy} onClick={() => run(() => api.updatePhotoGroup(groupId, { closed: !group.closedAt }))}>
              {group.closedAt ? "Reabrir grupo" : "Cerrar grupo"}
            </button>
          </div>
        </form>
      ) : null}

      <div className="photos-toolbar">
        <input className="photos-search" type="search" placeholder="Buscar folio o nombre" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([status, label]) => (
            <option key={status} value={status}>
              {label}
            </option>
          ))}
        </select>
        {canManage ? (
          <form
            className="photos-inline"
            onSubmit={(event) => {
              event.preventDefault();
              run(() => api.addPhotoFolios(groupId, Number(adding))).then(() => setAdding(""));
            }}
          >
            <input type="number" min={1} placeholder="Más folios" value={adding} onChange={(e) => setAdding(e.target.value)} required />
            <button className="photos-btn" type="submit" disabled={busy}>
              Agregar
            </button>
          </form>
        ) : null}
      </div>

      <div className="photos-split">
        <table className="photos-table">
          <thead>
            <tr>
              <th>Folio</th>
              <th>Nombre</th>
              <th>Estado</th>
              <th>Paquete</th>
              <th>Fotos</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((folio) => (
              <tr key={folio.id} className={openFolio === folio.id ? "photos-row-open" : ""}>
                <td>
                  <button className="photos-btn-link" type="button" onClick={() => setOpenFolio(folio.id)}>
                    {folio.label}
                  </button>
                </td>
                <td>{orDash(folio.fullName)}</td>
                <td>
                  <span className={`photo-status photo-status-${folio.status}`}>{STATUS_LABELS[folio.status]}</span>
                </td>
                <td>{orDash(folio.packageName)}</td>
                <td>
                  {folio.proofCount} muestras · {folio.finalCount} editadas
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {openFolio !== null ? (
          <FolioPanel key={openFolio} folioId={openFolio} canManage={canManage} onChange={() => setReload((n) => n + 1)} />
        ) : null}
      </div>
    </div>
  );
}

export default PhotoGroup;
