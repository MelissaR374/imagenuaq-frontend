// Cross-project invoices for the finanzas role (RF-FIN-06). Interview 005: finance staff need
// independent access to invoices. Invoices have no stages; the only mark is a pending correction.
import { useEffect, useState } from "react";

import {
  MdReceiptLong,
  MdFeedback,
  MdAttachMoney,
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

const FILTERS = [
  { id: "all", label: "Todas" },
  { id: "correction", label: "Con corrección" },
];

/**
 * @param {{ onOpenProject?: (id: number, tab?: string) => void }} props
 */
function FinanceInvoices({ onOpenProject }) {
  const [invoices, setInvoices] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;

    api.listInvoices({})
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
  }, []);

  const loading = invoices === null && error === null;
  const list = invoices ?? [];

  const filtered = list.filter((inv) => {
    if (activeFilter === "correction" && !inv.correctionRequestedAt) return false;
    if (!search.trim()) return true;
    const hay = [inv.projectKey, inv.projectTitle, inv.providerName, inv.invoiceFolio, inv.fiscalFolio]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(search.toLowerCase().trim());
  });

  const total = list.length;
  const corrections = list.filter((i) => i.correctionRequestedAt).length;
  const amount = list.reduce((s, i) => s + Number(i.amount), 0);

  function filterCount(id) {
    return id === "correction" ? corrections : total;
  }

  return (
    <main className="finance-invoices-page">
      <div className="finance-invoices-stats">
        <BillingStatCard title="Total" value={total} description="Facturas registradas" icon={MdReceiptLong} />
        <BillingStatCard title="Con corrección" value={corrections} description="Esperando nueva versión" icon={MdFeedback} />
        <BillingStatCard title="Monto" value={amount} description="Total facturado" icon={MdAttachMoney} format="currency" />
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
                <th>CORRECCIÓN</th>
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
                      {inv.correctionRequestedAt ? (
                        <span className="finance-invoices-status warning" title={inv.correctionNote ?? ""}>
                          {inv.correctionNote}
                        </span>
                      ) : "—"}
                    </td>
                    <td>{orDash(inv.oficioFolio)}</td>
                    <td className="finance-invoices-action-cell">
                      <button
                        type="button"
                        className="finance-invoices-view-btn"
                        disabled={!onOpenProject || inv.projectId == null}
                        onClick={() => onOpenProject?.(inv.projectId, "billing")}
                        title="Abrir el proyecto"
                      >
                        <MdOpenInNew />
                      </button>
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
