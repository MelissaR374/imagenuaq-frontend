// A person's balances, one row per absence type and cycle (RF-AUS-15).
import { orDash, shortDate } from "../shared/format.js";

/** @param {{ balances: object[], onAdjust: ((balance: object) => void) | null }} props */
function BalanceTable({ balances, onAdjust }) {
  if (balances.length === 0) {
    return <p className="absences-empty">El contrato no tiene días registrados para este año.</p>;
  }

  return (
    <table className="absences-table">
      <thead>
        <tr>
          <th>Tipo</th>
          <th>Ciclo</th>
          <th>Otorgados</th>
          <th>Usados</th>
          <th>Disponibles</th>
          <th>Nota</th>
          {onAdjust !== null ? <th aria-label="Acciones"></th> : null}
        </tr>
      </thead>
      <tbody>
        {balances.map((balance) => (
          <tr key={balance.id}>
            <td>{balance.absenceTypeLabel}</td>
            <td>
              {shortDate(balance.cycleStart)} a {shortDate(balance.cycleEnd)}
            </td>
            <td>{balance.granted}</td>
            <td>{balance.used}</td>
            <td>{balance.remaining < 0 ? `${balance.remaining} (excedido)` : balance.remaining}</td>
            <td>{orDash(balance.note)}</td>
            {onAdjust !== null ? (
              <td>
                <button
                  className="absences-btn absences-btn-small"
                  type="button"
                  onClick={() => onAdjust(balance)}
                >
                  Ajustar
                </button>
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default BalanceTable;
