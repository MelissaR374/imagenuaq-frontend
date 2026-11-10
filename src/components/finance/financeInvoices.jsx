// Cross-project invoices for the finanzas role (RF-FIN-06, RF-FIN-10). Interview 005: finance staff
// need independent access to invoices. Interview 007: Katia tracks 70+ oficios.
import { useEffect, useState } from "react";

import {
  MdReceiptLong,
  MdUploadFile,
  MdPayment,
  MdCheckCircle,
  MdSearch,
  MdOpenInNew,
} from "react-icons/md";

import * as api from "../../api/client.js";
import BillingStatCard from "../billing/billingStatCard.jsx";
import { orDash } from "../shared/format.js";

import "./financeInvoices.css";

const MXN = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

const STATUS_LABELS = {
  uploaded: "Subida",
  sent: "Enviada",
  in_payment: "En pago",
  paid: "Pagada",
};

const STATUS_CLASS = {
  uploaded: "neutral",
  sent: "warning",
  in_payment: "warning",
  paid: "success",
};

const FILTERS = [
  { id: "all", label: "Todas", status: null },
  { id: "uploaded", label: "Subidas", status: "uploaded" },
  { id: "sent", label: "Enviadas", status: "sent" },
  { id: "in_payment", label: "En pago", status: "in_payment" },
  { id: "paid", label: "Pagadas", status: "paid" },
];

/**
 * @param {{ onOpenProject?: (id: number, tab?: string) => void }} props
 */
function FinanceInvoices({ onOpenProject }) {
  const [invoices, setInvoices] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [statusForm, setStatusForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const status = FILTERS.find((f) => f.id === activeFilter)?.status ?? null;
    const params = status ? { status } : {};

    api.listInvoices(params)
      .then((data) => {
        if (!cancelled) {
          setInvoices(data.invoices ?? []);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => { cancelled = true; };
  }, [activeFilter, version]);

  const loading = invoices === null && error === null;
  const list = invoices ?? [];

  const filtered = list.filter((inv) => {
    if (!search.trim()) return true;
    const hay = [inv.projectKey, inv.projectTitle, inv.providerName, inv.invoiceFolio, inv.fiscalFolio]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(search.toLowerCase().trim());
  });

  const total = list.length;
  const uploaded = list.filter((i) => i.status === "uploaded").length;
  const inPayment = list.filter((i) => i.status === "in_payment").length;
  const paid = list.filter((i) => i.status === "paid").length;

  function filterCount(id) {
    if (id === "all") return total;
    return list.filter((i) => i.status === id).length;
  }

  async function handleSetStatus(id, status, paymentFolio) {
    setSaving(true);
    try {
      await api.setInvoiceStatus(id, { status, paymentFolio: paymentFolio || undefined });
      setStatusForm(null);
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="finance-invoices-page">
      <div className="finance-invoices-stats">
        <BillingStatCard title="Total" value={total} description="Facturas registradas" icon={MdReceiptLong} />
        <BillingStatCard title="Subidas" value={uploaded} description="Pendientes de trámite" icon={MdUploadFile} />
        <BillingStatCard title="En pago" value={inPayment} description="En proceso de cobro" icon={MdPayment} />
        <BillingStatCard title="Pagadas" value={paid} description={`${total > 0 ? Math.round((paid / total) * 100) : 0}% del total`} icon={MdCheckCircle} />
      </div>

      <div className="finance-invoices-toolbar">
        <div className="finance-invoices-search">
          <MdSearch />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por proyecto, proveedor o folio..."
            aria-label="Buscar facturas"
          />
        </div>
      </div>

      <div className="finance-invoices-filter-tabs">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`finance-invoices-filter-tab ${activeFilter === f.id ? "active" : ""}`}
            onClick={() => setActiveFilter(f.id)}
          >
            {f.label} · {filterCount(f.id)}
          </button>
        ))}
      </div>

      {error ? <p className="finance-invoices-error">{error}</p> : null}

      <section className="finance-invoices-table-section">
        <div className="finance-invoices-table-heading">
          <h2>Facturas</h2>
          <span>{filtered.length} de {total}</span>
        </div>

        <div className="finance-invoices-table-scroll">
          <table className="finance-invoices-table">
            <thead>
              <tr>
                <th>PROYECTO</th>
                <th>FOLIO</th>
                <th>PROVEEDOR</th>
                <th>MONTO</th>
                <th>ESTADO</th>
                <th>OFICIO</th>
                <th>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="finance-invoices-empty">Cargando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="finance-invoices-empty">No se encontraron facturas.</td></tr>
              ) : (
                filtered.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <div className="finance-invoices-project">
                        <span className="finance-invoices-project-key">{orDash(inv.projectKey)}</span>
                        <button
                          type="button"
                          className="finance-invoices-project-link"
                          disabled={!onOpenProject || inv.projectId == null}
                          onClick={() => onOpenProject?.(inv.projectId, "billing")}
                        >
                          {orDash(inv.projectTitle)}
                        </button>
                      </div>
                    </td>
                    <td>{orDash(inv.invoiceFolio)}</td>
                    <td>{orDash(inv.providerName)}</td>
                    <td className="finance-invoices-amount">{MXN.format(inv.amount)}</td>
                    <td>
                      <span className={`finance-invoices-status ${STATUS_CLASS[inv.status] ?? "neutral"}`}>
                        {STATUS_LABELS[inv.status] ?? inv.status}
                      </span>
                    </td>
                    <td>{orDash(inv.oficioFolio)}</td>
                    <td className="finance-invoices-action-cell">
                      {(inv.status === "uploaded" || inv.status === "sent") ? (
                        statusForm?.id === inv.id ? (
                          <span className="finance-invoices-status-form">
                            <input
                              placeholder="Folio de pago"
                              value={statusForm.folio}
                              onChange={(e) => setStatusForm({ ...statusForm, folio: e.target.value })}
                            />
                            <button type="button" className="finance-invoices-confirm-btn" disabled={saving} onClick={() => handleSetStatus(inv.id, "in_payment", statusForm.folio)}>
                              Confirmar
                            </button>
                            <button type="button" className="finance-invoices-cancel-btn" onClick={() => setStatusForm(null)}>×</button>
                          </span>
                        ) : (
                          <button type="button" className="finance-invoices-action-btn" onClick={() => setStatusForm({ id: inv.id, folio: "" })}>
                            Marcar en pago
                          </button>
                        )
                      ) : inv.status === "in_payment" ? (
                        <button type="button" className="finance-invoices-action-btn success" disabled={saving} onClick={() => handleSetStatus(inv.id, "paid")}>
                          Marcar pagada
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="finance-invoices-view-btn"
                          disabled={!onOpenProject || inv.projectId == null}
                          onClick={() => onOpenProject?.(inv.projectId, "billing")}
                        >
                          <MdOpenInNew />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="finance-invoices-table-footer">
          <span>{filtered.length} de {total} facturas</span>
          <span>Monto total: <strong>{MXN.format(filtered.reduce((s, i) => s + Number(i.amount), 0))}</strong></span>
        </div>
      </section>

      <footer className="finance-invoices-footer">
        <strong>{filtered.length} de {total} facturas</strong>
      </footer>
    </main>
  );
}

export default FinanceInvoices;
