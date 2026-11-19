// The printable sheets of a photo group, one per folio: its number, its code and a QR with the portal
// link. Blank lines let a person without the link register by hand. Printing opens a window with
// only the sheets and their stylesheet, so no rule of the app reaches the paper.
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

import * as api from "../../api/client.js";
import logo from "../../assets/imagenuaq.svg";
import { FRONTEND_DOMAIN, photoLink } from "../../config.js";
import "./photos.css";
import "./photoSheets.css";
import sheetCss from "./photoSheets.css?raw";

/** The paper the sheets print on, two per page: its label and its CSS page size. */
const PAPERS = { a4: "A4", letter: "Carta" };
const PAGE_SIZES = { a4: "A4", letter: "letter" };

/** The paper chosen last in this browser, A4 when none. */
function readPaper() {
  try {
    return PAPERS[localStorage.getItem("photoSheetsPaper")] ? localStorage.getItem("photoSheetsPaper") : "a4";
  } catch {
    return "a4";
  }
}

/** @param {{ group: object, onBack: () => void }} props */
function PhotoSheets({ group, onBack }) {
  const [sheets, setSheets] = useState(null);
  const [error, setError] = useState(null);
  const [paper, setPaper] = useState(readPaper);
  const sheetsRef = useRef(null);

  function choosePaper(value) {
    setPaper(value);
    try {
      localStorage.setItem("photoSheetsPaper", value);
    } catch {
      return;
    }
  }

  useEffect(() => {
    let cancelled = false;
    api
      .listPhotoSheets(group.id)
      .then(async (data) => {
        const withQr = await Promise.all(
          data.folios.map(async (folio) => ({
            ...folio,
            qr: await QRCode.toDataURL(photoLink(folio.code.replace("-", "")), { margin: 1, width: 240 }),
          })),
        );
        if (!cancelled) setSheets(withQr);
      })
      .catch((failure) => {
        if (!cancelled) setError(failure.message);
      });
    return () => {
      cancelled = true;
    };
  }, [group.id]);

  /**
   * Prints the sheets from a window of their own: the rendered markup, photoSheets.css and the page
   * size of the chosen paper. The app's landscape page rule never reaches it.
   */
  function printSheets() {
    const page = window.open("", "_blank");
    if (!page) {
      setError("El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes de este sitio.");
      return;
    }
    page.document.write(
      `<!doctype html><html lang="es"><head><meta charset="utf-8"><base href="${window.location.origin}/">` +
        `<style>${sheetCss}
@page { size: ${PAGE_SIZES[paper]} portrait; margin: 8mm; }
` +
        `body { margin: 0; font-family: "Poppins", sans-serif; }</style></head>` +
        `<body>${sheetsRef.current.outerHTML}</body></html>`,
    );
    page.document.close();
    page.document.title = `Hojas · ${group.name}`;
    page.addEventListener("afterprint", () => page.close());
    const go = () => {
      page.focus();
      page.print();
    };
    if (page.document.readyState === "complete") go();
    else page.addEventListener("load", go);
  }

  if (sheets === null) return <p className="photos-note">{error ?? "Preparando las hojas…"}</p>;

  const pairs = [];
  for (let i = 0; i < sheets.length; i += 2) pairs.push(sheets.slice(i, i + 2));

  return (
    <div className="photos">
      <div className="photos-toolbar photo-sheets-toolbar">
        <button className="photos-btn-link" type="button" onClick={onBack}>
          ← {group.name}
        </button>
        <label className="photos-inline">
          <span className="photos-note">Papel</span>
          <select value={paper} onChange={(e) => choosePaper(e.target.value)}>
            {Object.entries(PAPERS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}, 2 hojas por página
              </option>
            ))}
          </select>
        </label>
        <button className="photos-btn" type="button" onClick={printSheets}>
          Imprimir {sheets.length} hojas
        </button>
      </div>

      {error !== null ? <p className="photos-error">{error}</p> : null}

      <div className={`photo-sheets photo-sheets-${paper}`} ref={sheetsRef}>
        {pairs.map((pair) => (
          <div className="photo-sheet-page" key={pair[0].id}>
            {pair.map((sheet) => (
              <section className="photo-sheet" key={sheet.id}>
                <header className="photo-sheet-head">
                  <img className="photo-sheet-logo" src={logo} alt="Imagen UAQ" />
                  <div>
                    <h2>Servicio de fotografía · Imagen UAQ</h2>
                    <p>
                      {group.name} · {new Date(group.eventStartsAt).toLocaleDateString("es-MX")}
                    </p>
                  </div>
                </header>

                <div className="photo-sheet-ids">
                  <div>
                    <p className="photo-sheet-label">Folio</p>
                    <p className="photo-sheet-folio">{sheet.label}</p>
                    <p className="photo-sheet-label">Tu código</p>
                    <p className="photo-sheet-code">{sheet.code}</p>
                  </div>
                  <img className="photo-sheet-qr" src={sheet.qr} alt={`Código QR del folio ${sheet.label}`} />
                </div>

                <p className="photo-sheet-help">
                  Escanea el código QR con la cámara de tu celular, o entra a {FRONTEND_DOMAIN}/?photo y escribe tu código. Ahí registras tus
                  datos, eliges tus fotos y las descargas. Guarda esta hoja: el código es tu acceso.
                </p>

                <div className="photo-sheet-manual">
                  <p className="photo-sheet-label">Si no puedes registrarte en línea, llena estos datos y entrega una copia de la hoja:</p>
                  <p className="photo-sheet-line">Nombre completo:</p>
                  <p className="photo-sheet-line">Correo:</p>
                  <p className="photo-sheet-line">Teléfono:</p>
                  <p className="photo-sheet-line">Expediente:</p>
                  <p className="photo-sheet-line">Paquete: {group.packages.map((pkg) => `☐ ${pkg.name}`).join("   ")}</p>
                </div>
              </section>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default PhotoSheets;
