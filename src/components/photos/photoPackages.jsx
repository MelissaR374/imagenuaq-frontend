// «Catálogo de precios»: the photo service's packages, edited without a deploy. Staff retire a package
// and never delete it. A paid folio keeps the name and amount of its sale, so a price change never
// rewrites one. The pre-sale price applies before a group's pre-sale date.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import { pesos } from "./photoStatus.js";
import "./photos.css";

const EMPTY = { name: "", description: "", digitalCount: "", printCount: "0", price: "", presalePrice: "" };

/** The form values as the API takes them. A blank pre-sale price clears it. */
function toBody(draft) {
  return {
    name: draft.name,
    description: draft.description === "" ? null : draft.description,
    digitalCount: Number(draft.digitalCount),
    printCount: Number(draft.printCount || 0),
    price: Number(draft.price),
    presalePrice: draft.presalePrice === "" ? null : Number(draft.presalePrice),
  };
}

function PhotoPackages() {
  const [packages, setPackages] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .listPhotoPackages()
      .then((data) => {
        if (!cancelled) setPackages(data.packages);
      })
      .catch((failure) => {
        if (!cancelled) setError(failure.message);
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  function edit(pkg) {
    setEditingId(pkg === null ? "new" : pkg.id);
    setDraft(
      pkg === null
        ? EMPTY
        : {
            name: pkg.name,
            description: pkg.description ?? "",
            digitalCount: String(pkg.digitalCount),
            printCount: String(pkg.printCount),
            price: String(Number(pkg.price)),
            presalePrice: pkg.presalePrice === null ? "" : String(Number(pkg.presalePrice)),
          },
    );
    setError(null);
  }

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setEditingId(null);
      setReload((n) => n + 1);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  function save(event) {
    event.preventDefault();
    run(() => (editingId === "new" ? api.createPhotoPackage(toBody(draft)) : api.updatePhotoPackage(editingId, toBody(draft))));
  }

  if (packages === null) return <p className="photos-note">{error ?? "Cargando…"}</p>;

  return (
    <div className="photos">
      <div className="photos-toolbar">
        <button className="photos-btn" type="button" onClick={() => edit(null)} disabled={editingId !== null}>
          Nuevo paquete
        </button>
      </div>

      {error !== null ? <p className="photos-error">{error}</p> : null}

      {editingId !== null ? (
        <form className="photos-form photos-card" onSubmit={save}>
          <h2>{editingId === "new" ? "Nuevo paquete" : "Editar paquete"}</h2>
          <label className="photos-field">
            <span>Nombre</span>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Digital 5 + 2 impresas" required />
          </label>
          <label className="photos-field">
            <span>Descripción (la ve el cliente)</span>
            <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </label>
          <label className="photos-field">
            <span>Fotos digitales</span>
            <input type="number" min={1} value={draft.digitalCount} onChange={(e) => setDraft({ ...draft, digitalCount: e.target.value })} required />
          </label>
          <label className="photos-field">
            <span>Fotos impresas</span>
            <input type="number" min={0} value={draft.printCount} onChange={(e) => setDraft({ ...draft, printCount: e.target.value })} />
          </label>
          <label className="photos-field">
            <span>Precio</span>
            <input type="number" min={0} step="0.01" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} required />
          </label>
          <label className="photos-field">
            <span>Precio de preventa (opcional)</span>
            <input type="number" min={0} step="0.01" value={draft.presalePrice} onChange={(e) => setDraft({ ...draft, presalePrice: e.target.value })} />
          </label>
          {editingId !== "new" ? <p className="photos-note">Los folios ya pagados conservan el precio con que se vendieron.</p> : null}
          <div className="photos-actions">
            <button className="photos-btn" type="submit" disabled={busy}>
              Guardar
            </button>
            <button className="photos-btn-link" type="button" onClick={() => setEditingId(null)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      <table className="photos-table">
        <thead>
          <tr>
            <th>Paquete</th>
            <th>Digitales</th>
            <th>Impresas</th>
            <th>Precio</th>
            <th>Preventa</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {packages.map((pkg) => (
            <tr key={pkg.id} className={pkg.isActive ? "" : "photos-row-closed"}>
              <td>
                {pkg.name}
                {pkg.isActive ? "" : " (retirado)"}
              </td>
              <td>{pkg.digitalCount}</td>
              <td>{pkg.printCount}</td>
              <td>{pesos(pkg.price)}</td>
              <td>{pesos(pkg.presalePrice)}</td>
              <td className="photos-actions">
                <button className="photos-btn-link" type="button" onClick={() => edit(pkg)} disabled={editingId !== null}>
                  Editar
                </button>
                <button
                  className="photos-btn-link"
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => api.updatePhotoPackage(pkg.id, { isActive: !pkg.isActive }))}
                >
                  {pkg.isActive ? "Retirar" : "Reactivar"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PhotoPackages;
