// Anyone's balances, for whoever sees the motive of absences (RF-AUS-13). Coordination grants one
// person more or less than the contract's cap here, such as seniority days (RF-AUS-05).
import { useEffect, useState } from "react";

import { MdAdd } from "react-icons/md";

import * as api from "../../api/client.js";
import Help from "../shared/help.jsx";
import BalanceTable from "./balanceTable.jsx";

/** @param {{ canAdjust: boolean }} props */
function PersonBalances({ canAdjust }) {
  const [people, setPeople] = useState([]);
  const [types, setTypes] = useState([]);
  const [personId, setPersonId] = useState("");
  const [balances, setBalances] = useState(null);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);

  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.listUsers({ limit: 200 }), api.listAbsenceTypes()])
      .then(([userData, typeData]) => {
        if (cancelled) return;
        setPeople(userData.users);
        setTypes(typeData.types.filter((type) => type.isActive && type.consumesBalance));
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (personId === "") return;
    let cancelled = false;
    api
      .getBalances(personId)
      .then((data) => {
        if (cancelled) return;
        setBalances(data.balances);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [personId, version]);

  const cycleStart = `${new Date().getFullYear()}-01-01`;
  const missing = types.filter(
    (type) =>
      !(balances ?? []).some((row) => row.absenceTypeId === type.id && row.cycleStart === cycleStart),
  );

  function choosePerson(id) {
    setPersonId(id);
    setBalances(null);
    setError(null);
  }

  function openAdjust(balance) {
    setSaveError(null);
    setDraft({
      isNew: false,
      absenceTypeId: String(balance.absenceTypeId),
      label: balance.absenceTypeLabel,
      cycleStart: balance.cycleStart,
      granted: String(balance.granted),
      note: balance.note ?? "",
    });
  }

  function openGrant() {
    setSaveError(null);
    setDraft({ isNew: true, absenceTypeId: "", label: "", cycleStart, granted: "", note: "" });
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await api.setBalance(personId, {
        absenceTypeId: Number(draft.absenceTypeId),
        cycleStart: draft.cycleStart,
        granted: draft.granted,
        note: draft.note,
      });
      setDraft(null);
      setVersion((current) => current + 1);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="absences-balances">
      <header className="absences-balances-head">
        <label className="absences-modal-field">
          <span>Persona</span>
          <select value={personId} onChange={(event) => choosePerson(event.target.value)}>
            <option value="">Selecciona una persona</option>
            {people.map((person) => (
              <option value={person.id} key={person.id}>
                {person.fullName}
              </option>
            ))}
          </select>
        </label>
        {canAdjust && balances !== null && missing.length > 0 ? (
          <button className="absences-btn absences-btn-primary" type="button" onClick={openGrant}>
            <MdAdd /> Otorgar días
          </button>
        ) : null}
      </header>

      {error !== null ? <p className="absences-error">{error}</p> : null}
      {personId === "" ? <p className="absences-empty">Elige a una persona para ver sus días de ausencia.</p> : null}
      {personId !== "" && balances === null && error === null ? (
        <p className="absences-loading">Cargando…</p>
      ) : null}
      {balances !== null ? <BalanceTable balances={balances} onAdjust={canAdjust ? openAdjust : null} /> : null}

      {draft !== null ? (
        <div className="absences-modal-backdrop" onClick={() => setDraft(null)}>
          <form
            className="absences-modal"
            role="dialog"
            aria-label={draft.isNew ? "Otorgar días" : "Ajustar días de ausencia"}
            onClick={(event) => event.stopPropagation()}
            onSubmit={save}
          >
            <h3>
              {draft.isNew ? "Otorgar días" : `Ajustar ${draft.label}`}, {draft.cycleStart.slice(0, 4)}
            </h3>

            {draft.isNew ? (
              <label className="absences-modal-field" htmlFor="balance-type">
                <span>
                  Tipo de ausencia
                  <Help text="Los tipos que consumen días de ausencia y que esta persona aún no tiene este año." />
                </span>
                <select
                  id="balance-type"
                  required
                  value={draft.absenceTypeId}
                  onChange={(event) => setDraft({ ...draft, absenceTypeId: event.target.value })}
                >
                  <option value="">Selecciona un tipo</option>
                  {missing.map((type) => (
                    <option value={type.id} key={type.id}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="absences-modal-field" htmlFor="balance-granted">
              <span>
                Otorgados
                <Help text="El total del año para esta persona, en lugar del tope de su contrato. Lo ya usado se conserva." />
              </span>
              <input
                id="balance-granted"
                type="number"
                min="0"
                max="9999.99"
                step="0.01"
                required
                value={draft.granted}
                onChange={(event) => setDraft({ ...draft, granted: event.target.value })}
              />
            </label>

            <label className="absences-modal-field" htmlFor="balance-note">
              <span>
                Nota
                <Help text="Por qué recibe una cantidad distinta a la de su contrato, como días por antigüedad. La persona también la ve." />
              </span>
              <textarea
                id="balance-note"
                rows={3}
                maxLength={4000}
                value={draft.note}
                onChange={(event) => setDraft({ ...draft, note: event.target.value })}
              />
            </label>

            {saveError !== null ? (
              <p className="absences-error" role="alert">
                {saveError}
              </p>
            ) : null}

            <div className="absences-modal-actions">
              <button className="absences-btn absences-btn-primary" type="submit" disabled={saving}>
                Guardar
              </button>
              <button className="absences-btn" type="button" disabled={saving} onClick={() => setDraft(null)}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}

export default PersonBalances;
