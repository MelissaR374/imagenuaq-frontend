// Finance overview: projects with their invoicing standing, filterable by flag (RF-FIN-07), the ones
// finance marked complete apart, and the invoices of every project as a second view of the same tab.
import { useEffect, useState } from "react";

import {
  MdFolderOpen,
  MdDescription,
  MdReceiptLong,
  MdAttachMoney,
  MdSearch,
  MdFileDownload,
} from "react-icons/md";

import * as api from "../../api/client.js";
import BillingStatCard from "./billingStatCard";
import BillingTable from "./billingTable";
import FinanceInvoices from "../finance/financeInvoices.jsx";

import "./billing.css";

const FILTERS = [
  { id: "all", label: "Todos", flag: null },
  { id: "costed_no_quote", label: "Falta cotización", flag: "costed_no_quote" },
  { id: "missing_invoices", label: "Faltan facturas", flag: "missing_invoices" },
  { id: "correction_requested", label: "Con corrección", flag: "correction_requested" },
  { id: "receipts", label: "Con recibo", flag: null },
  { id: "completed", label: "Completados", flag: null },
];

/** @param {{ onOpenRecord: (record: object) => void, onOpenProject: ((id: number) => void) | null }} props */
function Billing({ onOpenRecord, onOpenProject }) {
  const [view, setView] = useState("projects");
  const [projects, setProjects] = useState(null);
  const [completed, setCompleted] = useState([]);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;

    Promise.all([api.listFinanceProjects({}), api.listFinanceProjects({ completed: true })])
      .then(([open, done]) => {
        if (!cancelled) {
          setProjects(open.projects ?? []);
          setCompleted(done.projects ?? []);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => { cancelled = true; };
  }, []);

  const loading = projects === null && error === null;

  const list = projects ?? [];
  const activeFlag = FILTERS.find((f) => f.id === activeFilter)?.flag ?? null;

  const filtered = (activeFilter === "completed" ? completed : list).filter((p) => {
    if (activeFilter === "receipts" && p.receipts === 0) return false;
    if (activeFlag && !p.flags?.includes(activeFlag)) return false;

    if (!search.trim()) return true;
    const hay = [p.key, p.title, p.requester].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(search.toLowerCase().trim());
  });

  const totalProjects = list.length;
  const missingQuote = list.filter((p) => p.flags?.includes("costed_no_quote")).length;
  const missingInvoice = list.filter((p) => p.flags?.includes("missing_invoices")).length;
  const withQuote = list.filter((p) => p.quotes > 0).length;
  const withInvoice = list.filter((p) => p.uploadedInvoices > 0).length;
  const totalInvoiced = list.reduce((sum, p) => sum + Number(p.invoiced ?? 0), 0);

  function filterCount(id) {
    if (id === "all") return totalProjects;
    if (id === "costed_no_quote") return missingQuote;
    if (id === "missing_invoices") return missingInvoice;
    if (id === "receipts") return list.filter((p) => p.receipts > 0).length;
    if (id === "correction_requested") return list.filter((p) => p.flags?.includes("correction_requested")).length;
    if (id === "completed") return completed.length;
    return 0;
  }

  function handleExport() {
    const columns = ["Clave", "Proyecto", "Solicitante", "Cotizaciones", "Facturas subidas", "Facturas esperadas", "Oficios", "Monto facturado", "Alertas"];
    const rows = filtered.map((p) => [
      p.key, p.title ?? "", p.requester ?? "", p.quotes, p.uploadedInvoices,
      p.expectedInvoices ?? "", p.oficios, p.invoiced, (p.flags ?? []).join("; "),
    ]);

    const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const csv = [columns, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
    const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "facturacion-imagen-uaq.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const views = (
    <nav className="billing-views">
      <button
        type="button"
        className={`billing-view ${view === "projects" ? "active" : ""}`}
        onClick={() => setView("projects")}
      >
        Proyectos
      </button>
      <button
        type="button"
        className={`billing-view ${view === "invoices" ? "active" : ""}`}
        onClick={() => setView("invoices")}
      >
        Facturas
      </button>
    </nav>
  );

  if (view === "invoices") {
    return (
      <>
        {views}
        <FinanceInvoices onOpenProject={onOpenProject} />
      </>
    );
  }

  return (
    <main className="billing-page">
      {views}
      <header className="billing-header" />

      <div className="billing-stats">
        <BillingStatCard
          title="Proyectos"
          value={totalProjects}
          description="En seguimiento financiero"
          icon={MdFolderOpen}
        />
        <BillingStatCard
          title="Falta cotización"
          value={missingQuote}
          description={`${withQuote} con cotización`}
          icon={MdDescription}
        />
        <BillingStatCard
          title="Faltan facturas"
          value={missingInvoice}
          description={`${withInvoice} con factura`}
          icon={MdReceiptLong}
        />
        <BillingStatCard
          title="Monto facturado"
          value={totalInvoiced}
          description="Total registrado"
          icon={MdAttachMoney}
          format="currency"
        />
      </div>

      <div className="billing-toolbar">
        <div className="billing-search">
          <MdSearch />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por clave, proyecto o solicitante..."
            aria-label="Buscar registros"
          />
        </div>

        <button type="button" className="billing-export" onClick={handleExport}>
          <MdFileDownload />
          Exportar reporte
        </button>
      </div>

      <div className="billing-filter-tabs">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`billing-filter-tab ${activeFilter === f.id ? "active" : ""}`}
            onClick={() => setActiveFilter(f.id)}
          >
            {f.label} · {filterCount(f.id)}
          </button>
        ))}
      </div>

      {error ? (
        <p className="billing-error">{error}</p>
      ) : (
        <BillingTable
          records={filtered}
          totalCount={totalProjects}
          loading={loading}
          onOpenRecord={onOpenRecord}
        />
      )}

      <footer className="billing-footer">
        <strong>
          {filtered.length} de {totalProjects} registros
        </strong>
      </footer>
    </main>
  );
}

export default Billing;
