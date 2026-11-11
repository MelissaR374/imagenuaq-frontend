// Print order list and creation (RF-IMP-01 to RF-IMP-08). Selecting a project auto-fills
// entity and pantone from the catalog. The printable sheet is a separate component.
import { useEffect, useState } from "react";

import { MdAdd, MdSearch, MdVisibility } from "react-icons/md";

import * as api from "../../api/client.js";
import { shortDate, orDash } from "../shared/format.js";
import PrintSheet from "./printSheet.jsx";

import "./printOrders.css";

const STATUS_LABELS = {
  pending: "Pendiente",
  in_progress: "En proceso",
  completed: "Completada",
  cancelled: "Cancelada",
};

const STATUS_CLASS = {
  pending: "warning",
  in_progress: "info",
  completed: "success",
  cancelled: "neutral",
};

const FILTERS = [
  { id: "all", label: "Todas", status: null },
  { id: "pending", label: "Pendientes", status: "pending" },
  { id: "in_progress", label: "En proceso", status: "in_progress" },
  { id: "completed", label: "Completadas", status: "completed" },
  { id: "cancelled", label: "Canceladas", status: "cancelled" },
];

const EMPTY_DRAFT = {
  projectId: "",
  machineId: "",
  trabajo: "",
  entityName: "",
  pantoneCode: "",
  pantalla: "",
  papelType: "",
  papelSize: "",
  cantidad: "",
  laminas: "",
  frente: false,
  vuelta: false,
  corte: "",
  folio: "",
  paquetesD: "",
  pegado: false,
  copiante: false,
  notes: "",
};

