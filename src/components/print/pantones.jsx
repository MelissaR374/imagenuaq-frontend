// Pantone and machine catalog management (RF-IMP-02, RF-IMP-06). Two sub-tabs let the
// user with print.manage switch between the institutional color catalog and the press list.
import { useEffect, useState } from "react";

import { MdAdd, MdSearch, MdEdit, MdDelete } from "react-icons/md";

import * as api from "../../api/client.js";
import { orDash } from "../shared/format.js";

import "./pantones.css";

const EMPTY_PANTONE = { entityName: "", pantoneCode: "", hexValue: "" };
const EMPTY_MACHINE = { name: "" };

function PantoneTable({ search }) {
  const [pantones, setPantones] = useState(null);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(EMPTY_PANTONE);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.listPantones()
      .then((data) => { if (!cancelled) { setPantones(data.pantones ?? []); setError(null); } })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [version]);

  function openCreate() {
    setEditingId(null);
    setDraft(EMPTY_PANTONE);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(p) {
    setEditingId(p.id);
    setDraft({ entityName: p.entityName, pantoneCode: p.pantoneCode, hexValue: p.hexValue ?? "" });
    setFormError(null);
    setShowForm(true);
  }

  async function submitForm() {
    setSaving(true);
    setFormError(null);
    try {
      const body = {
        entityName: draft.entityName,
        pantoneCode: draft.pantoneCode,
        hexValue: draft.hexValue || null,
      };
      if (editingId) {
        await api.updatePantone(editingId, body);
      } else {
        await api.createPantone(body);
      }
      setShowForm(false);
      setVersion((v) => v + 1);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await api.deletePantone(id);
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  const filtered = (pantones ?? []).filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.entityName.toLowerCase().includes(q) || p.pantoneCode.toLowerCase().includes(q);
  });

  return (
    <>
      <div className="pantones-toolbar">
        <button className="ptn-btn ptn-btn-primary" onClick={openCreate}>
          <MdAdd /> Agregar pantone
        </button>
      </div>

      {error ? <p className="pantones-error">{error}</p> : null}
      {pantones === null ? <p className="pantones-loading">Cargando...</p> : null}
      {pantones && filtered.length === 0 ? <p className="pantones-empty">Sin pantones registrados.</p> : null}

      {filtered.length > 0 ? (
        <table className="pantones-table">
          <thead>
            <tr>
              <th>Entidad</th>
              <th>Pantone</th>
              <th>Color</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td>{p.entityName}</td>
                <td>{p.pantoneCode}</td>
                <td>
                  {p.hexValue ? (
                    <span className="ptn-swatch" style={{ background: p.hexValue }} title={p.hexValue} />
                  ) : (
                    orDash(null)
                  )}
                </td>
                <td className="ptn-actions-cell">
                  <button className="ptn-btn ptn-btn-small" onClick={() => openEdit(p)}><MdEdit /></button>
                  <button className="ptn-btn ptn-btn-small ptn-btn-danger" onClick={() => handleDelete(p.id)}><MdDelete /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {showForm ? (
        <div className="ptn-modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="ptn-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingId ? "Editar pantone" : "Nuevo pantone"}</h3>
            {formError ? <p className="pantones-error">{formError}</p> : null}

            <div className="ptn-modal-field">
              <span>Entidad</span>
              <input value={draft.entityName} onChange={(e) => setDraft({ ...draft, entityName: e.target.value })} />
            </div>
            <div className="ptn-modal-field">
              <span>Codigo Pantone</span>
              <input value={draft.pantoneCode} onChange={(e) => setDraft({ ...draft, pantoneCode: e.target.value })} />
            </div>
            <div className="ptn-modal-field">
              <span>Color hex (opcional)</span>
              <div className="ptn-color-row">
                <input value={draft.hexValue} onChange={(e) => setDraft({ ...draft, hexValue: e.target.value })} placeholder="#RRGGBB" />
                {draft.hexValue ? <span className="ptn-swatch" style={{ background: draft.hexValue }} /> : null}
              </div>
            </div>

            <div className="ptn-modal-actions">
              <button className="ptn-btn ptn-btn-primary" disabled={saving || !draft.entityName || !draft.pantoneCode} onClick={submitForm}>
                {saving ? "Guardando..." : editingId ? "Guardar" : "Crear"}
              </button>
              <button className="ptn-btn" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function MachineTable({ search }) {
  const [machines, setMachines] = useState(null);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(EMPTY_MACHINE);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.listPrintMachines()
      .then((data) => { if (!cancelled) { setMachines(data.machines ?? []); setError(null); } })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [version]);

  function openCreate() {
    setEditingId(null);
    setDraft(EMPTY_MACHINE);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(m) {
    setEditingId(m.id);
    setDraft({ name: m.name });
    setFormError(null);
    setShowForm(true);
  }

  async function submitForm() {
    setSaving(true);
    setFormError(null);
    try {
      if (editingId) {
        await api.updatePrintMachine(editingId, { name: draft.name });
      } else {
        await api.createPrintMachine({ name: draft.name });
      }
      setShowForm(false);
      setVersion((v) => v + 1);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(m) {
    try {
      await api.updatePrintMachine(m.id, { isActive: !m.isActive });
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  const filtered = (machines ?? []).filter((m) => {
    if (!search) return true;
    return m.name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <>
      <div className="pantones-toolbar">
        <button className="ptn-btn ptn-btn-primary" onClick={openCreate}>
          <MdAdd /> Agregar maquina
        </button>
      </div>

      {error ? <p className="pantones-error">{error}</p> : null}
      {machines === null ? <p className="pantones-loading">Cargando...</p> : null}
      {machines && filtered.length === 0 ? <p className="pantones-empty">Sin maquinas registradas.</p> : null}

      {filtered.length > 0 ? (
        <table className="pantones-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>
                  <span className={`ptn-status-pill ${m.isActive ? "ptn-status-active" : "ptn-status-inactive"}`}>
                    {m.isActive ? "Activa" : "Inactiva"}
                  </span>
                </td>
                <td className="ptn-actions-cell">
                  <button className="ptn-btn ptn-btn-small" onClick={() => openEdit(m)}><MdEdit /></button>
                  <button className="ptn-btn ptn-btn-small" onClick={() => toggleActive(m)}>
                    {m.isActive ? "Desactivar" : "Activar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {showForm ? (
        <div className="ptn-modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="ptn-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingId ? "Editar maquina" : "Nueva maquina"}</h3>
            {formError ? <p className="pantones-error">{formError}</p> : null}

            <div className="ptn-modal-field">
              <span>Nombre</span>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>

            <div className="ptn-modal-actions">
              <button className="ptn-btn ptn-btn-primary" disabled={saving || !draft.name} onClick={submitForm}>
                {saving ? "Guardando..." : editingId ? "Guardar" : "Crear"}
              </button>
              <button className="ptn-btn" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Pantones() {
  const [tab, setTab] = useState("pantones");
  const [search, setSearch] = useState("");

  return (
    <section className="pantones">
      <div className="pantones-header">
        <div className="pantones-tabs">
          <button className={`ptn-tab ${tab === "pantones" ? "ptn-tab-active" : ""}`} onClick={() => { setTab("pantones"); setSearch(""); }}>
            Pantones
          </button>
          <button className={`ptn-tab ${tab === "machines" ? "ptn-tab-active" : ""}`} onClick={() => { setTab("machines"); setSearch(""); }}>
            Maquinas
          </button>
        </div>
        <div className="pantones-search">
          <MdSearch />
          <input
            placeholder={tab === "pantones" ? "Buscar por entidad o codigo..." : "Buscar maquina..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {tab === "pantones" ? <PantoneTable search={search} /> : <MachineTable search={search} />}
    </section>
  );
}

export default Pantones;
