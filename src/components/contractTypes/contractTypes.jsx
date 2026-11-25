// The contract types and what each one grants per absence type (RF-AUS-03, RF-AUS-04). A cap is never
// changed in place: saving closes the open one the day before and opens another.
import { useEffect, useState } from "react";
import {
  MdAdd,
  MdSearch,
  MdKeyboardArrowDown,
  MdKeyboardArrowUp,
  MdClose,
  MdSave,
  MdWorkOutline,
} from "react-icons/md";

import * as api from "../../api/client.js";
import { dayDate, isoDay } from "../shared/format.js";
import Help from "../shared/help.jsx";
import "./contractTypes.css";

const UNIT_LABELS = { day: "días", hour: "horas" };

/** The calendar day after a `YYYY-MM-DD`. */
function dayAfter(value) {
  const [year, month, day] = value.split("-").map(Number);
  return isoDay(new Date(year, month - 1, day + 1));
}

/** The cap of a type that applies today, or undefined. */
function capInForce(caps, typeId) {
  const today = isoDay();
  return caps.find(
    (cap) =>
      cap.absenceTypeId === typeId && cap.validFrom <= today && (cap.validTo === null || cap.validTo >= today),
  );
}

/** The cap of a type that has no end yet: the one in force, or one scheduled to start. */
function openCap(caps, typeId) {
  return caps.find((cap) => cap.absenceTypeId === typeId && cap.validTo === null);
}

/** What the editor shows for a type: the open cap, starting over from today or from when it is due. */
function rowOf(caps, typeId) {
  const today = isoDay();
  const open = openCap(caps, typeId);
  const inForce = capInForce(caps, typeId);
  let validFrom = today;
  if (open && open.validFrom > today) validFrom = open.validFrom;
  else if (!open && inForce) validFrom = dayAfter(inForce.validTo);
  return { amount: open ? String(open.amount) : "", validFrom };
}

/** The caps that apply today in one line. */
function summaryOf(caps, types) {
  const parts = types
    .map((type) => ({ type, cap: capInForce(caps, type.id) }))
    .filter(({ cap }) => cap !== undefined)
    .map(({ type, cap }) => `${type.label} ${cap.amount}`);
  return parts.length > 0 ? parts.join(" · ") : "Sin topes";
}

/** The cap in force and the one due later, in words. */
function standingOf(caps, typeId) {
  const open = openCap(caps, typeId);
  const inForce = capInForce(caps, typeId);
  const parts = [];
  if (inForce) {
    const until = inForce.validTo === null ? "" : ` hasta el ${dayDate(inForce.validTo)}`;
    parts.push(`Vigente: ${inForce.amount} desde el ${dayDate(inForce.validFrom)}${until}`);
  }
  if (open && open.validFrom > isoDay()) parts.push(`${open.amount} a partir del ${dayDate(open.validFrom)}`);
  return parts.length > 0 ? parts.join(". ") : "Sin tope";
}

/** Why a cap could not be saved, in Spanish for the two cases dates cause. */
function reasonOf(err) {
  if (err.status === 404) return "no hay un tope abierto en esa fecha.";
  if (err.status === 409) return "la fecha se cruza con otro tope.";
  return err.message;
}

