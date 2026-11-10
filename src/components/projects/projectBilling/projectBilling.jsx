// Finance tab inside a project: quotes, invoices, oficios, payments, receipts with inline CRUD.
// RF-FIN-01 to RF-FIN-18. Interview 008: expected-vs-uploaded invoices setter in the summary bar.
import { useEffect, useState } from "react";
import {
  MdOutlineDescription,
  MdReceiptLong,
  MdPayment,
  MdInfoOutline,
  MdWarningAmber,
  MdDownload,
  MdAdd,
  MdEdit,
  MdDelete,
  MdCheck,
  MdClose,
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

function fmtDate(value) {
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

/** Inline form row for any entity; children are the form fields. */
function InlineForm({ colSpan, saving, onSave, onCancel, children }) {
  return (
    <tr className="project-billing-form-row">
      <td colSpan={colSpan}>
        <div className="project-billing-inline-form">
          {children}
          <div className="project-billing-form-actions">
            <button type="button" className="project-billing-save-btn" disabled={saving} onClick={onSave}>
              <MdCheck /> Guardar
            </button>
            <button type="button" className="project-billing-cancel-btn" disabled={saving} onClick={onCancel}>
              <MdClose /> Cancelar
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}

/**
 * @param {{ projectId: number, permissions?: string[] }} props
 */
function ProjectBilling({ projectId, permissions = [] }) {
  const [data, setData] = useState(undefined);
  const [providers, setProviders] = useState([]);
  const [folderId, setFolderId] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);

  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editingExpected, setEditingExpected] = useState(false);
  const [expectedDraft, setExpectedDraft] = useState("");

  const canWrite = permissions.includes("finance.write") || permissions.includes("project.write");
  const canDecide = permissions.includes("finance.write");
  const canValidate = permissions.includes("finance.validate");
  const canSetExpected = permissions.includes("finance.request");

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      api.getFinanceSummary(projectId),
      api.listProviders(),
      api.getProjectFolder(projectId).catch(() => ({ folder: null })),
    ]).then(([summary, provData, folderData]) => {
      if (cancelled) return;
      setData(summary.finance);
      setProviders(provData.providers ?? []);
      setFolderId(folderData.folder?.id ?? null);
      setError(null);
    }).catch((err) => {
      if (!cancelled) setError(err.message);
    });

    return () => { cancelled = true; };
  }, [projectId, version]);

  function reload() {
    setVersion((v) => v + 1);
    setEditing(null);
    setCreating(null);
    setConfirmDelete(null);
  }

  function flash(msg) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  }

  async function uploadIfNeeded(file) {
    if (!file || !folderId) return null;
    const result = await api.smartUpload(folderId, file);
    return result.file.id;
  }

  async function handleCreateQuote(draft) {
    setSaving(true);
    try {
      const fileId = await uploadIfNeeded(draft._file);
      await api.createQuote(projectId, {
        providerId: draft.providerId || undefined,
        entity: draft.entity || undefined,
        amount: Number(draft.amount),
        description: draft.description || undefined,
        fileId: fileId || undefined,
      });
      flash("Cotización registrada");
      reload();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function handleUpdateQuote(id, draft) {
    setSaving(true);
    try {
      await api.updateQuote(id, {
        providerId: draft.providerId || undefined,
        entity: draft.entity || undefined,
        amount: Number(draft.amount),
        description: draft.description || undefined,
      });
      flash("Cotización actualizada");
      reload();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function handleDecideQuote(id, decision) {
    setSaving(true);
    try {
      await api.decideQuote(id, { decision });
      flash(decision === "approved" ? "Cotización aprobada" : "Cotización rechazada");
      reload();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function handleCreateInvoice(draft) {
    setSaving(true);
    try {
      const fileId = await uploadIfNeeded(draft._file);
      await api.createInvoice(projectId, {
        quoteId: draft.quoteId || undefined,
        providerId: draft.providerId || undefined,
        amount: Number(draft.amount),
        material: draft.material || undefined,
        invoiceFolio: draft.invoiceFolio || undefined,
        fiscalFolio: draft.fiscalFolio || undefined,
        destination: draft.destination || undefined,
        fileId: fileId || undefined,
      });
      flash("Factura registrada");
      reload();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function handleUpdateInvoice(id, draft) {
    setSaving(true);
    try {
      await api.updateInvoice(id, {
        providerId: draft.providerId || undefined,
        amount: Number(draft.amount),
        material: draft.material || undefined,
        invoiceFolio: draft.invoiceFolio || undefined,
        fiscalFolio: draft.fiscalFolio || undefined,
        destination: draft.destination || undefined,
      });
      flash("Factura actualizada");
      reload();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function handleSetInvoiceStatus(id, status, paymentFolio) {
    setSaving(true);
    try {
      await api.setInvoiceStatus(id, { status, paymentFolio: paymentFolio || undefined });
      flash(`Factura marcada como ${label(status).toLowerCase()}`);
      reload();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function handleCreateOficio(draft) {
    setSaving(true);
    try {
      const fileId = await uploadIfNeeded(draft._file);
      await api.createOficio(projectId, {
        folio: draft.folio,
        recipient: draft.recipient || undefined,
        amount: Number(draft.amount),
        note: draft.note || undefined,
        invoiceIds: draft.invoiceIds?.length ? draft.invoiceIds : undefined,
        stampedFileId: fileId || undefined,
      });
      flash("Oficio registrado");
      reload();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function handleUpdateOficio(id, draft) {
    setSaving(true);
    try {
      await api.updateOficio(id, {
        folio: draft.folio || undefined,
        recipient: draft.recipient || undefined,
        amount: Number(draft.amount),
        note: draft.note || undefined,
      });
      flash("Oficio actualizado");
      reload();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function handleAdvanceOficio(id, status) {
    setSaving(true);
    try {
      await api.advanceOficio(id, { status });
      flash(`Oficio avanzado a ${label(status).toLowerCase()}`);
      reload();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function handleCreatePayment(draft) {
    setSaving(true);
    try {
      const fileId = await uploadIfNeeded(draft._file);
      await api.createPayment(projectId, {
        direction: draft.direction,
        amount: Number(draft.amount),
        oficioId: draft.oficioId || undefined,
        invoiceId: draft.invoiceId || undefined,
        providerId: draft.providerId || undefined,
        paidOn: draft.paidOn || undefined,
        trackingFolio: draft.trackingFolio || undefined,
        proofFileId: fileId || undefined,
        note: draft.note || undefined,
      });
      flash("Pago registrado");
      reload();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function handleUpdatePayment(id, draft) {
    setSaving(true);
    try {
      await api.updatePayment(id, {
        amount: Number(draft.amount),
        paidOn: draft.paidOn || undefined,
        trackingFolio: draft.trackingFolio || undefined,
        note: draft.note || undefined,
      });
      flash("Pago actualizado");
      reload();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function handleCreateReceipt(draft) {
    setSaving(true);
    try {
      const fileId = await uploadIfNeeded(draft._file);
      await api.createReceipt(projectId, {
        quoteId: draft.quoteId || undefined,
        requester: draft.requester || undefined,
        amount: Number(draft.amount),
        reference: draft.reference || undefined,
        concept: draft.concept || undefined,
        fileId: fileId || undefined,
      });
      flash("Recibo registrado");
      reload();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function handleUpdateReceipt(id, draft) {
    setSaving(true);
    try {
      await api.updateReceipt(id, {
        requester: draft.requester || undefined,
        amount: Number(draft.amount),
        reference: draft.reference || undefined,
        concept: draft.concept || undefined,
      });
      flash("Recibo actualizado");
      reload();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function handleSubmitReceipt(id) {
    setSaving(true);
    try {
      await api.submitReceipt(id);
      flash("Recibo enviado a validación");
      reload();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function handleValidateReceipt(id, decision) {
    setSaving(true);
    try {
      await api.validateReceipt(id, { decision });
      flash(decision === "approved" ? "Recibo validado" : "Recibo rechazado");
      reload();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(kind, id) {
    setSaving(true);
    try {
      const fn = { quote: api.deleteQuote, invoice: api.deleteInvoice, oficio: api.deleteOficio, payment: api.deletePayment, receipt: api.deleteReceipt }[kind];
      await fn(id);
      flash("Eliminado");
      reload();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function handleSetExpected() {
    const count = parseInt(expectedDraft, 10);
    if (isNaN(count) || count < 0) return;
    setSaving(true);
    try {
      await api.requestFinance(projectId, { kind: "invoice", count });
      flash("Facturas esperadas actualizadas");
      setEditingExpected(false);
      reload();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

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
        <button type="button" className="project-billing-retry" onClick={() => { setError(null); reload(); }}>
          Reintentar
        </button>
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

      {notice ? <p className="project-billing-notice-msg">{notice}</p> : null}

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
        <span>
          Facturas: {data.uploadedInvoices ?? 0}
          {data.expectedInvoices != null ? ` / ${data.expectedInvoices}` : ""}
          {canSetExpected && !editingExpected ? (
            <button
              type="button"
              className="project-billing-edit-expected"
              onClick={() => { setExpectedDraft(String(data.expectedInvoices ?? "")); setEditingExpected(true); }}
              title="Cambiar facturas esperadas"
            >
              <MdEdit />
            </button>
          ) : null}
          {editingExpected ? (
            <span className="project-billing-expected-form">
              <input
                type="number"
                min="0"
                value={expectedDraft}
                onChange={(e) => setExpectedDraft(e.target.value)}
                className="project-billing-expected-input"
              />
              <button type="button" className="project-billing-save-btn" disabled={saving} onClick={handleSetExpected}><MdCheck /></button>
              <button type="button" className="project-billing-cancel-btn" disabled={saving} onClick={() => setEditingExpected(false)}><MdClose /></button>
            </span>
          ) : null}
        </span>
        <span>Cotizaciones: {data.quotes ?? 0}</span>
        <span>Oficios: {data.oficios ?? 0}</span>
        <span>Pagos: {data.payments ?? 0}</span>
        <span>Recibos: {data.receipts ?? 0}</span>
      </div>

      {empty && !creating && (
        <div className="project-billing-notice">
          <MdInfoOutline />
          <div>
            <strong>Sin registros financieros</strong>
            <p>Todavía no se han registrado cotizaciones, facturas ni pagos.</p>
          </div>
        </div>
      )}

      {confirmDelete ? (
        <div className="project-billing-confirm-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="project-billing-confirm-panel" onClick={(e) => e.stopPropagation()}>
            <p>¿Eliminar este registro?</p>
            <div className="project-billing-form-actions">
              <button type="button" className="project-billing-danger-btn" disabled={saving} onClick={() => handleDelete(confirmDelete.kind, confirmDelete.id)}>
                Eliminar
              </button>
              <button type="button" className="project-billing-cancel-btn" disabled={saving} onClick={() => setConfirmDelete(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <QuotesBlock
        quotes={quotes}
        providers={providers}
        canWrite={canWrite}
        canDecide={canDecide}
        creating={creating}
        editing={editing}
        setEditing={setEditing}
        saving={saving}
        onStartCreate={() => { setCreating("quote"); setEditing(null); }}
        onStartEdit={(q) => { setEditing({ kind: "quote", id: q.id, draft: { providerId: q.providerId ?? "", entity: q.entity ?? "", amount: q.amount, description: q.description ?? "" } }); setCreating(null); }}
        onCreate={handleCreateQuote}
        onUpdate={handleUpdateQuote}
        onDecide={handleDecideQuote}
        onDelete={(id) => setConfirmDelete({ kind: "quote", id })}
        onCancel={() => { setCreating(null); setEditing(null); }}
      />

      <InvoicesBlock
        invoices={invoices}
        quotes={quotes}
        providers={providers}
        canWrite={canWrite}
        canDecide={canDecide}
        creating={creating}
        editing={editing}
        setEditing={setEditing}
        saving={saving}
        onStartCreate={() => { setCreating("invoice"); setEditing(null); }}
        onStartEdit={(inv) => { setEditing({ kind: "invoice", id: inv.id, draft: { providerId: inv.providerId ?? "", quoteId: inv.quoteId ?? "", amount: inv.amount, material: inv.material ?? "", invoiceFolio: inv.invoiceFolio ?? "", fiscalFolio: inv.fiscalFolio ?? "", destination: inv.destination ?? "" } }); setCreating(null); }}
        onCreate={handleCreateInvoice}
        onUpdate={handleUpdateInvoice}
        onSetStatus={handleSetInvoiceStatus}
        onDelete={(id) => setConfirmDelete({ kind: "invoice", id })}
        onCancel={() => { setCreating(null); setEditing(null); }}
      />

      <OficiosBlock
        oficios={oficios}
        invoices={invoices}
        canWrite={canDecide}
        creating={creating}
        editing={editing}
        setEditing={setEditing}
        saving={saving}
        onStartCreate={() => { setCreating("oficio"); setEditing(null); }}
        onStartEdit={(o) => { setEditing({ kind: "oficio", id: o.id, draft: { folio: o.folio ?? "", recipient: o.recipient ?? "", amount: o.amount, note: o.note ?? "" } }); setCreating(null); }}
        onCreate={handleCreateOficio}
        onUpdate={handleUpdateOficio}
        onAdvance={handleAdvanceOficio}
        onDelete={(id) => setConfirmDelete({ kind: "oficio", id })}
        onCancel={() => { setCreating(null); setEditing(null); }}
      />

      <PaymentsBlock
        payments={payments}
        oficios={oficios}
        invoices={invoices}
        providers={providers}
        canWrite={canDecide}
        creating={creating}
        editing={editing}
        setEditing={setEditing}
        saving={saving}
        onStartCreate={() => { setCreating("payment"); setEditing(null); }}
        onStartEdit={(p) => { setEditing({ kind: "payment", id: p.id, draft: { amount: p.amount, paidOn: p.paidOn ?? "", trackingFolio: p.trackingFolio ?? "", note: p.note ?? "" } }); setCreating(null); }}
        onCreate={handleCreatePayment}
        onUpdate={handleUpdatePayment}
        onDelete={(id) => setConfirmDelete({ kind: "payment", id })}
        onCancel={() => { setCreating(null); setEditing(null); }}
      />

      <ReceiptsBlock
        receipts={receipts}
        quotes={quotes}
        canWrite={canWrite}
        canValidate={canValidate}
        creating={creating}
        editing={editing}
        setEditing={setEditing}
        saving={saving}
        onStartCreate={() => { setCreating("receipt"); setEditing(null); }}
        onStartEdit={(r) => { setEditing({ kind: "receipt", id: r.id, draft: { requester: r.requester ?? "", amount: r.amount, reference: r.reference ?? "", concept: r.concept ?? "" } }); setCreating(null); }}
        onCreate={handleCreateReceipt}
        onUpdate={handleUpdateReceipt}
        onSubmit={handleSubmitReceipt}
        onValidate={handleValidateReceipt}
        onDelete={(id) => setConfirmDelete({ kind: "receipt", id })}
        onCancel={() => { setCreating(null); setEditing(null); }}
      />
    </section>
  );
}

function QuotesBlock({ quotes, providers, canWrite, canDecide, creating, editing, setEditing, saving, onStartCreate, onStartEdit, onCreate, onUpdate, onDecide, onDelete, onCancel }) {
  const [draft, setDraft] = useState({ providerId: "", entity: "", amount: "", description: "", _file: null });

  function resetDraft() {
    setDraft({ providerId: "", entity: "", amount: "", description: "", _file: null });
  }

  return (
    <div className="project-billing-block">
      <h4>
        <MdOutlineDescription /> Cotizaciones
        {canWrite ? (
          <button type="button" className="project-billing-add-btn" onClick={() => { resetDraft(); onStartCreate(); }}>
            <MdAdd /> Agregar
          </button>
        ) : null}
      </h4>
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
          {creating === "quote" ? (
            <InlineForm colSpan={5} saving={saving} onSave={() => onCreate(draft)} onCancel={onCancel}>
              <select value={draft.providerId} onChange={(e) => setDraft({ ...draft, providerId: e.target.value })}>
                <option value="">Proveedor (opcional)</option>
                {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input placeholder="Entidad" value={draft.entity} onChange={(e) => setDraft({ ...draft, entity: e.target.value })} />
              <input placeholder="Monto *" type="number" required value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
              <input placeholder="Descripción" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              <input type="file" onChange={(e) => setDraft({ ...draft, _file: e.target.files[0] ?? null })} />
            </InlineForm>
          ) : null}
          {quotes.map((q) => {
            if (editing?.kind === "quote" && editing.id === q.id) {
              const ed = editing.draft;
              return (
                <InlineForm key={q.id} colSpan={5} saving={saving} onSave={() => onUpdate(q.id, ed)} onCancel={onCancel}>
                  <select value={ed.providerId} onChange={(e) => setEditing({ ...editing, draft: { ...ed, providerId: e.target.value } })}>
                    <option value="">Proveedor</option>
                    {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input placeholder="Entidad" value={ed.entity} onChange={(e) => setEditing({ ...editing, draft: { ...ed, entity: e.target.value } })} />
                  <input placeholder="Monto *" type="number" value={ed.amount} onChange={(e) => setEditing({ ...editing, draft: { ...ed, amount: e.target.value } })} />
                  <input placeholder="Descripción" value={ed.description} onChange={(e) => setEditing({ ...editing, draft: { ...ed, description: e.target.value } })} />
                </InlineForm>
              );
            }
            return (
              <tr key={q.id}>
                <td>{orDash(q.providerName ?? q.entity)}</td>
                <td>{MXN.format(q.amount)}</td>
                <td><span className={`project-billing-status ${q.status}`}>{label(q.status)}</span></td>
                <td>{fmtDate(q.createdAt) ?? "—"}</td>
                <td className="project-billing-actions">
                  <DownloadButton fileId={q.fileId} />
                  {canWrite && (q.status === "issued" || q.status === "in_review") ? (
                    <>
                      <button type="button" className="project-billing-icon-btn" onClick={() => onStartEdit(q)} title="Editar"><MdEdit /></button>
                      <button type="button" className="project-billing-icon-btn danger" onClick={() => onDelete(q.id)} title="Eliminar"><MdDelete /></button>
                    </>
                  ) : null}
                  {canDecide && (q.status === "issued" || q.status === "in_review") ? (
                    <>
                      <button type="button" className="project-billing-sm-btn success" onClick={() => onDecide(q.id, "approved")}>Aprobar</button>
                      <button type="button" className="project-billing-sm-btn danger" onClick={() => onDecide(q.id, "rejected")}>Rechazar</button>
                    </>
                  ) : null}
                </td>
              </tr>
            );
          })}
          {quotes.length === 0 && creating !== "quote" ? (
            <tr><td colSpan={5} className="project-billing-empty">Sin cotizaciones</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function InvoicesBlock({ invoices, quotes, providers, canWrite, canDecide, creating, editing, setEditing, saving, onStartCreate, onStartEdit, onCreate, onUpdate, onSetStatus, onDelete, onCancel }) {
  const [draft, setDraft] = useState({ quoteId: "", providerId: "", amount: "", material: "", invoiceFolio: "", fiscalFolio: "", destination: "", _file: null });
  const [statusForm, setStatusForm] = useState(null);

  function resetDraft() {
    setDraft({ quoteId: "", providerId: "", amount: "", material: "", invoiceFolio: "", fiscalFolio: "", destination: "", _file: null });
  }

  return (
    <div className="project-billing-block">
      <h4>
        <MdReceiptLong /> Facturas
        {canWrite ? (
          <button type="button" className="project-billing-add-btn" onClick={() => { resetDraft(); onStartCreate(); }}>
            <MdAdd /> Agregar
          </button>
        ) : null}
      </h4>
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
          {creating === "invoice" ? (
            <InlineForm colSpan={6} saving={saving} onSave={() => onCreate(draft)} onCancel={onCancel}>
              <select value={draft.quoteId} onChange={(e) => setDraft({ ...draft, quoteId: e.target.value })}>
                <option value="">Cotización (opcional)</option>
                {quotes.filter((q) => q.status === "approved").map((q) => <option key={q.id} value={q.id}>{orDash(q.providerName)} — {MXN.format(q.amount)}</option>)}
              </select>
              <select value={draft.providerId} onChange={(e) => setDraft({ ...draft, providerId: e.target.value })}>
                <option value="">Proveedor (opcional)</option>
                {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input placeholder="Monto *" type="number" required value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
              <input placeholder="Folio factura" value={draft.invoiceFolio} onChange={(e) => setDraft({ ...draft, invoiceFolio: e.target.value })} />
              <input placeholder="Folio fiscal" value={draft.fiscalFolio} onChange={(e) => setDraft({ ...draft, fiscalFolio: e.target.value })} />
              <input placeholder="Material" value={draft.material} onChange={(e) => setDraft({ ...draft, material: e.target.value })} />
              <input placeholder="Destino" value={draft.destination} onChange={(e) => setDraft({ ...draft, destination: e.target.value })} />
              <input type="file" onChange={(e) => setDraft({ ...draft, _file: e.target.files[0] ?? null })} />
            </InlineForm>
          ) : null}
          {invoices.map((inv) => {
            if (editing?.kind === "invoice" && editing.id === inv.id) {
              const ed = editing.draft;
              return (
                <InlineForm key={inv.id} colSpan={6} saving={saving} onSave={() => onUpdate(inv.id, ed)} onCancel={onCancel}>
                  <select value={ed.providerId} onChange={(e) => setEditing({ ...editing, draft: { ...ed, providerId: e.target.value } })}>
                    <option value="">Proveedor</option>
                    {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input placeholder="Monto *" type="number" value={ed.amount} onChange={(e) => setEditing({ ...editing, draft: { ...ed, amount: e.target.value } })} />
                  <input placeholder="Folio factura" value={ed.invoiceFolio} onChange={(e) => setEditing({ ...editing, draft: { ...ed, invoiceFolio: e.target.value } })} />
                  <input placeholder="Folio fiscal" value={ed.fiscalFolio} onChange={(e) => setEditing({ ...editing, draft: { ...ed, fiscalFolio: e.target.value } })} />
                  <input placeholder="Material" value={ed.material} onChange={(e) => setEditing({ ...editing, draft: { ...ed, material: e.target.value } })} />
                  <input placeholder="Destino" value={ed.destination} onChange={(e) => setEditing({ ...editing, draft: { ...ed, destination: e.target.value } })} />
                </InlineForm>
              );
            }

            const canEdit = canWrite && inv.status === "uploaded";

            return (
              <tr key={inv.id}>
                <td>{orDash(inv.invoiceFolio)}</td>
                <td>{orDash(inv.providerName)}</td>
                <td>{MXN.format(inv.amount)}</td>
                <td>
                  <span className={`project-billing-status ${inv.status}`}>{label(inv.status)}</span>
                  {statusForm?.id === inv.id ? (
                    <span className="project-billing-status-form">
                      <input placeholder="Folio de pago" value={statusForm.folio} onChange={(e) => setStatusForm({ ...statusForm, folio: e.target.value })} />
                      <button type="button" className="project-billing-sm-btn" disabled={saving} onClick={() => { onSetStatus(inv.id, statusForm.target, statusForm.folio); setStatusForm(null); }}>
                        Confirmar
                      </button>
                      <button type="button" className="project-billing-sm-btn" onClick={() => setStatusForm(null)}>×</button>
                    </span>
                  ) : null}
                </td>
                <td>{orDash(inv.oficioFolio)}</td>
                <td className="project-billing-actions">
                  <DownloadButton fileId={inv.fileId} />
                  {canEdit ? (
                    <>
                      <button type="button" className="project-billing-icon-btn" onClick={() => onStartEdit(inv)} title="Editar"><MdEdit /></button>
                      <button type="button" className="project-billing-icon-btn danger" onClick={() => onDelete(inv.id)} title="Eliminar"><MdDelete /></button>
                    </>
                  ) : null}
                  {canDecide && (inv.status === "uploaded" || inv.status === "sent") ? (
                    <button type="button" className="project-billing-sm-btn" onClick={() => setStatusForm({ id: inv.id, target: "in_payment", folio: "" })}>
                      Marcar en pago
                    </button>
                  ) : null}
                  {canDecide && inv.status === "in_payment" ? (
                    <button type="button" className="project-billing-sm-btn success" onClick={() => onSetStatus(inv.id, "paid")}>
                      Marcar pagada
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
          {invoices.length === 0 && creating !== "invoice" ? (
            <tr><td colSpan={6} className="project-billing-empty">Sin facturas</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function OficiosBlock({ oficios, invoices, canWrite, creating, editing, setEditing, saving, onStartCreate, onStartEdit, onCreate, onUpdate, onAdvance, onDelete, onCancel }) {
  const [draft, setDraft] = useState({ folio: "", recipient: "", amount: "", note: "", invoiceIds: [], _file: null });

  function resetDraft() {
    setDraft({ folio: "", recipient: "", amount: "", note: "", invoiceIds: [], _file: null });
  }

  const NEXT_STEP = { issued: "sent", sent: "signed", signed: "answered", answered: "paid" };

  return (
    <div className="project-billing-block">
      <h4>
        <MdOutlineDescription /> Oficios
        {canWrite ? (
          <button type="button" className="project-billing-add-btn" onClick={() => { resetDraft(); onStartCreate(); }}>
            <MdAdd /> Agregar
          </button>
        ) : null}
      </h4>
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
          {creating === "oficio" ? (
            <InlineForm colSpan={6} saving={saving} onSave={() => onCreate(draft)} onCancel={onCancel}>
              <input placeholder="Folio *" required value={draft.folio} onChange={(e) => setDraft({ ...draft, folio: e.target.value })} />
              <input placeholder="Destinatario" value={draft.recipient} onChange={(e) => setDraft({ ...draft, recipient: e.target.value })} />
              <input placeholder="Monto *" type="number" required value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
              <input placeholder="Nota" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
              {invoices.length > 0 ? (
                <fieldset className="project-billing-fieldset">
                  <legend>Facturas</legend>
                  {invoices.map((inv) => (
                    <label key={inv.id} className="project-billing-checkbox">
                      <input
                        type="checkbox"
                        checked={draft.invoiceIds.includes(inv.id)}
                        onChange={(e) => {
                          const ids = e.target.checked
                            ? [...draft.invoiceIds, inv.id]
                            : draft.invoiceIds.filter((x) => x !== inv.id);
                          setDraft({ ...draft, invoiceIds: ids });
                        }}
                      />
                      {orDash(inv.invoiceFolio)} — {MXN.format(inv.amount)}
                    </label>
                  ))}
                </fieldset>
              ) : null}
              <input type="file" onChange={(e) => setDraft({ ...draft, _file: e.target.files[0] ?? null })} />
            </InlineForm>
          ) : null}
          {oficios.map((o) => {
            if (editing?.kind === "oficio" && editing.id === o.id) {
              const ed = editing.draft;
              return (
                <InlineForm key={o.id} colSpan={6} saving={saving} onSave={() => onUpdate(o.id, ed)} onCancel={onCancel}>
                  <input placeholder="Folio" value={ed.folio} onChange={(e) => setEditing({ ...editing, draft: { ...ed, folio: e.target.value } })} />
                  <input placeholder="Destinatario" value={ed.recipient} onChange={(e) => setEditing({ ...editing, draft: { ...ed, recipient: e.target.value } })} />
                  <input placeholder="Monto *" type="number" value={ed.amount} onChange={(e) => setEditing({ ...editing, draft: { ...ed, amount: e.target.value } })} />
                  <input placeholder="Nota" value={ed.note} onChange={(e) => setEditing({ ...editing, draft: { ...ed, note: e.target.value } })} />
                </InlineForm>
              );
            }
            const next = NEXT_STEP[o.status];
            return (
              <tr key={o.id} className={o.daysUnanswered > 30 ? "project-billing-warn-row" : ""}>
                <td>{orDash(o.folio)}</td>
                <td>{orDash(o.recipient)}</td>
                <td>{MXN.format(o.amount)}</td>
                <td><span className={`project-billing-status ${o.status}`}>{label(o.status)}</span></td>
                <td>{o.daysUnanswered ?? "—"}</td>
                <td className="project-billing-actions">
                  <DownloadButton fileId={o.stampedFileId} />
                  {canWrite ? (
                    <button type="button" className="project-billing-icon-btn" onClick={() => onStartEdit(o)} title="Editar"><MdEdit /></button>
                  ) : null}
                  {canWrite && o.status === "issued" ? (
                    <button type="button" className="project-billing-icon-btn danger" onClick={() => onDelete(o.id)} title="Eliminar"><MdDelete /></button>
                  ) : null}
                  {canWrite && next ? (
                    <button type="button" className="project-billing-sm-btn" onClick={() => onAdvance(o.id, next)}>
                      → {label(next)}
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
          {oficios.length === 0 && creating !== "oficio" ? (
            <tr><td colSpan={6} className="project-billing-empty">Sin oficios</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function PaymentsBlock({ payments, oficios, invoices, providers, canWrite, creating, editing, setEditing, saving, onStartCreate, onStartEdit, onCreate, onUpdate, onDelete, onCancel }) {
  const [draft, setDraft] = useState({ direction: "incoming", amount: "", oficioId: "", invoiceId: "", providerId: "", paidOn: "", trackingFolio: "", note: "", _file: null });

  function resetDraft() {
    setDraft({ direction: "incoming", amount: "", oficioId: "", invoiceId: "", providerId: "", paidOn: "", trackingFolio: "", note: "", _file: null });
  }

  return (
    <div className="project-billing-block">
      <h4>
        <MdPayment /> Pagos
        {canWrite ? (
          <button type="button" className="project-billing-add-btn" onClick={() => { resetDraft(); onStartCreate(); }}>
            <MdAdd /> Agregar
          </button>
        ) : null}
      </h4>
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
          {creating === "payment" ? (
            <InlineForm colSpan={5} saving={saving} onSave={() => onCreate(draft)} onCancel={onCancel}>
              <select value={draft.direction} onChange={(e) => setDraft({ ...draft, direction: e.target.value })}>
                <option value="incoming">Ingreso (a un oficio)</option>
                <option value="outgoing">Egreso (a una factura)</option>
              </select>
              <input placeholder="Monto *" type="number" required value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
              {draft.direction === "incoming" ? (
                <select value={draft.oficioId} onChange={(e) => setDraft({ ...draft, oficioId: e.target.value })}>
                  <option value="">Oficio (opcional)</option>
                  {oficios.map((o) => <option key={o.id} value={o.id}>{orDash(o.folio)} — {MXN.format(o.amount)}</option>)}
                </select>
              ) : (
                <>
                  <select value={draft.invoiceId} onChange={(e) => setDraft({ ...draft, invoiceId: e.target.value })}>
                    <option value="">Factura (opcional)</option>
                    {invoices.map((inv) => <option key={inv.id} value={inv.id}>{orDash(inv.invoiceFolio)} — {MXN.format(inv.amount)}</option>)}
                  </select>
                  <select value={draft.providerId} onChange={(e) => setDraft({ ...draft, providerId: e.target.value })}>
                    <option value="">Proveedor (opcional)</option>
                    {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </>
              )}
              <input type="date" value={draft.paidOn} onChange={(e) => setDraft({ ...draft, paidOn: e.target.value })} />
              <input placeholder="Folio de seguimiento" value={draft.trackingFolio} onChange={(e) => setDraft({ ...draft, trackingFolio: e.target.value })} />
              <input placeholder="Nota" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
              <input type="file" onChange={(e) => setDraft({ ...draft, _file: e.target.files[0] ?? null })} />
            </InlineForm>
          ) : null}
          {payments.map((pay) => {
            if (editing?.kind === "payment" && editing.id === pay.id) {
              const ed = editing.draft;
              return (
                <InlineForm key={pay.id} colSpan={5} saving={saving} onSave={() => onUpdate(pay.id, ed)} onCancel={onCancel}>
                  <input placeholder="Monto *" type="number" value={ed.amount} onChange={(e) => setEditing({ ...editing, draft: { ...ed, amount: e.target.value } })} />
                  <input type="date" value={ed.paidOn} onChange={(e) => setEditing({ ...editing, draft: { ...ed, paidOn: e.target.value } })} />
                  <input placeholder="Folio de seguimiento" value={ed.trackingFolio} onChange={(e) => setEditing({ ...editing, draft: { ...ed, trackingFolio: e.target.value } })} />
                  <input placeholder="Nota" value={ed.note} onChange={(e) => setEditing({ ...editing, draft: { ...ed, note: e.target.value } })} />
                </InlineForm>
              );
            }
            return (
              <tr key={pay.id}>
                <td>{label(pay.direction)}</td>
                <td>{MXN.format(pay.amount)}</td>
                <td>{fmtDate(pay.paidOn) ?? "—"}</td>
                <td>{orDash(pay.trackingFolio)}</td>
                <td className="project-billing-actions">
                  <DownloadButton fileId={pay.proofFileId} />
                  {canWrite ? (
                    <>
                      <button type="button" className="project-billing-icon-btn" onClick={() => onStartEdit(pay)} title="Editar"><MdEdit /></button>
                      <button type="button" className="project-billing-icon-btn danger" onClick={() => onDelete(pay.id)} title="Eliminar"><MdDelete /></button>
                    </>
                  ) : null}
                </td>
              </tr>
            );
          })}
          {payments.length === 0 && creating !== "payment" ? (
            <tr><td colSpan={5} className="project-billing-empty">Sin pagos</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function ReceiptsBlock({ receipts, quotes, canWrite, canValidate, creating, editing, setEditing, saving, onStartCreate, onStartEdit, onCreate, onUpdate, onSubmit, onValidate, onDelete, onCancel }) {
  const [draft, setDraft] = useState({ quoteId: "", requester: "", amount: "", reference: "", concept: "", _file: null });

  function resetDraft() {
    setDraft({ quoteId: "", requester: "", amount: "", reference: "", concept: "", _file: null });
  }

  return (
    <div className="project-billing-block">
      <h4>
        <MdReceiptLong /> Recibos referenciados
        {canWrite ? (
          <button type="button" className="project-billing-add-btn" onClick={() => { resetDraft(); onStartCreate(); }}>
            <MdAdd /> Agregar
          </button>
        ) : null}
      </h4>
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
          {creating === "receipt" ? (
            <InlineForm colSpan={6} saving={saving} onSave={() => onCreate(draft)} onCancel={onCancel}>
              <select value={draft.quoteId} onChange={(e) => setDraft({ ...draft, quoteId: e.target.value })}>
                <option value="">Cotización (opcional)</option>
                {quotes.map((q) => <option key={q.id} value={q.id}>{orDash(q.providerName)} — {MXN.format(q.amount)}</option>)}
              </select>
              <input placeholder="Solicitante" value={draft.requester} onChange={(e) => setDraft({ ...draft, requester: e.target.value })} />
              <input placeholder="Monto *" type="number" required value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
              <input placeholder="Referencia" value={draft.reference} onChange={(e) => setDraft({ ...draft, reference: e.target.value })} />
              <input placeholder="Concepto" value={draft.concept} onChange={(e) => setDraft({ ...draft, concept: e.target.value })} />
              <input type="file" onChange={(e) => setDraft({ ...draft, _file: e.target.files[0] ?? null })} />
            </InlineForm>
          ) : null}
          {receipts.map((r) => {
            if (editing?.kind === "receipt" && editing.id === r.id) {
              const ed = editing.draft;
              return (
                <InlineForm key={r.id} colSpan={6} saving={saving} onSave={() => onUpdate(r.id, ed)} onCancel={onCancel}>
                  <input placeholder="Solicitante" value={ed.requester} onChange={(e) => setEditing({ ...editing, draft: { ...ed, requester: e.target.value } })} />
                  <input placeholder="Monto *" type="number" value={ed.amount} onChange={(e) => setEditing({ ...editing, draft: { ...ed, amount: e.target.value } })} />
                  <input placeholder="Referencia" value={ed.reference} onChange={(e) => setEditing({ ...editing, draft: { ...ed, reference: e.target.value } })} />
                  <input placeholder="Concepto" value={ed.concept} onChange={(e) => setEditing({ ...editing, draft: { ...ed, concept: e.target.value } })} />
                </InlineForm>
              );
            }
            return (
              <tr key={r.id}>
                <td>{orDash(r.requester)}</td>
                <td>{MXN.format(r.amount)}</td>
                <td>{orDash(r.reference)}</td>
                <td><span className={`project-billing-status ${r.status}`}>{label(r.status)}</span></td>
                <td>{orDash(r.concept)}</td>
                <td className="project-billing-actions">
                  <DownloadButton fileId={r.fileId} />
                  {canWrite && r.status === "draft" ? (
                    <>
                      <button type="button" className="project-billing-icon-btn" onClick={() => onStartEdit(r)} title="Editar"><MdEdit /></button>
                      <button type="button" className="project-billing-icon-btn danger" onClick={() => onDelete(r.id)} title="Eliminar"><MdDelete /></button>
                      <button type="button" className="project-billing-sm-btn" onClick={() => onSubmit(r.id)}>Enviar</button>
                    </>
                  ) : null}
                  {canValidate && r.status === "pending_validation" ? (
                    <>
                      <button type="button" className="project-billing-sm-btn success" onClick={() => onValidate(r.id, "approved")}>Validar</button>
                      <button type="button" className="project-billing-sm-btn danger" onClick={() => onValidate(r.id, "rejected")}>Rechazar</button>
                    </>
                  ) : null}
                </td>
              </tr>
            );
          })}
          {receipts.length === 0 && creating !== "receipt" ? (
            <tr><td colSpan={6} className="project-billing-empty">Sin recibos</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export default ProjectBilling;
