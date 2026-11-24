// A person's remaining days, per absence type and cycle (RF-AUS-15): one's own, or anyone's for
// whoever sees the motive of absences (RF-AUS-13). The server creates them from the contract's caps.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import { shortDate } from "../shared/format.js";

/**
 * @param {{ userId: number, canDetail: boolean, version: number }} props `version` changes when an
 *   absence does, which may move a balance.
 */
function Balances({ userId, canDetail, version }) {
  const [people, setPeople] = useState([]);
  const [personId, setPersonId] = useState(String(userId));
  const [balances, setBalances] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!canDetail) return;
    let cancelled = false;
    api
      .listUsers({ limit: 200 })
      .then((page) => {
        if (!cancelled) setPeople(page.users);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [canDetail]);

  useEffect(() => {
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

  return (
    <section className="absences-balances">
      <header className="absences-balances-head">
        <h3>{personId === String(userId) ? "Mis saldos" : "Saldos"}</h3>
        {canDetail && people.length > 0 ? (
          <select aria-label="Persona" value={personId} onChange={(event) => setPersonId(event.target.value)}>
            {people.map((person) => (
              <option value={person.id} key={person.id}>
                {person.fullName}
              </option>
            ))}
          </select>
        ) : null}
      </header>

      {error !== null ? <p className="absences-error">{error}</p> : null}
      {balances === null && error === null ? <p className="absences-loading">Cargando…</p> : null}
      {balances !== null && balances.length === 0 ? (
        <p className="absences-empty">El contrato no tiene días registrados para este año.</p>
      ) : null}

      {balances !== null && balances.length > 0 ? (
        <table className="absences-table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Ciclo</th>
              <th>Otorgados</th>
              <th>Usados</th>
              <th>Disponibles</th>
            </tr>
          </thead>
          <tbody>
            {balances.map((balance) => (
              <tr key={balance.id}>
                <td>{balance.absenceTypeLabel}</td>
                <td>
                  {shortDate(`${balance.cycleStart}T12:00:00`)} a {shortDate(`${balance.cycleEnd}T12:00:00`)}
                </td>
                <td>{balance.granted}</td>
                <td>{balance.used}</td>
                <td>{balance.remaining < 0 ? `${balance.remaining} (excedido)` : balance.remaining}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}

export default Balances;