/** @param {{ canWrite: boolean, canCreate: boolean }} props */
function PrintOrders({ canWrite, canCreate }) {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [version, setVersion] = useState(0);

  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [createError, setCreateError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [projects, setProjects] = useState([]);
  const [machines, setMachines] = useState([]);
  const [pantones, setPantones] = useState([]);
  const [allPantones, setAllPantones] = useState([]);

  const [projectSearch, setProjectSearch] = useState("");
  const [projectOpen, setProjectOpen] = useState(false);
  const [pantoneSearch, setPantoneSearch] = useState("");
  const [pantoneOpen, setPantoneOpen] = useState(false);

  const [viewOrder, setViewOrder] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const status = FILTERS.find((f) => f.id === activeFilter)?.status ?? null;
    const params = status ? { status } : {};
    api.listPrintOrders(params)
      .then((data) => { if (!cancelled) { setOrders(data.orders ?? []); setError(null); } })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [activeFilter, version]);

  useEffect(() => {
    if (!showCreate) return;
    let cancelled = false;
    Promise.all([api.listProjects(), api.listPrintMachines(), api.listPantones()])
      .then(([projRes, machRes, ptnRes]) => {
        if (cancelled) return;
        setProjects(projRes.projects ?? []);
        setMachines((machRes.machines ?? []).filter((m) => m.isActive));
        setAllPantones(ptnRes.pantones ?? []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [showCreate]);

  function openCreate() {
    setDraft(EMPTY_DRAFT);
    setCreateError(null);
    setPantones([]);
    setProjectSearch("");
    setPantoneSearch("");
    setShowCreate(true);
  }

  function selectProject(project) {
    const requester = project?.requester ?? "";
    setProjectSearch(project ? `${project.key ?? ""} ${project.title}`.trim() : "");
    setProjectOpen(false);
    setDraft((d) => ({ ...d, projectId: project?.id ?? "", entityName: requester, trabajo: project?.title ?? "" }));
    setPantoneSearch("");
    if (requester) {
      api.lookupPantones(requester)
        .then((data) => {
          const list = data.pantones ?? [];
          setPantones(list);
          if (list.length > 0) {
            setDraft((d) => ({ ...d, pantoneCode: list[0].pantoneCode }));
            setPantoneSearch(list[0].pantoneCode);
          }
        })
        .catch(() => setPantones([]));
    } else {
      setPantones([]);
    }
  }

  function selectPantone(code) {
    setDraft((d) => ({ ...d, pantoneCode: code }));
    setPantoneSearch(code);
    setPantoneOpen(false);
  }

  async function submitCreate() {
    setSaving(true);
    setCreateError(null);
    try {
      await api.createPrintOrder({
        projectId: Number(draft.projectId),
        machineId: Number(draft.machineId),
        trabajo: draft.trabajo,
        entityName: draft.entityName || null,
        pantoneCode: draft.pantoneCode || null,
        pantalla: draft.pantalla || null,
        papelType: draft.papelType || null,
        papelSize: draft.papelSize || null,
        cantidad: draft.cantidad ? Number(draft.cantidad) : null,
        laminas: draft.laminas ? Number(draft.laminas) : null,
        frente: draft.frente,
        vuelta: draft.vuelta,
        corte: draft.corte || null,
        folio: draft.folio || null,
        paquetesD: draft.paquetesD ? Number(draft.paquetesD) : null,
        pegado: draft.pegado,
        copiante: draft.copiante,
        notes: draft.notes || null,
      });
      setShowCreate(false);
      setVersion((v) => v + 1);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(orderId, status) {
    try {
      await api.setPrintOrderStatus(orderId, { status });
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(orderId) {
    try {
      await api.deletePrintOrder(orderId);
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  if (viewOrder) {
    return <PrintSheet order={viewOrder} onBack={() => setViewOrder(null)} />;
  }

  const filtered = (orders ?? []).filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (o.orderNumber ?? "").toLowerCase().includes(q) ||
      (o.projectTitle ?? "").toLowerCase().includes(q) ||
      (o.entityName ?? "").toLowerCase().includes(q) ||
      (o.trabajo ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <section className="print-orders">
      <div className="print-orders-header">
        <div className="print-orders-search">
          <MdSearch />
          <input
            placeholder="Buscar por orden, proyecto, entidad..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {canCreate ? (
          <button className="po-btn po-btn-primary" onClick={openCreate}>
            <MdAdd /> Nueva orden
          </button>
        ) : null}
      </div>

      <div className="print-orders-filters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={`filter-chip ${activeFilter === f.id ? "active" : ""}`}
            onClick={() => setActiveFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? <p className="print-orders-error">{error}</p> : null}
      {orders === null ? <p className="print-orders-loading">Cargando...</p> : null}
      {orders && filtered.length === 0 ? (
        <p className="print-orders-empty">Sin ordenes de impresion.</p>
      ) : null}

      {filtered.length > 0 ? (
        <table className="print-orders-table">
          <thead>
            <tr>
              <th>Orden</th>
              <th>Proyecto</th>
              <th>Entidad</th>
              <th>Trabajo</th>
              <th>Maquina</th>
              <th>Estatus</th>
              <th>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id}>
                <td>{o.orderNumber}</td>
                <td>{orDash(o.projectTitle)}</td>
                <td>{orDash(o.entityName)}</td>
                <td className="po-trabajo-cell">{orDash(o.trabajo)}</td>
                <td>{orDash(o.machineName)}</td>
                <td>
                  <span className={`status-pill ${STATUS_CLASS[o.status] ?? ""}`}>
                    {STATUS_LABELS[o.status] ?? o.status}
                  </span>
                </td>
                <td>{shortDate(o.createdAt)}</td>
                <td className="po-actions-cell">
                  <button className="po-btn po-btn-small" onClick={() => setViewOrder(o)}>
                    <MdVisibility />
                  </button>
                  {canWrite && o.status === "pending" ? (
                    <>
                      <button className="po-btn po-btn-small" onClick={() => changeStatus(o.id, "in_progress")}>
                        Iniciar
                      </button>
                      <button className="po-btn po-btn-small" onClick={() => changeStatus(o.id, "cancelled")}>
                        Cancelar
                      </button>
                    </>
                  ) : null}
                  {canWrite && o.status === "in_progress" ? (
                    <button className="po-btn po-btn-small" onClick={() => changeStatus(o.id, "completed")}>
                      Completar
                    </button>
                  ) : null}
                  {canWrite && o.status === "pending" ? (
                    <button className="po-btn po-btn-small po-btn-danger" onClick={() => handleDelete(o.id)}>
                      Eliminar
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {showCreate ? (
        <div className="po-modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="po-modal po-modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>Nueva orden de impresion</h3>

            {createError ? <p className="print-orders-error">{createError}</p> : null}

            <div className="po-modal-field po-autocomplete">
              <span>Proyecto</span>
              <input
                placeholder="Buscar proyecto..."
                value={projectSearch}
                onChange={(e) => { setProjectSearch(e.target.value); setProjectOpen(true); setDraft((d) => ({ ...d, projectId: "" })); }}
                onFocus={() => setProjectOpen(true)}
                onBlur={() => setTimeout(() => setProjectOpen(false), 150)}
              />
              {projectOpen && projects.length > 0 ? (
                <ul className="po-dropdown">
                  {projects
                    .filter((p) => {
                      if (!projectSearch) return true;
                      const q = projectSearch.toLowerCase();
                      return (p.key ?? "").toLowerCase().includes(q) || p.title.toLowerCase().includes(q) || (p.requester ?? "").toLowerCase().includes(q);
                    })
                    .slice(0, 12)
                    .map((p) => (
                      <li key={p.id} onMouseDown={() => selectProject(p)}>
                        {p.key ? <strong>{p.key}</strong> : null} {p.title}
                        {p.requester ? <span className="po-dropdown-hint">{p.requester}</span> : null}
                      </li>
                    ))}
                </ul>
              ) : null}
            </div>

            <div className="po-modal-row">
              <div className="po-modal-field">
                <span>Maquina</span>
                <select value={draft.machineId} onChange={(e) => setDraft({ ...draft, machineId: e.target.value })}>
                  <option value="">Seleccionar...</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div className="po-modal-field">
                <span>Entidad</span>
                <input value={draft.entityName} onChange={(e) => setDraft({ ...draft, entityName: e.target.value })} />
              </div>
            </div>

            <div className="po-modal-row">
              <div className="po-modal-field po-autocomplete">
                <span>Pantone</span>
                <input
                  placeholder="Buscar pantone..."
                  value={pantoneSearch}
                  onChange={(e) => { setPantoneSearch(e.target.value); setDraft((d) => ({ ...d, pantoneCode: e.target.value })); setPantoneOpen(true); }}
                  onFocus={() => setPantoneOpen(true)}
                  onBlur={() => setTimeout(() => setPantoneOpen(false), 150)}
                />
                {pantoneOpen ? (() => {
                  const source = pantones.length > 0 ? pantones : allPantones;
                  const hits = source.filter((p) => {
                    if (!pantoneSearch) return true;
                    const q = pantoneSearch.toLowerCase();
                    return p.pantoneCode.toLowerCase().includes(q) || p.entityName.toLowerCase().includes(q);
                  }).slice(0, 10);
                  return hits.length > 0 ? (
                    <ul className="po-dropdown">
                      {hits.map((p) => (
                        <li key={p.id} onMouseDown={() => selectPantone(p.pantoneCode)}>
                          <strong>{p.pantoneCode}</strong>
                          <span className="po-dropdown-hint">{p.entityName}</span>
                          {p.hexValue ? <span className="ptn-swatch-inline" style={{ background: p.hexValue }} /> : null}
                        </li>
                      ))}
                    </ul>
                  ) : null;
                })() : null}
              </div>
              <div className="po-modal-field">
                <span>Pantalla</span>
                <input value={draft.pantalla} onChange={(e) => setDraft({ ...draft, pantalla: e.target.value })} />
              </div>
            </div>

            <div className="po-modal-field">
              <span>Trabajo</span>
              <input value={draft.trabajo} onChange={(e) => setDraft({ ...draft, trabajo: e.target.value })} />
            </div>

            <div className="po-modal-row">
              <div className="po-modal-field">
                <span>Tipo de papel</span>
                <input value={draft.papelType} onChange={(e) => setDraft({ ...draft, papelType: e.target.value })} placeholder="Ej: Bond 90 gm" />
              </div>
              <div className="po-modal-field">
                <span>Tamano de papel</span>
                <input value={draft.papelSize} onChange={(e) => setDraft({ ...draft, papelSize: e.target.value })} placeholder="Ej: 448x610 mm" />
              </div>
            </div>

            <div className="po-modal-row">
              <div className="po-modal-field">
                <span>Cantidad</span>
                <input type="number" value={draft.cantidad} onChange={(e) => setDraft({ ...draft, cantidad: e.target.value })} />
              </div>
              <div className="po-modal-field">
                <span>Laminas</span>
                <input type="number" value={draft.laminas} onChange={(e) => setDraft({ ...draft, laminas: e.target.value })} />
              </div>
            </div>

            <div className="po-modal-row po-modal-checkboxes">
              <label><input type="checkbox" checked={draft.frente} onChange={(e) => setDraft({ ...draft, frente: e.target.checked })} /> Frente</label>
              <label><input type="checkbox" checked={draft.vuelta} onChange={(e) => setDraft({ ...draft, vuelta: e.target.checked })} /> Vuelta</label>
              <label><input type="checkbox" checked={draft.pegado} onChange={(e) => setDraft({ ...draft, pegado: e.target.checked })} /> Pegado</label>
              <label><input type="checkbox" checked={draft.copiante} onChange={(e) => setDraft({ ...draft, copiante: e.target.checked })} /> Copiante</label>
            </div>

            <div className="po-modal-row">
              <div className="po-modal-field">
                <span>Corte</span>
                <input value={draft.corte} onChange={(e) => setDraft({ ...draft, corte: e.target.value })} placeholder="Ej: 215x280 mm" />
              </div>
              <div className="po-modal-field">
                <span>Folio</span>
                <input value={draft.folio} onChange={(e) => setDraft({ ...draft, folio: e.target.value })} />
              </div>
              <div className="po-modal-field">
                <span>Paquetes D</span>
                <input type="number" value={draft.paquetesD} onChange={(e) => setDraft({ ...draft, paquetesD: e.target.value })} />
              </div>
            </div>

            <div className="po-modal-field">
              <span>Notas</span>
              <textarea rows="2" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </div>

            <div className="po-modal-actions">
              <button className="po-btn po-btn-primary" disabled={saving || !draft.projectId || !draft.machineId || !draft.trabajo} onClick={submitCreate}>
                {saving ? "Guardando..." : "Generar orden"}
              </button>
              <button className="po-btn" onClick={() => setShowCreate(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default PrintOrders;
