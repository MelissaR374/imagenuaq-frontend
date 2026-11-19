// The client's page of the photo service, opened by the QR on their sheet or by its typed code.
// There is no login: the code is the access. Built for a phone first, it walks one folio through
// its steps: data and package, payment at cajas, choice among the proofs, then download.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import logo from "../../assets/imagenuaq.svg";
import { PHOTO_PARAM } from "../../config.js";
import { saveBlob } from "../shared/download.js";
import { fileSize } from "../shared/format.js";
import QrScan from "../shared/qrScan.jsx";
import { themeClass } from "../shared/theme.js";
import { PORTAL_STEPS, pesos, reached } from "../photos/photoStatus.js";
import "../shared/fieldInput.css";
import "./publicPhoto.css";

/** @param {{ initialCode: string }} props */
function PublicPhoto({ initialCode }) {
  const [code, setCode] = useState(initialCode);
  const [typed, setTyped] = useState(initialCode);
  const [scanning, setScanning] = useState(false);
  const [folio, setFolio] = useState(null);
  const [data, setData] = useState({ fullName: "", email: "", phone: "", schoolId: "", packageId: "" });
  const [chosen, setChosen] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(null);
  const [theme] = useState(themeClass);

  useEffect(() => {
    if (code === "") return;
    let cancelled = false;
    api
      .getPortalFolio(code)
      .then((result) => {
        if (!cancelled) show(result.folio);
      })
      .catch((failure) => {
        if (cancelled) return;
        setFolio(null);
        setError(failure.status === 404 ? "No encontramos ese código. Revisa que esté bien escrito." : failure.message);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  function show(next) {
    setFolio(next);
    setError(null);
    setData({
      fullName: next.fullName ?? "",
      email: next.email ?? "",
      phone: next.phone ?? "",
      schoolId: next.schoolId ?? "",
      packageId: next.packageId === null ? "" : String(next.packageId),
    });
    setChosen(next.proofs.filter((proof) => proof.selected).map((proof) => proof.id));
  }

  function openCode(value) {
    const clean = value.trim();
    if (clean === "") return;
    setError(null);
    setScanning(false);
    setCode(clean);
    const url = new URL(window.location.href);
    url.searchParams.set(PHOTO_PARAM, clean);
    window.history.replaceState(null, "", url);
  }

  function scanned(text) {
    try {
      openCode(new URL(text).searchParams.get(PHOTO_PARAM) ?? text);
    } catch {
      openCode(text);
    }
  }

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      show((await action()).folio);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  function register(event) {
    event.preventDefault();
    run(() => api.registerPortalFolio(code, { ...data, packageId: Number(data.packageId) }));
  }

  async function download(file) {
    setDownloading(file.id);
    setError(null);
    try {
      saveBlob(await api.downloadPortalPhoto(code, file.id), file.name);
    } catch (failure) {
      setError(`No se pudo descargar «${file.name}»: ${failure.message}`);
    } finally {
      setDownloading(null);
    }
  }

  function toggle(id) {
    setConfirming(false);
    if (chosen.includes(id)) setChosen(chosen.filter((other) => other !== id));
    else if (chosen.length < folio.digitalCount) setChosen([...chosen, id]);
  }

  return (
    <div className={`app-container public-photo-page ${theme}`}>
      <main className="public-photo">
        <header className="public-photo-head">
          <img className="public-photo-logo" src={logo} alt="Imagen UAQ" />
          <div className="public-photo-head-text">
            <span className="public-photo-eyebrow">Servicio de fotografía · Imagen UAQ</span>
            <h1 className="public-photo-title">{folio === null ? "Entra con tu código" : `Folio ${folio.label}`}</h1>
            {folio !== null ? <span className="public-photo-note">{folio.groupName}</span> : null}
          </div>
        </header>

        {folio === null ? (
          <section className="public-photo-sec">
            <h2>Escribe tu código</h2>
            <p className="public-photo-note">Son 8 caracteres y vienen en tu hoja, junto al código QR.</p>
            <form
              className="public-photo-code"
              onSubmit={(event) => {
                event.preventDefault();
                openCode(typed);
              }}
            >
              <input
                className="field-control public-photo-code-input"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="ABCD-1234"
                autoCapitalize="characters"
                autoComplete="off"
                inputMode="text"
                spellCheck={false}
                aria-label="Código de tu hoja"
              />
              <button className="public-photo-btn" type="submit">
                Entrar
              </button>
            </form>
            <button className="public-photo-btn-link" type="button" onClick={() => setScanning(!scanning)}>
              {scanning ? "Cerrar la cámara" : "Escanear el QR de mi hoja"}
            </button>
            {scanning ? <QrScan onScan={scanned} /> : null}
            {error !== null ? <p className="public-photo-error">{error}</p> : null}
          </section>
        ) : (
          <>
            <section className="public-photo-sec">
              <ol className="public-photo-steps">
                {PORTAL_STEPS.map((step) => (
                  <li key={step.status} className={reached(folio.status, step.status) ? "public-photo-step-done" : "public-photo-step"}>
                    {step.label}
                  </li>
                ))}
              </ol>
            </section>

            {error !== null ? <p className="public-photo-error">{error}</p> : null}

            {!folio.paid ? (
              <form className="public-photo-sec public-photo-form" onSubmit={register}>
                <h2>{folio.status === "registered" ? "Tus datos" : "Regístrate"}</h2>
                <label className="public-photo-field">
                  <span>Nombre completo</span>
                  <input className="field-control" value={data.fullName} onChange={(e) => setData({ ...data, fullName: e.target.value })} autoComplete="name" required />
                </label>
                <label className="public-photo-field">
                  <span>Correo</span>
                  <input className="field-control" type="email" value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} autoComplete="email" required />
                </label>
                <label className="public-photo-field">
                  <span>Teléfono</span>
                  <input className="field-control" type="tel" value={data.phone} onChange={(e) => setData({ ...data, phone: e.target.value })} autoComplete="tel" />
                </label>
                <label className="public-photo-field">
                  <span>Expediente (si lo tienes)</span>
                  <input className="field-control" value={data.schoolId} onChange={(e) => setData({ ...data, schoolId: e.target.value })} inputMode="numeric" />
                </label>
                <fieldset className="public-photo-packages">
                  <legend>Elige tu paquete</legend>
                  {folio.packages.map((pkg) => (
                    <label className="public-photo-package" key={pkg.id}>
                      <input
                        type="radio"
                        name="package"
                        value={pkg.id}
                        checked={data.packageId === String(pkg.id)}
                        onChange={(e) => setData({ ...data, packageId: e.target.value })}
                        required
                      />
                      <span className="public-photo-package-text">
                        <strong>{pkg.name}</strong> · {pesos(pkg.priceNow)}
                        <span className="public-photo-note">
                          {pkg.digitalCount} digitales{pkg.printCount ? ` y ${pkg.printCount} impresas` : ""}
                          {pkg.description ? ` · ${pkg.description}` : ""}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <button className="public-photo-btn" type="submit" disabled={busy}>
                  {folio.status === "registered" ? "Actualizar mis datos" : "Registrarme"}
                </button>
                {folio.status === "registered" ? (
                  <p className="public-photo-note">
                    Ya estás registrado. Paga tu paquete en cajas y envianos el recibo.
                  </p>
                ) : null}
              </form>
            ) : null}

            {folio.paid && folio.status === "paid" ? (
              <section className="public-photo-sec">
                <h2>Pago registrado</h2>
                <p className="public-photo-note">
                  {folio.packageName}. Después de la sesión aparecerán aquí tus fotos para que elijas {folio.digitalCount}.
                </p>
              </section>
            ) : null}

            {folio.status === "proofs" && !folio.selectionLocked ? (
              <section className="public-photo-sec">
                <h2>Elige tus fotos</h2>
                <p className="public-photo-note">
                  Elegidas {chosen.length} de {folio.digitalCount}. Las muestras llevan marca de agua; las que elijas te llegan editadas y sin ella.
                </p>
                <ul className="public-photo-grid">
                  {folio.proofs.map((proof) => (
                    <li key={proof.id}>
                      <button
                        type="button"
                        className={`public-photo-pick ${chosen.includes(proof.id) ? "public-photo-pick-on" : ""}`}
                        onClick={() => toggle(proof.id)}
                        aria-pressed={chosen.includes(proof.id)}
                      >
                        <img className="public-photo-pick-img" src={api.portalPreviewUrl(code, proof.id)} alt={proof.name} loading="lazy" />
                        <span className="public-photo-pick-mark">{chosen.includes(proof.id) ? "Elegida" : "Elegir"}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="public-photo-actions">
                  <button className="public-photo-btn-link" type="button" disabled={busy} onClick={() => run(() => api.selectPortalPhotos(code, chosen))}>
                    Guardar para después
                  </button>
                  {confirming ? (
                    <button className="public-photo-btn" type="button" disabled={busy} onClick={() => run(() => api.selectPortalPhotos(code, chosen, true))}>
                      Sí, enviar estas {chosen.length}
                    </button>
                  ) : (
                    <button className="public-photo-btn" type="button" disabled={busy || chosen.length === 0} onClick={() => setConfirming(true)}>
                      Enviar mi elección
                    </button>
                  )}
                </div>
                {confirming ? <p className="public-photo-note">Una vez enviada ya no se puede cambiar.</p> : null}
              </section>
            ) : null}

            {folio.status === "selected" ? (
              <section className="public-photo-sec">
                <h2>Estamos editando tus fotos</h2>
                <p className="public-photo-note">Cuando estén listas podrás descargarlas aquí mismo, con este código. Estas son las que elegiste:</p>
                <ul className="public-photo-grid">
                  {folio.proofs
                    .filter((proof) => proof.selected)
                    .map((proof) => (
                      <li key={proof.id}>
                        <img className="public-photo-pick-img public-photo-chosen" src={api.portalPreviewUrl(code, proof.id)} alt={proof.name} loading="lazy" />
                      </li>
                    ))}
                </ul>
              </section>
            ) : null}

            {folio.finals.length > 0 ? (
              <section className="public-photo-sec">
                <h2>Tus fotos</h2>
                <p className="public-photo-note">
                  {folio.daysLeft === 1 ? "Te queda 1 día" : `Te quedan ${folio.daysLeft} días`} para descargarlas. Después se borran.
                </p>
                <ul className="public-photo-downloads">
                  {folio.finals.map((file) => (
                    <li className="public-photo-final" key={file.id}>
                      <img
                        className="public-photo-final-img"
                        src={api.portalThumbnailUrl(code, file.id)}
                        alt={file.name}
                        loading="lazy"
                      />
                      <div className="public-photo-final-info">
                        <span className="public-photo-final-name">{file.name}</span>
                        <span className="public-photo-note">{fileSize(file.size)}</span>
                      </div>
                      <button
                        className="public-photo-btn public-photo-download"
                        type="button"
                        onClick={() => download(file)}
                        disabled={downloading !== null}
                      >
                        {downloading === file.id ? "Descargando…" : "Descargar"}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {folio.expired ? (
              <section className="public-photo-sec">
                <h2>El periodo de descarga terminó</h2>
                <p className="public-photo-note">Tus fotos ya no están disponibles en línea. Si las necesitas, acude a la coordinación con tu folio.</p>
              </section>
            ) : null}

            {folio.printCount ? (
              <section className="public-photo-sec">
                <h2>Fotos impresas</h2>
                <p className="public-photo-note">
                  {folio.deliveredAt
                    ? "Ya las recogiste."
                    : folio.printedAt
                      ? "Están listas: recógelas en la coordinación con tu folio."
                      : `Tu paquete incluye ${folio.printCount}. Te avisaremos aquí cuando estén listas.`}
                </p>
              </section>
            ) : null}

            <button
              className="public-photo-btn-link"
              type="button"
              onClick={() => {
                setFolio(null);
                setCode("");
                setTyped("");
              }}
            >
              Usar otro código
            </button>
          </>
        )}
      </main>
    </div>
  );
}

export default PublicPhoto;
