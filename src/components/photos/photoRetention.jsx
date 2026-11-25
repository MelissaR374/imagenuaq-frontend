// «Conservación de fotos»: how many days a client can download their photos once they are ready.
// Each new group copies it and can change its own. Groups already created keep theirs. A daily job
// deletes the photos past their deadline, so this is also how long they take up space.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import { shortDate } from "../shared/format.js";
import "./photos.css";

function PhotoRetention() {
  const [saved, setSaved] = useState(null);
  const [days, setDays] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getPhotoRetention()
      .then((data) => {
        if (cancelled) return;
        setSaved(data.retention);
        setDays(String(data.retention.days));
      })
      .catch((failure) => {
        if (!cancelled) setError(failure.message);
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
      const data = await api.setPhotoRetention(Number(days));
      setSaved(data.retention);
      setDone(true);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  if (saved === null) return <p className="photos-note">{error ?? "Cargando…"}</p>;

  return (
    <div className="photos">
      <form className="photos-form photos-card" onSubmit={save}>
        <label className="photos-field">
          <span>Días que se pueden descargar las fotos</span>
          <input
            type="number"
            min={1}
            step={1}
            value={days}
            onChange={(event) => {
              setDays(event.target.value);
              setDone(false);
            }}
            required
          />
        </label>
        <p className="photos-note">
          Cuentan desde que las fotos de un folio se marcan como listas. Al vencer se borran. Lo toma cada grupo nuevo; un grupo ya
          creado conserva el suyo y se cambia desde su configuración.
        </p>
        {error !== null ? <p className="photos-error">{error}</p> : null}
        {done ? <p className="photos-note">Guardado.</p> : null}
        <div className="photos-actions">
          <button className="photos-btn" type="submit" disabled={busy || days === String(saved.days)}>
            Guardar
          </button>
          <span className="photos-note">Último cambio: {shortDate(saved.updatedAt)}</span>
        </div>
      </form>
    </div>
  );
}

export default PhotoRetention;
