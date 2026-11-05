// Finance overview: projects with their invoicing standing, filterable by flag (RF-FIN-07).
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

import "./billing.css";

const FILTERS = [
  { id: "all", label: "Todos", flag: null },
  { id: "costed_no_quote", label: "Falta cotización", flag: "costed_no_quote" },
  { id: "missing_invoices", label: "Sin factura", flag: "missing_invoices" },
  { id: "receipts", label: "Con recibo", flag: null },
];

function Billing({ onOpenRecord }) {
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;

    const flag = FILTERS.find((f) => f.id === activeFilter)?.flag ?? null;
    const params = flag ? { flag } : {};

    api.listFinanceProjects(params)
      .then((data) => {
        if (!cancelled) {
          setProjects(data.projects ?? []);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => { cancelled = true; };
  }, [activeFilter]);

  const loading = projects === null && error === null;

  const list = projects ?? [];

  const filtered = list.filter((p) => {
    if (activeFilter === "receipts" && p.receipts === 0) return false;

    if (!search.trim()) return true;
    const hay = [p.key, p.title, p.requester].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(search.toLowerCase().trim());
  });

  const totalProjects = list.length;
  const missingQuote = list.filter((p) => p.flags?.includes("costed_no_quote")).length;
  const missingInvoice = list.filter((p) => p.flags?.includes("missing_invoices")).length;
  const totalInvoiced = list.reduce((sum, p) => sum + Number(p.invoiced ?? 0), 0);

  function filterCount(id) {
    if (id === "all") return totalProjects;
    if (id === "costed_no_quote") return missingQuote;
    if (id === "missing_invoices") return missingInvoice;
    if (id === "receipts") return list.filter((p) => p.receipts > 0).length;
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

  return (
    <main className="billing-page">
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
          description={`${totalProjects - missingQuote} con cotización`}
          icon={MdDescription}
        />
        <BillingStatCard
          title="Sin factura"
          value={missingInvoice}
          description={`${totalProjects - missingInvoice} con factura`}
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
