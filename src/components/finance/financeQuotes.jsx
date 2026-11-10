// Cross-project quotes for the finanzas role (RF-FIN-03, RF-FIN-04). Interview 005: finance staff
// need independent access to quotes other areas produce without asking.
import { useEffect, useState } from "react";

import {
  MdDescription,
  MdHourglassEmpty,
  MdCheckCircle,
  MdCancel,
  MdSearch,
  MdOpenInNew,
} from "react-icons/md";

import * as api from "../../api/client.js";
import BillingStatCard from "../billing/billingStatCard.jsx";
import { orDash, shortDate } from "../shared/format.js";

import "./financeQuotes.css";

const MXN = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

const STATUS_LABELS = {
  issued: "Emitida",
  in_review: "En revisión",
  approved: "Aprobada",
  rejected: "Rechazada",
};

const STATUS_CLASS = {
  issued: "neutral",
  in_review: "warning",
  approved: "success",
  rejected: "danger",
};

const FILTERS = [
  { id: "all", label: "Todas", status: null },
  { id: "in_review", label: "En revisión", status: "in_review" },
  { id: "issued", label: "Emitidas", status: "issued" },
  { id: "approved", label: "Aprobadas", status: "approved" },
  { id: "rejected", label: "Rechazadas", status: "rejected" },
];

/**
 * @param {{ onOpenProject?: (id: number, tab?: string) => void }} props
 */
function FinanceQuotes({ onOpenProject }) {
  const [quotes, setQuotes] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [deciding, setDeciding] = useState(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const status = FILTERS.find((f) => f.id === activeFilter)?.status ?? null;
    const params = status ? { status } : {};

    api.listQuotes(params)
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
  }, [activeFilter, version]);

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
  const inReview = list.filter((q) => q.status === "in_review").length;
  const approved = list.filter((q) => q.status === "approved").length;
  const rejected = list.filter((q) => q.status === "rejected").length;

  function filterCount(id) {
    if (id === "all") return total;
    if (id === "in_review") return inReview;
    if (id === "approved") return approved;
    if (id === "rejected") return rejected;
    return list.filter((q) => q.status === id).length;
  }

  async function submitDecision(decision) {
    if (!deciding) return;
    setSaving(true);
    try {
      await api.decideQuote(deciding.id, { decision, comment: comment || undefined });
      setDeciding(null);
      setComment("");
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="finance-quotes-page">
      <div className="finance-quotes-stats">
        <BillingStatCard title="Total" value={total} description="Cotizaciones registradas" icon={MdDescription} />
        <BillingStatCard title="En revisión" value={inReview} description="Pendientes de decisión" icon={MdHourglassEmpty} />
        <BillingStatCard title="Aprobadas" value={approved} description={`${total > 0 ? Math.round((approved / total) * 100) : 0}% del total`} icon={MdCheckCircle} />
        <BillingStatCard title="Rechazadas" value={rejected} description={`${total > 0 ? Math.round((rejected / total) * 100) : 0}% del total`} icon={MdCancel} />
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

      <div className="finance-quotes-filter-tabs">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`finance-quotes-filter-tab ${activeFilter === f.id ? "active" : ""}`}
            onClick={() => setActiveFilter(f.id)}
          >
            {f.label} · {filterCount(f.id)}
          </button>
        ))}
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
                <th>ESTADO</th>
                <th>FECHA</th>
                <th>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="finance-quotes-empty">Cargando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="finance-quotes-empty">No se encontraron cotizaciones.</td></tr>
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
                    <td>
                      <span className={`finance-quotes-status ${STATUS_CLASS[q.status] ?? "neutral"}`}>
                        {STATUS_LABELS[q.status] ?? q.status}
                      </span>
                    </td>
                    <td className="finance-quotes-date">{shortDate(q.createdAt)}</td>
                    <td>
                      {q.status === "issued" || q.status === "in_review" ? (
                        <button type="button" className="finance-quotes-action-btn" onClick={() => { setDeciding(q); setComment(""); }}>
                          Decidir
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="finance-quotes-view-btn"
                          disabled={!onOpenProject || q.projectId == null}
                          onClick={() => onOpenProject?.(q.projectId, "billing")}
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

        <div className="finance-quotes-table-footer">
          <span>{filtered.length} de {total} cotizaciones</span>
          <span>Monto total: <strong>{MXN.format(filtered.reduce((s, q) => s + Number(q.amount), 0))}</strong></span>
        </div>
      </section>

      {deciding ? (
        <div className="finance-quotes-decision-overlay" onClick={() => setDeciding(null)}>
          <div className="finance-quotes-decision-panel" onClick={(e) => e.stopPropagation()}>
            <h3>Decidir cotización</h3>
            <p><strong>{orDash(deciding.providerName)}</strong> — {MXN.format(deciding.amount)}</p>
            <p className="finance-quotes-decision-project">Proyecto: {orDash(deciding.projectKey)} {orDash(deciding.projectTitle)}</p>
            <label className="finance-quotes-decision-label">
              Comentario (opcional)
              <textarea className="finance-quotes-decision-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
            </label>
            <div className="finance-quotes-decision-actions">
              <button type="button" className="finance-quotes-approve-btn" disabled={saving} onClick={() => submitDecision("approved")}>Aprobar</button>
              <button type="button" className="finance-quotes-reject-btn" disabled={saving} onClick={() => submitDecision("rejected")}>Rechazar</button>
              <button type="button" className="finance-quotes-cancel-btn" disabled={saving} onClick={() => setDeciding(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      ) : null}

      <footer className="finance-quotes-footer">
        <strong>{filtered.length} de {total} cotizaciones</strong>
      </footer>
    </main>
  );
}

export default FinanceQuotes;
