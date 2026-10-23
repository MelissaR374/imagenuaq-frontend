//Interfaz principal, se integran indicadores, filtros, búsqueda y las tablas
import { useMemo, useState } from "react";

import {
  MdFolderOpen,
  MdDescription,
  MdReceiptLong,
  MdAttachMoney,
  MdSearch,
  MdFileDownload,
  MdInfoOutline,
} from "react-icons/md";

import BillingStatCard from "./billingStatCard";
import BillingTable from "./billingTable";
import { billingMock } from "./billingMock";

import "./billing.css";

const FILTERS = [
  { id: "all", label: "Todos los registros" },
  { id: "withQuotation", label: "Falta cotización" },
  { id: "withoutInvoice", label: "Sin factura registrada" },
  { id: "withReceipt", label: "Con recibo" },
];

function Billing({
  data = billingMock,
  onOpenRecord,
  onExport,
}) {

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const [documentFilter, setDocumentFilter] = useState("all");
  const [responsibleFilter, setResponsibleFilter] = useState("all");
  const [dueFilter, setDueFilter] = useState("all");

  const projects = data.projects ?? [];

  //calcula indicadores automaticamente
  const summary = useMemo(() => {
    
    const totalProjects = projects.length;
    
    const withoutQuotation = projects.filter(
        (record) => record.quotation?.status === "pending"
    ).length;

    const withQuotation = projects.filter(
        (record) => record.quotation?.status === "available"
    ).length;

    const withoutInvoice = projects.filter(
        (record) => record.invoice?.status === "missing"
    ).length;

    const withInvoice = projects.filter(
        (record) => record.invoice?.status === "available"
    ).length;

    const withReceipt = projects.filter(
        (record) => record.receipt?.status === "referenced"
    ).length;

    const knownAmount = projects.reduce((total, record) => {
        const amount = Number(record.amount);

       if(
            record.amount === null ||
            record.amount === undefined ||
            record.amount === "" ||
            !Number.isFinite(amount)
        ){
            return total;
        }
        return total + amount;
    }, 0);

    return{
        totalProjects,
        withoutQuotation,
        withQuotation,
        withoutInvoice,
        withInvoice,
        withReceipt,
        knownAmount,
    };
  }, [projects])

  const responsibles = useMemo(
    () =>
      [...new Set(projects.map((project) => project.responsible))]
        .filter(Boolean)
        .sort(),
    [projects]
  );

  const filteredRecords = useMemo(() => {
    
    return projects.filter((record) => {
      const searchableText = [
        record.code,
        record.name,
        record.responsible,
        record.entity,
        record.description,
        record.receipt?.folio,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!searchableText.includes(search.toLowerCase().trim())) {
        return false;
      }

      if (
        activeFilter === "withQuotation" &&
        record.quotation?.status !== "pending"
      ) {
        return false;
      }

      if (
        activeFilter === "withoutInvoice" &&
        record.invoice?.status !== "missing"
      ) {
        return false;
      }

      if (
        activeFilter === "withReceipt" &&
        record.receipt?.status !== "referenced"
      ) {
        return false;
      }

      if (
        documentFilter === "quotation" &&
        record.quotation?.status !== "available"
      ) {
        return false;
      }

      if (
        documentFilter === "invoice" &&
        record.invoice?.status === "missing"
      ) {
        return false;
      }

      if (
        responsibleFilter !== "all" &&
        record.responsible !== responsibleFilter
      ) {
        return false;
      }

      if (
        dueFilter === "withDate" &&
        !record.receipt?.date
      ) {
        return false;
      }

      if (
        dueFilter === "withoutDate" &&
        record.receipt?.date
      ) {
        return false;
      }

      return true;
    });
  }, [
    projects,
    search,
    activeFilter,
    documentFilter,
    responsibleFilter,
    dueFilter,
  ]);

  const filteredProjects = filteredRecords;

  function handleExport() {
    if (onExport) {
      onExport(filteredRecords);
      return;
    }

    //Exportación local de prueba en CSV.
    const columns = [
      "Código",
      "Proyecto",
      "Responsable",
      "Monto",
      "Cotización",
      "Factura",
      "Recibo",
    ];

    const rows = filteredRecords.map((record) => [
      record.code,
      record.name ?? record.description ?? "",
      record.responsible ?? "",
      record.amount ?? "",
      record.quotation?.label ?? "",
      record.invoice?.label ?? "",
      record.receipt?.folio ?? "",
    ]);

    const escapeCSV = (value) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;

    const csv = [columns, ...rows]
      .map((row) => row.map(escapeCSV).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = "facturacion-imagen-uaq.csv";
    anchor.click();

    URL.revokeObjectURL(url);
  }
  
  return (
    <main className="billing-page">
      {/* ENCABEZADO */}

      <header className="billing-header">
        {/* <div className="billing-header-role">
          <strong>Edición</strong>
          <span>Líder de área · Facturación</span>
        </div> */}
      </header>

      {/* INDICADORES */}

      <div className="billing-stats">
        <BillingStatCard
          title="Proyectos del reporte"
          value={summary.totalProjects}
          description="Proyectos identificados"
          icon={MdFolderOpen}
        />

        <BillingStatCard
          title="Falta cotización"
          value={summary.withoutQuotation}
          description={`${summary.withQuotation} con cotización disponible`}
          icon={MdDescription}
        />

        <BillingStatCard
          title="Sin factura registrada"
          value={summary.withoutInvoice}
          description={`${summary.withInvoice} con factura registrada`}
          icon={MdReceiptLong}
        />

        <BillingStatCard
          title="Montos conocidos"
          value={summary.knownAmount}
          description="Suma de los montos registrados"
          icon={MdAttachMoney}
          format="currency"
        />
      </div>

      {/* FILTROS */}

      {/*BUSQUEDA */}
      <div className="billing-toolbar">
        <div className="billing-search">
          <MdSearch />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar proyecto, código o folio..."
            aria-label="Buscar registros"
          />
        </div>

        {/*FILTROS CON LISTAS DESPEGABLES */}
        <select
          value={documentFilter}
          onChange={(event) => setDocumentFilter(event.target.value)}
          aria-label="Filtrar documentos"
        >
          <option value="all">Documentos: Todos</option>
          <option value="quotation">Con cotización</option>
          <option value="invoice">Con factura</option>
        </select>

        <select
          value={responsibleFilter}
          onChange={(event) => setResponsibleFilter(event.target.value)}
          aria-label="Filtrar responsable"
        >
          <option value="all">Responsables</option>

          {responsibles.map((responsible) => (
            <option key={responsible} value={responsible}>
              {responsible}
            </option>
          ))}
        </select>

        <select
          value={dueFilter}
          onChange={(event) => setDueFilter(event.target.value)}
          aria-label="Filtrar vencimientos"
        >
          <option value="all">Vencimientos</option>
          <option value="withDate">Con fecha</option>
          <option value="withoutDate">Sin fecha</option>
        </select>
        
        {/*EXPORTAR EXCEL */}
        <button
          type="button"
          className="billing-export"
          onClick={handleExport}
        >
          <MdFileDownload />
          Exportar reporte
        </button>
      </div>

      {/* PESTAÑAS */}

      <div className="billing-filter-tabs">
        {FILTERS.map((filter) => {
          const count =
            filter.id === "all"
              ? summary.totalProjects
              : filter.id === "withQuotation"
                ? summary.withQuotation
                : filter.id === "withoutInvoice"
                  ? summary.withoutInvoice
                  : summary.withReceipt;

          return (
            <button
              key={filter.id}
              type="button"
              className={`billing-filter-tab ${
                activeFilter === filter.id ? "active" : ""
              }`}
              onClick={() => setActiveFilter(filter.id)}
            >
              {filter.label} · {count}
            </button>
          );
        })}
      </div>

      {/* TABLA DE PROYECTOS */}

      <BillingTable
        title="Proyectos identificados"
        records={filteredProjects}
        totalCount={projects.length}
        identified
        onOpenRecord={onOpenRecord}
      />

      
      {/* PIE DE PÁGINA */}

      <footer className="billing-footer">
        <strong>
          {filteredProjects.length} de {""}
          {projects.length} registros representados
        </strong>
      </footer>
    </main>
  );
}

export default Billing;