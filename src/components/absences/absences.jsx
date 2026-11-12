// Absence list and management (RF-AUS-01, RF-AUS-14). Shows absences filtered by status, with
// inline approve/reject for leads and cancel for the requester. The motive column is visible
// only to roles with absence.read_detail — everyone else sees a dash (RF-AUS-13).
import { useEffect, useState } from "react";

import { MdAdd, MdSearch, MdDescription } from "react-icons/md";

import * as api from "../../api/client.js";
import { shortDate, orDash } from "../shared/format.js";

import "./absences.css";

const STATUS_LABELS = {
  requested: "Solicitada",
  approved: "Aprobada",
  rejected: "Rechazada",
  cancelled: "Cancelada",
  taken: "Gozada",
};

const STATUS_CLASS = {
  requested: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "neutral",
  taken: "info",
};

const FILTERS = [
  { id: "all", label: "Todas", status: null },
  { id: "requested", label: "Solicitadas", status: "requested" },
  { id: "approved", label: "Aprobadas", status: "approved" },
  { id: "rejected", label: "Rechazadas", status: "rejected" },
  { id: "cancelled", label: "Canceladas", status: "cancelled" },
];

const EMPTY_DRAFT = { userId: "", absenceTypeId: "", startsAt: "", endsAt: "", reason: "" };