function ContractTypes() {
  const [contracts, setContracts] = useState([]);
  const [caps, setCaps] = useState({});
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  const [openId, setOpenId] = useState(null);
  const [rows, setRows] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [newName, setNewName] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [contractData, typeData] = await Promise.all([api.listContractTypes(), api.listAbsenceTypes()]);
        const capData = await Promise.all(
          contractData.contractTypes.map((contract) => api.listEntitlements(contract.id)),
        );
        if (cancelled) return;
        setContracts(contractData.contractTypes);
        setTypes(typeData.types.filter((type) => type.isActive && type.consumesBalance));
        setCaps(
          Object.fromEntries(
            contractData.contractTypes.map((contract, index) => [contract.id, capData[index].entitlements]),
          ),
        );
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const shown = contracts.filter((contract) => contract.name.toLowerCase().includes(search.trim().toLowerCase()));

  function rowsOf(contractCaps) {
    return Object.fromEntries(types.map((type) => [type.id, rowOf(contractCaps, type.id)]));
  }

  function closeEditor() {
    setOpenId(null);
    setConfirmingDelete(false);
  }

  function toggleEditor(contract) {
    if (openId === contract.id) {
      closeEditor();
      return;
    }
    setOpenId(contract.id);
    setRows(rowsOf(caps[contract.id] ?? []));
    setConfirmingDelete(false);
    setMessage(null);
    setSaveError(null);
  }

  function changeRow(typeId, changes) {
    setRows((current) => ({ ...current, [typeId]: { ...current[typeId], ...changes } }));
    setMessage(null);
  }

  async function createContract(event) {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const { contractType } = await api.createContractType(newName.trim());
      setContracts((current) => [...current, contractType].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName(null);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function deleteContract(id) {
    setSaving(true);
    setSaveError(null);
    try {
      await api.deleteContractType(id);
      setContracts((current) => current.filter((contract) => contract.id !== id));
      closeEditor();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveCaps(event) {
    event.preventDefault();
    const contractCaps = caps[openId] ?? [];
    const changed = types.filter((type) => rows[type.id].amount !== rowOf(contractCaps, type.id).amount);
    if (changed.length === 0) {
      setMessage("No hay topes por guardar.");
      return;
    }

    setSaving(true);
    setMessage(null);
    setSaveError(null);
    const failures = [];
    const failed = {};
    for (const type of changed) {
      const { amount, validFrom } = rows[type.id];
      try {
        await api.createEntitlement(openId, {
          absenceTypeId: type.id,
          amount: amount === "" ? null : amount,
          validFrom,
        });
      } catch (err) {
        failures.push(`${type.label}: ${reasonOf(err)}`);
        failed[type.id] = rows[type.id];
      }
    }
    try {
      const { entitlements } = await api.listEntitlements(openId);
      setCaps((current) => ({ ...current, [openId]: entitlements }));
      setRows({ ...rowsOf(entitlements), ...failed });
    } catch (err) {
      failures.push(err.message);
    }
    if (failures.length > 0) setSaveError(failures.join(" "));
    else setMessage("Topes guardados.");
    setSaving(false);
  }

  return (
    <section className="contract-types">
      <div className="contract-types-toolbar">
        <div className="contract-types-summary">
          <span>
            {contracts.length} {contracts.length === 1 ? "tipo de contrato" : "tipos de contrato"}
          </span>
          <p>Selecciona un contrato para configurar cuánto otorga de cada tipo de ausencia.</p>
        </div>

        <button
          type="button"
          className="contract-types-new"
          onClick={() => {
            setCreateError(null);
            setNewName(newName === null ? "" : null);
          }}
        >
          <MdAdd />
          Nuevo tipo de contrato
        </button>
      </div>

      {newName !== null && (
        <form className="contract-types-create" onSubmit={createContract}>
          <label className="contract-types-create-field">
            <span>Nombre del tipo de contrato</span>
            <input
              type="text"
              maxLength={200}
              autoFocus
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
            />
          </label>
          <button type="submit" className="contract-types-new" disabled={creating || !newName.trim()}>
            <MdSave />
            {creating ? "Guardando..." : "Guardar"}
          </button>
          <button type="button" className="contract-types-cancel" onClick={() => setNewName(null)}>
            Cancelar
          </button>
          {createError !== null && (
            <p className="contract-types-error" role="alert">
              {createError}
            </p>
          )}
        </form>
      )}

      <div className="contract-types-search">
        <MdSearch />
        <input
          type="search"
          placeholder="Buscar tipo de contrato..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {error !== null && (
        <p className="contract-types-error" role="alert">
          {error}
        </p>
      )}

      {loading && <p className="contract-types-message">Cargando tipos de contrato...</p>}

      {!loading && error === null && (
        <div className="contract-types-table-wrapper">
          <table className="contract-types-table">
            <thead>
              <tr>
                <th>Tipo de contrato</th>
                <th>Topes vigentes</th>
                <th aria-label="Acciones"></th>
              </tr>
            </thead>

            <tbody>
              {shown.map((contract) => {
                const contractCaps = caps[contract.id] ?? [];
                const expanded = openId === contract.id;

                return (
                  <tr key={contract.id} className={expanded ? "contract-types-row-expanded" : ""}>
                    <td colSpan={3} className="contract-types-row-cell">
                      <button
                        type="button"
                        className="contract-types-row-button"
                        onClick={() => toggleEditor(contract)}
                        aria-expanded={expanded}
                      >
                        <span className="contract-types-name">
                          <MdWorkOutline />
                          <strong>{contract.name}</strong>
                        </span>
                        <span>{summaryOf(contractCaps, types)}</span>
                        <span className="contract-types-arrow">
                          {expanded ? <MdKeyboardArrowUp /> : <MdKeyboardArrowDown />}
                        </span>
                      </button>

                      {expanded && (
                        <form className="contract-types-editor" onSubmit={saveCaps}>
                          <div className="contract-types-editor-header">
                            <div>
                              <span className="contract-types-eyebrow">EDITANDO TIPO DE CONTRATO</span>
                              <h2>{contract.name}</h2>
                            </div>

                            <button
                              type="button"
                              className="contract-types-close"
                              onClick={closeEditor}
                              aria-label="Cerrar editor"
                            >
                              <MdClose />
                            </button>
                          </div>

                          <div className="contract-types-editor-body">
                            <h3>Topes por tipo de ausencia</h3>

                            {types.length === 0 && (
                              <p className="contract-types-message">Ningún tipo activo consume días de ausencia.</p>
                            )}

                            {types.map((type) => (
                              <div className="contract-types-cap" key={type.id}>
                                <div className="contract-types-cap-type">
                                  <strong>{type.label}</strong>
                                  <small>{standingOf(contractCaps, type.id)}</small>
                                </div>
                                <label className="contract-types-label" htmlFor={`cap-amount-${type.id}`}>
                                  Tope en {UNIT_LABELS[type.unit]}
                                  <Help text="Déjalo vacío si el contrato no otorga este tipo. Los días de ausencia ya otorgados no cambian: se ajustan por persona en Ausencias, pestaña Días de ausencia." />
                                  <input
                                    id={`cap-amount-${type.id}`}
                                    type="number"
                                    min="0"
                                    max="9999.99"
                                    step="0.01"
                                    className="contract-types-input"
                                    value={rows[type.id].amount}
                                    onChange={(event) => changeRow(type.id, { amount: event.target.value })}
                                    placeholder="Sin tope"
                                  />
                                </label>
                                <label className="contract-types-label" htmlFor={`cap-from-${type.id}`}>
                                  A partir del
                                  <Help text="El día en que empieza a valer el tope; puede ser una fecha futura. El anterior termina un día antes y se conserva. Con el tope vacío, es el día en que deja de valer." />
                                  <input
                                    id={`cap-from-${type.id}`}
                                    type="date"
                                    required
                                    className="contract-types-input contract-types-cap-date"
                                    value={rows[type.id].validFrom}
                                    onChange={(event) => changeRow(type.id, { validFrom: event.target.value })}
                                  />
                                </label>
                              </div>
                            ))}

                            {saveError !== null && (
                              <p className="contract-types-error" role="alert">
                                {saveError}
                              </p>
                            )}
                          </div>

                          <div className="contract-types-editor-footer">
                            <div className="contract-types-delete-area">
                              {!confirmingDelete ? (
                                <button
                                  type="button"
                                  className="contract-types-delete"
                                  onClick={() => setConfirmingDelete(true)}
                                >
                                  Eliminar tipo de contrato
                                </button>
                              ) : (
                                <div className="contract-types-delete-confirm">
                                  <span>¿Eliminar este contrato de la lista?</span>
                                  <button type="button" onClick={() => setConfirmingDelete(false)}>
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    className="contract-types-delete-confirm-button"
                                    disabled={saving}
                                    onClick={() => deleteContract(contract.id)}
                                  >
                                    Confirmar
                                  </button>
                                </div>
                              )}
                            </div>

                            <p className="contract-types-save-note" role="status">
                              {message}
                            </p>

                            <div className="contract-types-actions">
                              <button type="button" className="contract-types-cancel" onClick={closeEditor}>
                                Descartar
                              </button>
                              <button type="submit" className="contract-types-save" disabled={saving}>
                                <MdSave />
                                {saving ? "Guardando..." : "Guardar topes"}
                              </button>
                            </div>
                          </div>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {shown.length === 0 && <p className="contract-types-message">No se encontraron tipos de contrato.</p>}
        </div>
      )}
    </section>
  );
}

export default ContractTypes;
