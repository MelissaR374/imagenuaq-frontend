// Read-only finance summary for a project: quotes, invoices, oficios, payments, receipts.
import { useEffect, useState } from "react";
import {
  MdOutlineDescription,
  MdReceiptLong,
  MdPayment,
  MdInfoOutline,
  MdWarningAmber,
  MdDownload,
} from "react-icons/md";

import * as api from "../../../api/client.js";
import { orDash } from "../../shared/format.js";
import { saveBlob } from "../../shared/download.js";

import "./projectBilling.css";

const MXN = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 2,
});

const STATUS_LABELS = {
  issued: "Emitida",
  in_review: "En revisión",
  approved: "Aprobada",
  rejected: "Rechazada",
  uploaded: "Subida",
  sent: "Enviada",
  in_payment: "En pago",
  paid: "Pagada",
  signed: "Firmado",
  answered: "Contestado",
  draft: "Borrador",
  pending_validation: "Pendiente",
  validated: "Validado",
  cancelled: "Cancelado",
  incoming: "Ingreso",
  outgoing: "Egreso",
};

function label(status) {
  return STATUS_LABELS[status] ?? status ?? "—";
}

function date(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString();
}

function DownloadButton({ fileId }) {
  if (!fileId) return null;

  async function handleClick() {
    const blob = await api.downloadFile(fileId);
    saveBlob(blob, `archivo-${fileId}`);
  }

  return (
    <button type="button" className="project-billing-download" onClick={handleClick} title="Descargar">
      <MdDownload />
    </button>
  );
}

function ProjectBilling({ projectId }) {
  const [data, setData] = useState(undefined);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    api.getFinanceSummary(projectId)
      .then((res) => {
        if (!cancelled) {
          setData(res.finance);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => { cancelled = true; };
  }, [projectId]);

  if (data === undefined && error === null) {
    return (
      <section className="project-billing">
        <p className="project-billing-loading">Cargando datos financieros…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="project-billing">
        <p className="project-billing-error">{error}</p>
      </section>
    );
  }

  if (!data) return null;

  const { quotes = [], invoices = [], oficios = [], payments = [], receipts = [] } = data;
  const empty = quotes.length + invoices.length + oficios.length + payments.length + receipts.length === 0;

  return (
    <section className="project-billing">
      <header className="project-billing-header">
        <MdOutlineDescription />
        <h3>Finanzas del proyecto</h3>
      </header>

      {(data.flags ?? []).length > 0 && (
        <div className="project-billing-flags">
          {data.flags.map((flag) => (
            <span key={flag} className="project-billing-flag">
              <MdWarningAmber /> {flag.replaceAll("_", " ")}
            </span>
          ))}
        </div>
      )}

      <div className="project-billing-summary">
        <span>Facturado: <strong>{MXN.format(data.invoiced ?? 0)}</strong></span>
        <span>Facturas: {data.uploadedInvoices ?? 0}{data.expectedInvoices != null ? ` / ${data.expectedInvoices}` : ""}</span>
        <span>Cotizaciones: {data.quotes ?? 0}</span>
        <span>Oficios: {data.oficios ?? 0}</span>
        <span>Pagos: {data.payments ?? 0}</span>
        <span>Recibos: {data.receipts ?? 0}</span>
      </div>

      {empty && (
        <div className="project-billing-notice">
          <MdInfoOutline />
          <div>
            <strong>Sin registros financieros</strong>
            <p>Todavía no se han registrado cotizaciones, facturas ni pagos.</p>
          </div>
        </div>
      )}

      {quotes.length > 0 && (
        <div className="project-billing-block">
          <h4><MdOutlineDescription /> Cotizaciones</h4>
          <table className="project-billing-table">
            <thead>
              <tr>
                <th>Proveedor / Entidad</th>
                <th>Monto</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id}>
                  <td>{orDash(q.providerName ?? q.entity)}</td>
                  <td>{MXN.format(q.amount)}</td>
                  <td><span className={`project-billing-status ${q.status}`}>{label(q.status)}</span></td>
                  <td>{date(q.createdAt) ?? "—"}</td>
                  <td><DownloadButton fileId={q.fileId} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {invoices.length > 0 && (
        <div className="project-billing-block">
          <h4><MdReceiptLong /> Facturas</h4>
          <table className="project-billing-table">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Proveedor</th>
                <th>Monto</th>
                <th>Estado</th>
                <th>Oficio</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{orDash(inv.invoiceFolio)}</td>
                  <td>{orDash(inv.providerName)}</td>
                  <td>{MXN.format(inv.amount)}</td>
                  <td><span className={`project-billing-status ${inv.status}`}>{label(inv.status)}</span></td>
                  <td>{orDash(inv.oficioFolio)}</td>
                  <td><DownloadButton fileId={inv.fileId} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {oficios.length > 0 && (
        <div className="project-billing-block">
          <h4><MdOutlineDescription /> Oficios</h4>
          <table className="project-billing-table">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Destinatario</th>
                <th>Monto</th>
                <th>Estado</th>
                <th>Días sin respuesta</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {oficios.map((o) => (
                <tr key={o.id}>
                  <td>{orDash(o.folio)}</td>
                  <td>{orDash(o.recipient)}</td>
                  <td>{MXN.format(o.amount)}</td>
                  <td><span className={`project-billing-status ${o.status}`}>{label(o.status)}</span></td>
                  <td>{o.daysUnanswered ?? "—"}</td>
                  <td><DownloadButton fileId={o.stampedFileId} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {payments.length > 0 && (
        <div className="project-billing-block">
          <h4><MdPayment /> Pagos</h4>
          <table className="project-billing-table">
            <thead>
              <tr>
                <th>Dirección</th>
                <th>Monto</th>
                <th>Fecha de pago</th>
                <th>Folio</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {payments.map((pay) => (
                <tr key={pay.id}>
                  <td>{label(pay.direction)}</td>
                  <td>{MXN.format(pay.amount)}</td>
                  <td>{date(pay.paidOn) ?? "—"}</td>
                  <td>{orDash(pay.trackingFolio)}</td>
                  <td><DownloadButton fileId={pay.proofFileId} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {receipts.length > 0 && (
        <div className="project-billing-block">
          <h4><MdReceiptLong /> Recibos referenciados</h4>
          <table className="project-billing-table">
            <thead>
              <tr>
                <th>Solicitante</th>
                <th>Monto</th>
                <th>Referencia</th>
                <th>Estado</th>
                <th>Concepto</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr key={r.id}>
                  <td>{orDash(r.requester)}</td>
                  <td>{MXN.format(r.amount)}</td>
                  <td>{orDash(r.reference)}</td>
                  <td><span className={`project-billing-status ${r.status}`}>{label(r.status)}</span></td>
                  <td>{orDash(r.concept)}</td>
                  <td><DownloadButton fileId={r.fileId} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default ProjectBilling;
