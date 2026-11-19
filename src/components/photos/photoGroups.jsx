// «Grupos» of the photo mode: every photo session group with how far its folios are, and the form
// that creates one. Creating a group generates its folios at once, so the sheets can be printed
// before anyone signs up. Opening a group shows its folios.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import { shortDate } from "../shared/format.js";
import PhotoGroup from "./photoGroup.jsx";
import { STATUS_LABELS } from "./photoStatus.js";
import "./photos.css";

const EMPTY = { name: "", code: "", size: "30", eventStartsAt: "", eventEndsAt: "", presaleUntil: "", downloadDays: "" };

/** @param {{ canManage: boolean }} props */
function PhotoGroups({ canManage }) {
  const [groups, setGroups] = useState(null);
  const [packages, setPackages] = useState([]);
  const [retention, setRetention] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(EMPTY);
  const [packageIds, setPackageIds] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.listPhotoGroups(), api.listPhotoPackages(), api.getPhotoRetention()])
      .then(([groupData, packageData, retentionData]) => {
        if (cancelled) return;
        setGroups(groupData.groups);
        setPackages(packageData.packages.filter((pkg) => pkg.isActive));
        setRetention(retentionData.retention.days);
      })
      .catch((failure) => {
        if (!cancelled) setError(failure.message);
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  function startCreating() {
    setDraft(EMPTY);
    setPackageIds(packages.map((pkg) => pkg.id));
    setCreating(true);
    setError(null);
  }

  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.createPhotoGroup({
        name: draft.name,
        code: draft.code,
        size: Number(draft.size),
        eventStartsAt: new Date(draft.eventStartsAt).toISOString(),
        eventEndsAt: new Date(draft.eventEndsAt).toISOString(),
        presaleUntil: draft.presaleUntil ? new Date(draft.presaleUntil).toISOString() : null,
        downloadDays: draft.downloadDays === "" ? null : Number(draft.downloadDays),
        packageIds,
      });
      setCreating(false);
      setOpenId(result.group.id);
      setReload((n) => n + 1);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  function togglePackage(id) {
    setPackageIds(packageIds.includes(id) ? packageIds.filter((other) => other !== id) : [...packageIds, id]);
  }

  if (openId !== null) {
    return (
      <PhotoGroup
        groupId={openId}
        canManage={canManage}
        onBack={() => {
          setOpenId(null);
          setReload((n) => n + 1);
        }}
      />
    );
  }

  if (groups === null) return <p className="photos-note">{error ?? "Cargando…"}</p>;

  return (
    <div className="photos">
      <div className="photos-toolbar">
        {canManage && !creating ? (
          <button className="photos-btn" type="button" onClick={startCreating}>
            Nuevo grupo
          </button>
        ) : null}
      </div>

      {error !== null ? <p className="photos-error">{error}</p> : null}

      {creating ? (
        <form className="photos-form photos-card" onSubmit={create}>
          <h2>Nuevo grupo</h2>
          <label className="photos-field">
            <span>Nombre</span>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Bachiller grupo 7 2026-1" required />
          </label>
          <label className="photos-field">
            <span>Clave (prefijo de los folios)</span>
            <input
              value={draft.code}
              onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
              placeholder="B7"
              maxLength={12}
              pattern="[A-Za-z0-9]{1,12}"
              required
            />
          </label>
          <label className="photos-field">
            <span>Cuántas personas (folios)</span>
            <input type="number" min={1} max={1000} value={draft.size} onChange={(e) => setDraft({ ...draft, size: e.target.value })} required />
          </label>
          <label className="photos-field">
            <span>Inicio de la sesión</span>
            <input type="datetime-local" value={draft.eventStartsAt} onChange={(e) => setDraft({ ...draft, eventStartsAt: e.target.value })} required />
          </label>
          <label className="photos-field">
            <span>Fin de la sesión</span>
            <input type="datetime-local" value={draft.eventEndsAt} onChange={(e) => setDraft({ ...draft, eventEndsAt: e.target.value })} required />
          </label>
          <label className="photos-field">
            <span>Preventa hasta (opcional)</span>
            <input type="datetime-local" value={draft.presaleUntil} onChange={(e) => setDraft({ ...draft, presaleUntil: e.target.value })} />
          </label>
          <label className="photos-field">
            <span>Días para descargar</span>
            <input
              type="number"
              min={1}
              value={draft.downloadDays}
              placeholder={retention === null ? "" : `${retention} (lo configurado)`}
              onChange={(e) => setDraft({ ...draft, downloadDays: e.target.value })}
            />
          </label>
          <fieldset className="photos-checks">
            <legend>Paquetes que ofrece</legend>
            {packages.length === 0 ? <p className="photos-note">No hay paquetes activos: agrégalos en «Catálogo de precios».</p> : null}
            {packages.map((pkg) => (
              <label className="photos-check" key={pkg.id}>
                <input type="checkbox" checked={packageIds.includes(pkg.id)} onChange={() => togglePackage(pkg.id)} />
                <span>{pkg.name}</span>
              </label>
            ))}
          </fieldset>
          <div className="photos-actions">
            <button className="photos-btn" type="submit" disabled={busy}>
              Crear grupo y folios
            </button>
            <button className="photos-btn-link" type="button" onClick={() => setCreating(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {groups.length === 0 ? (
        <p className="photos-note">Todavía no hay grupos.</p>
      ) : (
        <table className="photos-table">
          <thead>
            <tr>
              <th>Grupo</th>
              <th>Sesión</th>
              <th>Folios</th>
              <th>Avance</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.id} className={group.closedAt ? "photos-row-closed" : ""}>
                <td>
                  <button className="photos-btn-link" type="button" onClick={() => setOpenId(group.id)}>
                    {group.name}
                  </button>
                  <span className="photos-note"> {group.code}</span>
                  {group.activePackages === 0 ? (
                    <span className="photo-flag" title="Sin paquetes nadie puede registrarse ni pagar. Elígelos en «Configurar grupo».">
                      Sin paquetes
                    </span>
                  ) : null}
                </td>
                <td>{shortDate(group.eventStartsAt)}</td>
                <td>{group.size}</td>
                <td className="photos-counts">
                  {Object.entries(group.byStatus ?? {}).map(([status, count]) => (
                    <span className={`photo-status photo-status-${status}`} key={status}>
                      {STATUS_LABELS[status]}: {count}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default PhotoGroups;
