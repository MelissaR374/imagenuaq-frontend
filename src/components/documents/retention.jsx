// How long files live, set by coordination without a deploy. A file in a project's folder counts
// from the project's close or archive, so an open project never loses one; a file outside any
// project counts from its upload. A daily sweep removes what is past it and the log keeps the record.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import { shortDate } from "../shared/format.js";
import "./retention.css";

function Retention() {
  const [saved, setSaved] = useState(null);
  const [months, setMonths] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getRetention()
      .then((data) => {
        if (cancelled) return;
        setSaved(data.retention);
        setMonths(String(data.retention.months));
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const data = await api.setRetention(Number(months));
      setSaved(data.retention);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (saved === null) {
    return error === null ? <p className="retention-note">Cargando…</p> : <p className="retention-error">{error}</p>;
  }

  return (
    <form className="retention" onSubmit={save}>
      <label className="retention-field">
        <span>Meses que se conservan los archivos</span>
        <input
          type="number"
          min={1}
          step={1}
          value={months}
          onChange={(event) => {
            setMonths(event.target.value);
            setDone(false);
          }}
          required
        />
      </label>

      <p className="retention-note">
        En la carpeta de un proyecto se cuentan desde que el proyecto se concluye o se archiva; un
        proyecto abierto nunca pierde archivos. Fuera de un proyecto, desde que se subieron. Al
        vencer se eliminan y queda el registro en la bitácora.
      </p>

      {error !== null ? <p className="retention-error">{error}</p> : null}
      {done ? <p className="retention-done">Guardado.</p> : null}

      <div className="retention-actions">
        <button className="retention-btn" type="submit" disabled={busy || months === String(saved.months)}>
          Guardar
        </button>
        <span className="retention-note">Último cambio: {shortDate(saved.updatedAt)}</span>
      </div>
    </form>
  );
}

export default Retention;
