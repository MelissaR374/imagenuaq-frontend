// One's own remaining days, per absence type and cycle (RF-AUS-15). The server creates them from the
// contract's caps.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import BalanceTable from "./balanceTable.jsx";

/** @param {{ userId: number, version: number }} props `version` changes when an absence does, which may move a balance. */
function Balances({ userId, version }) {
  const [balances, setBalances] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getBalances(userId)
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
  }, [userId, version]);

  return (
    <section className="absences-balances">
      <h3>Mis días de ausencia</h3>
      {error !== null ? <p className="absences-error">{error}</p> : null}
      {balances === null && error === null ? <p className="absences-loading">Cargando…</p> : null}
      {balances !== null ? <BalanceTable balances={balances} onAdjust={null} /> : null}
    </section>
  );
}

export default Balances;
