// The public links of a format (RF-SOL-01, RF-MIG-01), in place of the Microsoft Forms link.
// Each answer lands in the inbox, and in the Excel workbook the link names, if any. Every open link
// has a copy button, since the link is meant to be shared.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import { formLink } from "../../config.js";
import { shortDate } from "../shared/format.js";
import Help from "../shared/help.jsx";
import "./formLinks.css";

function FormLinks({ format }) {
  const [links, setLinks] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [sheetId, setSheetId] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [linkList, sheetList] = await Promise.all([
          api.listFormLinks(format.id),
          api.listSpreadsheets().catch(() => ({ sheets: [] })),
        ]);
        if (cancelled) return;
        setLinks(linkList.links);
        setSheets(sheetList.sheets.filter((sheet) => String(sheet.schemaId) === String(format.id)));
      } catch (failure) {
        if (!cancelled) setError(failure.message);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [format.id]);

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  function create() {
    run(async () => {
      await api.createFormLink(format.id, sheetId === "" ? null : Number(sheetId));
      setLinks((await api.listFormLinks(format.id)).links);
    });
  }

  function revoke(link) {
    run(async () => {
      await api.revokeFormLink(format.id, link.id);
      setLinks((await api.listFormLinks(format.id)).links);
    });
  }

  async function copy(link) {
    await navigator.clipboard.writeText(formLink(link.token));
    setCopiedId(link.id);
  }

  return (
    <section className="format-sec form-links">
      <h3>
        Formulario público
        <Help text="Un enlace que cualquiera puede abrir sin cuenta para llenar este formato, en lugar del de Microsoft Forms. Cada respuesta llega a la bandeja como solicitud." />
      </h3>

      {error !== null ? <p className="format-bad">{error}</p> : null}

      <div className="form-links-new">
        <label className="format-field">
          <span className="format-label">
            Escribir también en
            <Help text="Cada respuesta se agrega como fila nueva a este libro, con el folio en la columna de identidad. Solo aparecen los libros mapeados a este formato." />
          </span>
          <select value={sheetId} onChange={(event) => setSheetId(event.target.value)}>
            <option value="">Solo en el sistema</option>
            {sheets.map((sheet) => (
              <option value={sheet.id} key={sheet.id}>
                {sheet.name} (v{sheet.schemaVersion})
              </option>
            ))}
          </select>
        </label>
        <button className="format-btn is-primary" type="button" onClick={create} disabled={busy}>
          Crear enlace
        </button>
      </div>

      {links.length === 0 ? (
        <p className="format-note">Este formato no tiene enlaces abiertos.</p>
      ) : (
        <ul className="form-links-list">
          {links.map((link) => (
            <li className="form-links-item" key={link.id}>
              <span className="form-links-meta">
                Creado el {shortDate(link.createdAt)}
                {link.createdByName ? ` por ${link.createdByName}` : ""} ·{" "}
                {link.sheetName ? `escribe en ${link.sheetName}` : "solo en el sistema"} ·{" "}
                {link.responses} {link.responses === 1 ? "respuesta" : "respuestas"}
              </span>
              {link.token ? (
                <button className="format-quiet" type="button" onClick={() => copy(link)}>
                  {copiedId === link.id ? "Copiado" : "Copiar enlace"}
                </button>
              ) : null}
              <button
                className="format-quiet is-danger"
                type="button"
                onClick={() => revoke(link)}
                disabled={busy}
              >
                Cerrar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default FormLinks;