/** @param {{ canDetail: boolean, canApprove: boolean, canWrite: boolean, canRequestOthers: boolean, userId: number }} props */
function Absences({ canDetail, canApprove, canWrite, canRequestOthers, userId }) {
  const [absences, setAbsences] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [actionForm, setActionForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);

  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [createError, setCreateError] = useState(null);
  const [createWarning, setCreateWarning] = useState(null);
  const [absenceTypes, setAbsenceTypes] = useState([]);
  const [users, setUsers] = useState([]);

  const [approveForm, setApproveForm] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const status = FILTERS.find((f) => f.id === activeFilter)?.status ?? null;
    const params = status ? { status } : {};
    api.listAbsences(params)
      .then((data) => { if (!cancelled) { setAbsences(data); setError(null); } })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [activeFilter, version]);

  useEffect(() => {
    if (!showCreate) return;
    let cancelled = false;
    const fetches = [api.listAbsenceTypes()];
    if (canRequestOthers) fetches.push(api.listUsers());
    Promise.all(fetches)
      .then(([typesRes, usersRes]) => {
        if (cancelled) return;
        setAbsenceTypes((typesRes.types ?? []).filter((t) => t.isActive));
        if (usersRes) setUsers(usersRes.users ?? usersRes ?? []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [showCreate, canRequestOthers]);

  const loading = absences === null && error === null;
  const list = Array.isArray(absences) ? absences : [];

  const filtered = list.filter((a) => {
    if (!search.trim()) return true;
    const hay = [a.userName, a.typeLabel, a.reason, a.typeCode]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(search.toLowerCase().trim());
  });

  function filterCount(id) {
    if (id === "all") return list.length;
    return list.filter((a) => a.status === id).length;
  }

  function openCreate() {
    setDraft({ ...EMPTY_DRAFT, userId: String(userId) });
    setCreateError(null);
    setCreateWarning(null);
    setShowCreate(true);
  }

  async function submitCreate() {
    setSaving(true);
    setCreateError(null);
    setCreateWarning(null);
    try {
      const payload = {
        userId: Number(draft.userId),
        absenceTypeId: Number(draft.absenceTypeId),
        startsAt: `${draft.startsAt}T00:00:00`,
        endsAt: `${draft.endsAt}T23:59:59`,
        reason: draft.reason,
      };
      const res = await api.createAbsence(payload);
      if (res.warning) setCreateWarning(res.warning);
      setShowCreate(false);
      setDraft(EMPTY_DRAFT);
      setVersion((v) => v + 1);
    } catch (e) {
      setCreateError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function doAction(eventId, status, note) {
    setSaving(true);
    setError(null);
    try {
      await api.setAbsenceStatus(eventId, { status, note: note || undefined });
      setActionForm(null);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function doDelete(eventId) {
    setSaving(true);
    setError(null);
    try {
      await api.deleteAbsence(eventId);
      setActionForm(null);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitApprove() {
    if (!approveForm) return;
    setSaving(true);
    setError(null);
    try {
      let documentFileId;
      if (approveForm.file) {
        const { file: uploaded } = await api.uploadAbsenceDocument(approveForm.eventId, approveForm.file);
        documentFileId = uploaded.id;
      }
      await api.setAbsenceStatus(approveForm.eventId, {
        status: "approved",
        documentFileId: documentFileId || undefined,
      });
      setApproveForm(null);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function downloadDoc(fileId) {
    try {
      const blob = await api.downloadFile(fileId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    }
  }

  const canSubmit = draft.userId && draft.absenceTypeId && draft.startsAt && draft.endsAt && draft.reason.trim();

  return (
    <section className="absences">
      <header className="absences-header">
        {canWrite && (
          <button className="absences-btn absences-btn-primary" type="button" onClick={openCreate}>
            <MdAdd /> Nueva ausencia
          </button>
        )}
        <div className="absences-search">
          <MdSearch />
          <input
            type="text"
            placeholder="Buscar por nombre, tipo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>

      <nav className="absences-filters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={`filter-chip ${activeFilter === f.id ? "active" : ""}`}
            type="button"
            onClick={() => setActiveFilter(f.id)}
          >
            {f.label}
            <span className="filter-count">{filterCount(f.id)}</span>
          </button>
        ))}
      </nav>

      {error && <p className="absences-error">{error}</p>}
      {loading && <p className="absences-loading">Cargando…</p>}

      {filtered.length > 0 && (
        <table className="absences-table">
          <thead>
            <tr>
              <th>Persona</th>
              <th>Tipo</th>
              <th>Desde</th>
              <th>Hasta</th>
              {canDetail && <th>Motivo</th>}
              <th>Oficio</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.eventId}>
                <td>{orDash(a.userName)}</td>
                <td>{orDash(a.typeLabel)}</td>
                <td>{shortDate(a.startsAt)}</td>
                <td>{shortDate(a.endsAt)}</td>
                {canDetail && <td className="absences-reason">{orDash(a.reason)}</td>}
                <td className="absences-doc-cell">
                  {a.documentFileId ? (
                    <button
                      className="absences-btn absences-btn-small"
                      type="button"
                      onClick={() => downloadDoc(a.documentFileId)}
                      title="Descargar oficio"
                    >
                      <MdDescription /> Ver
                    </button>
                  ) : (
                    <span className="absences-no-doc">—</span>
                  )}
                </td>
                <td>
                  <span className={`status-pill ${STATUS_CLASS[a.status] ?? ""}`}>
                    {STATUS_LABELS[a.status] ?? a.status}
                  </span>
                </td>
                <td>
                  <div className="absences-actions-cell">
                  {a.status === "requested" && canApprove && (
                    <>
                      <button
                        className="absences-btn absences-btn-small absences-btn-primary"
                        type="button"
                        disabled={saving}
                        onClick={() => setApproveForm({ eventId: a.eventId, file: null, confirmNoDoc: false })}
                      >
                        Aprobar
                      </button>
                      <button
                        className="absences-btn absences-btn-small absences-btn-danger"
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          setActionForm({ eventId: a.eventId, action: "rejected", note: "" });
                        }}
                      >
                        Rechazar
                      </button>
                    </>
                  )}
                  {a.status === "requested" && a.userId === userId && (
                    <button
                      className="absences-btn absences-btn-small"
                      type="button"
                      disabled={saving}
                      onClick={() => doDelete(a.eventId)}
                    >
                      Cancelar
                    </button>
                  )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && filtered.length === 0 && (
        <p className="absences-empty">No hay ausencias que mostrar.</p>
      )}

      {approveForm && (
        <div className="absences-modal-backdrop" onClick={() => setApproveForm(null)}>
          <div className="absences-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Aprobar ausencia</h3>

            <label className="absences-modal-field">
              <span>Oficio aprovado</span>
              <input
                type="file"
                onChange={(e) => setApproveForm({ ...approveForm, file: e.target.files[0] || null, confirmNoDoc: false })}
              />
            </label>

            {!approveForm.file && !approveForm.confirmNoDoc && (
              <p className="absences-warning">
                No se ha adjuntado oficio. Si apruebas la ausencia no habrá registro de documento oficial. Para continuar, haz clic en "Aprobar sin oficio".
              </p>
            )}

            <div className="absences-modal-actions">
              {approveForm.file || approveForm.confirmNoDoc ? (
                <button
                  className="absences-btn absences-btn-primary"
                  type="button"
                  disabled={saving}
                  onClick={submitApprove}
                >
                  Aprobar
                </button>
              ) : (
                <button
                  className="absences-btn absences-btn-primary"
                  type="button"
                  disabled={saving}
                  onClick={() => setApproveForm({ ...approveForm, confirmNoDoc: true })}
                >
                  Aprobar sin oficio
                </button>
              )}
              <button className="absences-btn" type="button" disabled={saving} onClick={() => setApproveForm(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {actionForm && (
        <div className="absences-modal-backdrop" onClick={() => setActionForm(null)}>
          <div className="absences-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Rechazar ausencia</h3>
            <label className="absences-modal-field">
              <span>Motivo del rechazo</span>
              <textarea
                value={actionForm.note}
                rows={3}
                onChange={(e) => setActionForm({ ...actionForm, note: e.target.value })}
              />
            </label>
            <div className="absences-modal-actions">
              <button
                className="absences-btn absences-btn-danger"
                type="button"
                disabled={saving}
                onClick={() => doAction(actionForm.eventId, "rejected", actionForm.note)}
              >
                Rechazar
              </button>
              <button className="absences-btn" type="button" disabled={saving} onClick={() => setActionForm(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="absences-modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="absences-modal absences-modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>Nueva ausencia</h3>

            {createError && <p className="absences-error">{createError}</p>}

            {canRequestOthers && (
              <label className="absences-modal-field">
                <span>Persona</span>
                <select
                  value={draft.userId}
                  onChange={(e) => setDraft({ ...draft, userId: e.target.value })}
                >
                  <option value="">Selecciona una persona</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.fullName ?? u.full_name}</option>
                  ))}
                </select>
              </label>
            )}

            <label className="absences-modal-field">
              <span>Tipo de ausencia</span>
              <select
                value={draft.absenceTypeId}
                onChange={(e) => setDraft({ ...draft, absenceTypeId: e.target.value })}
              >
                <option value="">Selecciona un tipo</option>
                {absenceTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </label>

            <div className="absences-modal-row">
              <label className="absences-modal-field">
                <span>Desde</span>
                <input
                  type="date"
                  value={draft.startsAt}
                  onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })}
                />
              </label>
              <label className="absences-modal-field">
                <span>Hasta</span>
                <input
                  type="date"
                  value={draft.endsAt}
                  onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })}
                />
              </label>
            </div>

            <label className="absences-modal-field">
              <span>Motivo</span>
              <textarea
                value={draft.reason}
                rows={3}
                onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
              />
            </label>

            {createWarning && <p className="absences-warning">{createWarning}</p>}

            <div className="absences-modal-actions">
              <button
                className="absences-btn absences-btn-primary"
                type="button"
                disabled={saving || !canSubmit}
                onClick={submitCreate}
              >
                Solicitar
              </button>
              <button className="absences-btn" type="button" disabled={saving} onClick={() => setShowCreate(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default Absences;
