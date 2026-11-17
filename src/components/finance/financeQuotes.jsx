// Cross-project quotes for the finanzas role (RF-FIN-03, RF-FIN-04). Interview 005: finance staff
// need independent access to quotes other areas produce without asking. Quotes are only uploaded, never decided.
import { useEffect, useState } from "react";

import { MdDescription, MdAttachMoney, MdSearch, MdOpenInNew } from "react-icons/md";

import * as api from "../../api/client.js";
import BillingStatCard from "../billing/billingStatCard.jsx";
import { orDash, shortDate } from "../shared/format.js";

import "./financeQuotes.css";

const MXN = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

/**
 * @param {{ onOpenProject?: (id: number, tab?: string) => void }} props
 */
function FinanceQuotes({ onOpenProject }) {
  const [quotes, setQuotes] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    api.listQuotes()
      .then((data) => {
        if (!cancelled) {
          setQuotes(data.quotes ?? []);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => { cancelled = true; };
  }, []);

  const loading = quotes === null && error === null;
  const list = quotes ?? [];

  const filtered = list.filter((q) => {
    if (!search.trim()) return true;
    const hay = [q.projectKey, q.projectTitle, q.providerName, q.entity]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(search.toLowerCase().trim());
  });

  const total = list.length;

  return (
    <main className="finance-quotes-page">
      <div className="finance-quotes-stats">
        <BillingStatCard title="Total" value={total} description="Cotizaciones registradas" icon={MdDescription} />
        <BillingStatCard title="Monto cotizado" value={filtered.reduce((s, q) => s + Number(q.amount), 0)} description="De las cotizaciones visibles" icon={MdAttachMoney} format="currency" />
      </div>

      <div className="finance-quotes-toolbar">
        <div className="finance-quotes-search">
          <MdSearch />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por proyecto, proveedor o entidad..."
            aria-label="Buscar cotizaciones"
          />
        </div>
      </div>

      {error ? <p className="finance-quotes-error">{error}</p> : null}

      <section className="finance-quotes-table-section">
        <div className="finance-quotes-table-heading">
          <h2>Cotizaciones</h2>
          <span>{filtered.length} de {total}</span>
        </div>

        <div className="finance-quotes-table-scroll">
          <table className="finance-quotes-table">
            <thead>
              <tr>
                <th>PROYECTO</th>
                <th>PROVEEDOR / ENTIDAD</th>
                <th>MONTO</th>
                <th>FECHA</th>
                <th>VER</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="finance-quotes-empty">Cargando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="finance-quotes-empty">No se encontraron cotizaciones.</td></tr>
              ) : (
                filtered.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <div className="finance-quotes-project">
                        <span className="finance-quotes-project-key">{orDash(q.projectKey)}</span>
                        <button
                          type="button"
                          className="finance-quotes-project-link"
                          disabled={!onOpenProject || q.projectId == null}
                          onClick={() => onOpenProject?.(q.projectId, "billing")}
                        >
                          {orDash(q.projectTitle)}
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="finance-quotes-provider">
                        <strong>{orDash(q.providerName)}</strong>
                        {q.entity ? <span>{q.entity}</span> : null}
                      </div>
                    </td>
                    <td className="finance-quotes-amount">{MXN.format(q.amount)}</td>
                    <td className="finance-quotes-date">{shortDate(q.createdAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="finance-quotes-view-btn"
                        disabled={!onOpenProject || q.projectId == null}
                        onClick={() => onOpenProject?.(q.projectId, "billing")}
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

        <div className="finance-quotes-table-footer">
          <span>{filtered.length} de {total} cotizaciones</span>
          <span>Monto total: <strong>{MXN.format(filtered.reduce((s, q) => s + Number(q.amount), 0))}</strong></span>
        </div>
      </section>

      <footer className="finance-quotes-footer">
        <strong>{filtered.length} de {total} cotizaciones</strong>
      </footer>
    </main>
  );
}

export default FinanceQuotes;
