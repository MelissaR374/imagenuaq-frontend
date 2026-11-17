// The provider directory (RF-FIN-18): the catalog quotes, invoices and payments pick from.
// Anyone with finance.read sees it. Only finance.write corrects or removes a provider.
import { useEffect, useState } from "react";
import { MdAdd, MdEdit, MdDelete, MdSearch } from "react-icons/md";

import * as api from "../../api/client.js";
import { orDash } from "../shared/format.js";

import "./financeProviders.css";

const EMPTY = { name: "", rfc: "", contactName: "", email: "", phone: "", notes: "" };

/**
 * @param {{ canCreate: boolean, canManage: boolean }} props
 */
function FinanceProviders({ canCreate, canManage }) {
  const [providers, setProviders] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.listProviders({ limit: 200 })
      .then((data) => {
        if (!cancelled) setProviders(data.providers ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => { cancelled = true; };
  }, [version]);

  const list = providers ?? [];
  const term = search.toLowerCase().trim();
  const filtered = list.filter((p) =>
    [p.name, p.rfc, p.contactName, p.email].filter(Boolean).join(" ").toLowerCase().includes(term),
  );

  function setField(key, value) {
    setForm({ ...form, draft: { ...form.draft, [key]: value } });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body = Object.fromEntries(
        Object.entries(form.draft).map(([key, value]) => [key, value.trim() || null]),
      );
      if (form.id) await api.updateProvider(form.id, body);
      else await api.createProvider(body);
      setForm(null);
      setError(null);
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    setSaving(true);
    try {
      await api.deleteProvider(id);
      setConfirmDelete(null);
      setError(null);
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(p) {
    setForm({
      id: p.id,
      draft: {
        name: p.name ?? "",
        rfc: p.rfc ?? "",
        contactName: p.contactName ?? "",
        email: p.email ?? "",
        phone: p.phone ?? "",
        notes: p.notes ?? "",
      },
    });
  }

  return (
    <main className="finance-providers-page">
      <div className="finance-providers-toolbar">
        <div className="finance-providers-search">
          <MdSearch />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, RFC, contacto o correo..."
            aria-label="Buscar proveedores"
          />
        </div>
        {canCreate ? (
          <button type="button" className="finance-providers-add-btn" onClick={() => setForm({ id: null, draft: EMPTY })}>
            <MdAdd /> Nuevo proveedor
          </button>
        ) : null}
      </div>

      {error ? <p className="finance-providers-error" role="alert">{error}</p> : null}

      {form ? (
        <section className="finance-providers-form">
          <h2>{form.id ? "Editar proveedor" : "Nuevo proveedor"}</h2>
          <div className="finance-providers-fields">
            <label className="finance-providers-field">
              <span>Nombre o razón social *</span>
              <input value={form.draft.name} onChange={(e) => setField("name", e.target.value)} />
            </label>
            <label className="finance-providers-field">
              <span>RFC</span>
              <input value={form.draft.rfc} maxLength={13} onChange={(e) => setField("rfc", e.target.value)} />
            </label>
            <label className="finance-providers-field">
              <span>Contacto</span>
              <input value={form.draft.contactName} onChange={(e) => setField("contactName", e.target.value)} />
            </label>
            <label className="finance-providers-field">
              <span>Correo</span>
              <input type="email" value={form.draft.email} onChange={(e) => setField("email", e.target.value)} />
            </label>
            <label className="finance-providers-field">
              <span>Teléfono</span>
              <input type="tel" value={form.draft.phone} onChange={(e) => setField("phone", e.target.value)} />
            </label>
            <label className="finance-providers-field finance-providers-field-wide">
              <span>Notas</span>
              <textarea rows={2} value={form.draft.notes} onChange={(e) => setField("notes", e.target.value)} />
            </label>
          </div>
          <div className="finance-providers-form-actions">
            <button type="button" className="finance-providers-save-btn" disabled={saving || !form.draft.name.trim()} onClick={handleSave}>
              Guardar
            </button>
            <button type="button" className="finance-providers-cancel-btn" disabled={saving} onClick={() => setForm(null)}>
              Cancelar
            </button>
          </div>
        </section>
      ) : null}

      <section className="finance-providers-table-section">
        <div className="finance-providers-table-heading">
          <h2>Proveedores</h2>
          <span>{filtered.length} de {list.length}</span>
        </div>
        <div className="finance-providers-table-scroll">
          <table className="finance-providers-table">
            <thead>
              <tr>
                <th>NOMBRE</th>
                <th>RFC</th>
                <th>CONTACTO</th>
                <th>CORREO</th>
                <th>TELÉFONO</th>
                <th>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {providers === null && !error ? (
                <tr><td colSpan={6} className="finance-providers-empty">Cargando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="finance-providers-empty">No se encontraron proveedores.</td></tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id}>
                    <td className="finance-providers-name">{p.name}</td>
                    <td>{orDash(p.rfc)}</td>
                    <td>{orDash(p.contactName)}</td>
                    <td>{orDash(p.email)}</td>
                    <td>{orDash(p.phone)}</td>
                    <td className="finance-providers-actions">
                      {canManage ? (
                        confirmDelete === p.id ? (
                          <>
                            <button type="button" className="finance-providers-danger-btn" disabled={saving} onClick={() => handleDelete(p.id)}>
                              Eliminar
                            </button>
                            <button type="button" className="finance-providers-cancel-btn" disabled={saving} onClick={() => setConfirmDelete(null)}>
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="finance-providers-icon-btn" title="Editar" onClick={() => startEdit(p)}>
                              <MdEdit />
                            </button>
                            <button type="button" className="finance-providers-icon-btn danger" title="Eliminar" onClick={() => setConfirmDelete(p.id)}>
                              <MdDelete />
                            </button>
                          </>
                        )
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default FinanceProviders;
