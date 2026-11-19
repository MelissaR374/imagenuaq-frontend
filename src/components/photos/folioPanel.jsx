// One photo folio at the desk: the client's data, the cajas payment, the photos and the last steps.
// Staff type the data by hand for a paper sheet. The group screen and the scanner use it.
// It fetches previews with the token and shows them as object URLs.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import { saveBlob } from "../shared/download.js";
import { fileSize, orDash, shortDate } from "../shared/format.js";
import { STATUS_LABELS, pesos } from "./photoStatus.js";
import "./photos.css";

/** @param {{ folioId: number, canManage: boolean, onChange?: () => void }} props */
function FolioPanel({ folioId, canManage, onChange }) {
  const [folio, setFolio] = useState(null);
  const [data, setData] = useState({ fullName: "", email: "", phone: "", schoolId: "" });
  const [payment, setPayment] = useState({ packageId: "", cajaFolio: "", amount: "" });
  const [previews, setPreviews] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getPhotoFolio(folioId)
      .then((result) => {
        if (!cancelled) show(result.folio);
      })
      .catch((failure) => {
        if (!cancelled) setError(failure.message);
      });
    return () => {
      cancelled = true;
    };
  }, [folioId]);

  const proofIds = folio === null ? "" : folio.files.filter((file) => file.kind === "proof").map((file) => file.id).join(",");

  useEffect(() => {
    if (proofIds === "") return;
    let cancelled = false;
    const urls = {};
    Promise.all(
      proofIds.split(",").map((id) =>
        api
          .getPhotoBlob(id)
          .then((blob) => {
            urls[id] = URL.createObjectURL(blob);
          })
          .catch(() => {}),
      ),
    ).then(() => {
      if (!cancelled) setPreviews(urls);
    });
    return () => {
      cancelled = true;
      Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [proofIds]);

  function show(next) {
    setFolio(next);
    setData({
      fullName: next.fullName ?? "",
      email: next.email ?? "",
      phone: next.phone ?? "",
      schoolId: next.schoolId ?? "",
    });
    setPayment({ packageId: next.packageId ?? "", cajaFolio: "", amount: "" });
  }

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      if (result?.folio) show(result.folio);
      else show((await api.getPhotoFolio(folioId)).folio);
      onChange?.();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  function saveData(event) {
    event.preventDefault();
    run(() => api.updatePhotoFolio(folioId, data));
  }

  function pay(event) {
    event.preventDefault();
    run(() =>
      api.recordPhotoPayment(folioId, {
        packageId: Number(payment.packageId),
        cajaFolio: payment.cajaFolio,
        ...(payment.amount === "" ? {} : { amount: Number(payment.amount) }),
      }),
    );
  }

  function upload(kind, fileList) {
    const files = [...fileList];
    run(async () => {
      for (const file of files) await api.uploadPhoto(folioId, kind, file);
    });
  }

  async function downloadOriginal(file) {
    try {
      saveBlob(await api.getPhotoBlob(file.id, true), file.name);
    } catch (failure) {
      setError(failure.message);
    }
  }

  if (folio === null) return <p className="photos-note">{error ?? "Cargando…"}</p>;

  const proofs = folio.files.filter((file) => file.kind === "proof");
  const finals = folio.files.filter((file) => file.kind === "final");
  const chosen = folio.packages.find((pkg) => String(pkg.id) === String(payment.packageId));
  const paid = folio.paidAt !== null;

  return (
    <article className="folio-panel">
      <header className="folio-panel-head">
        <h2 className="folio-panel-title">{folio.label}</h2>
        <span className={`photo-status photo-status-${folio.status}`}>{STATUS_LABELS[folio.status]}</span>
        <span className="photos-note">{folio.groupName}</span>
      </header>

      {error !== null ? <p className="photos-error">{error}</p> : null}

      <section className="folio-panel-sec">
        <h3>Datos del cliente</h3>
        <form className="photos-form" onSubmit={saveData}>
          <label className="photos-field">
            <span>Nombre completo</span>
            <input value={data.fullName} onChange={(e) => setData({ ...data, fullName: e.target.value })} disabled={!canManage} />
          </label>
          <label className="photos-field">
            <span>Correo</span>
            <input type="email" value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} disabled={!canManage} />
          </label>
          <label className="photos-field">
            <span>Teléfono</span>
            <input type="tel" value={data.phone} onChange={(e) => setData({ ...data, phone: e.target.value })} disabled={!canManage} />
          </label>
          <label className="photos-field">
            <span>Expediente</span>
            <input value={data.schoolId} onChange={(e) => setData({ ...data, schoolId: e.target.value })} disabled={!canManage} />
          </label>
          {canManage ? (
            <button className="photos-btn" type="submit" disabled={busy}>
              Guardar datos
            </button>
          ) : null}
        </form>
        <p className="photos-note">
          {folio.registeredVia === "manual" ? "Capturado en la mesa" : folio.registeredVia === "qr" ? "Registrado por el cliente" : "Sin registrar"}
          {folio.registeredAt ? ` · ${shortDate(folio.registeredAt)}` : ""}
        </p>
      </section>

      <section className="folio-panel-sec">
        <h3>Pago</h3>
        {paid ? (
          <dl className="photos-facts">
            <dt>Paquete</dt>
            <dd>{folio.packageName}</dd>
            <dt>Monto</dt>
            <dd>{pesos(folio.amount)}</dd>
            <dt>Folio de cajas</dt>
            <dd>{folio.cajaFolio}</dd>
            <dt>Fecha</dt>
            <dd>{shortDate(folio.paidAt)}</dd>
          </dl>
        ) : canManage ? (
          <form className="photos-form" onSubmit={pay}>
            <label className="photos-field">
              <span>Paquete</span>
              <select value={payment.packageId} onChange={(e) => setPayment({ ...payment, packageId: e.target.value })} required>
                <option value="">Elige un paquete</option>
                {folio.packages
                  .filter((pkg) => pkg.isActive)
                  .map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} · {pesos(pkg.priceNow)}
                    </option>
                  ))}
              </select>
            </label>
            <label className="photos-field">
              <span>Folio del recibo de cajas</span>
              <input value={payment.cajaFolio} onChange={(e) => setPayment({ ...payment, cajaFolio: e.target.value })} required />
            </label>
            <label className="photos-field">
              <span>Monto cobrado</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={payment.amount}
                placeholder={chosen ? String(Number(chosen.priceNow)) : ""}
                onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
              />
            </label>
            <button className="photos-btn" type="submit" disabled={busy || !folio.fullName}>
              Registrar pago
            </button>
            {!folio.fullName ? <p className="photos-note">Guarda primero el nombre del cliente.</p> : null}
          </form>
        ) : (
          <p className="photos-note">Sin pagar.</p>
        )}
      </section>

      <section className="folio-panel-sec">
        <h3>Muestras</h3>
        <p className="photos-note">
          {folio.digitalCount ? `El paquete incluye ${folio.digitalCount} fotos digitales` : "Sin paquete todavía"}
          {folio.printCount ? ` y ${folio.printCount} impresas` : ""}.
          {folio.selectionLockedAt ? ` Elección enviada el ${shortDate(folio.selectionLockedAt)}.` : ""}
        </p>
        <ul className="photo-grid">
          {proofs.map((file) => (
            <li className={`photo-tile ${file.selected ? "photo-tile-selected" : ""}`} key={file.id}>
              {previews[file.id] ? <img className="photo-tile-img" src={previews[file.id]} alt={file.name} /> : null}
              <span className="photo-tile-name">{file.name}</span>
              {file.selected ? <span className="photo-tile-badge">Elegida</span> : null}
              {canManage ? (
                <button className="photos-btn-link" type="button" onClick={() => run(() => api.deletePhotoFile(file.id))} disabled={busy}>
                  Quitar
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {canManage && paid && !folio.filesExpiredAt ? (
          <label className="photos-upload">
            <span>Subir muestras</span>
            <input type="file" accept="image/*" multiple onChange={(e) => upload("proof", e.target.files)} disabled={busy} />
          </label>
        ) : null}
      </section>

      <section className="folio-panel-sec">
        <h3>Fotos editadas</h3>
        <ul className="photos-list">
          {finals.map((file) => (
            <li className="photos-list-row" key={file.id}>
              <span>{file.name}</span>
              <span className="photos-note">{fileSize(file.size)}</span>
              <span className="photos-note">{file.downloads === 0 ? "Sin descargar" : `Descargada ${file.downloads} ${file.downloads === 1 ? "vez" : "veces"}`}</span>
              <button className="photos-btn-link" type="button" onClick={() => downloadOriginal(file)}>
                Descargar
              </button>
              {canManage ? (
                <button className="photos-btn-link" type="button" onClick={() => run(() => api.deletePhotoFile(file.id))} disabled={busy}>
                  Quitar
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {canManage && paid && !folio.filesExpiredAt ? (
          <label className="photos-upload">
            <span>Subir fotos editadas</span>
            <input type="file" accept="image/*" multiple onChange={(e) => upload("final", e.target.files)} disabled={busy} />
          </label>
        ) : null}
        <p className="photos-note">
          {folio.filesExpiredAt
            ? `Las fotos se borraron el ${shortDate(folio.filesExpiredAt)}.`
            : folio.expiresAt
              ? `Se pueden descargar hasta el ${shortDate(folio.expiresAt)}.`
              : "La descarga se abre al marcar las fotos como listas."}
        </p>
      </section>

      {canManage ? (
        <footer className="folio-panel-actions">
          {folio.readyAt === null ? (
            <button className="photos-btn" type="button" onClick={() => run(() => api.advancePhotoFolio(folioId, "ready"))} disabled={busy || finals.length === 0}>
              Marcar fotos listas
            </button>
          ) : null}
          {folio.readyAt !== null && folio.printCount > 0 && folio.printedAt === null ? (
            <button className="photos-btn" type="button" onClick={() => run(() => api.advancePhotoFolio(folioId, "printed"))} disabled={busy}>
              Marcar impreso
            </button>
          ) : null}
          {folio.printedAt !== null && folio.deliveredAt === null ? (
            <button className="photos-btn" type="button" onClick={() => run(() => api.advancePhotoFolio(folioId, "delivered"))} disabled={busy}>
              Marcar entregado
            </button>
          ) : null}
          <span className="photos-note">
            Impreso: {orDash(folio.printedAt && shortDate(folio.printedAt))} · Entregado: {orDash(folio.deliveredAt && shortDate(folio.deliveredAt))}
          </span>
        </footer>
      ) : null}
    </article>
  );
}

export default FolioPanel;
