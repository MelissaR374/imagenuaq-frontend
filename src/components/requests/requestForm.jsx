// Capturing a request by hand (RF-SOL-08): what arrives by mail is written down here, so every
// piece of work enters through one channel. It opens as the inbox's first row, in the place the
// new request is going to occupy.
//
// The format comes first because it decides the rest of the form: the fields are drawn from the
// chosen format, so this screen knows nothing about them. The server converts the values by each
// field's type, so "1,000" and "15/03/2026" arrive right without anything here touching them.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import FieldInput from "../shared/fieldInput.jsx";
import Help from "../shared/help.jsx";
import RequesterInput from "./requesterInput.jsx";
import "./requestForm.css";

const SOURCES = [
  { value: "manual", label: "Captura directa" },
  { value: "email", label: "Correo" },
  { value: "form", label: "Formulario" },
];

function RequestForm({ areas, onCreada, onCancelar }) {
  const [formats, setFormatos] = useState([]);
  const [formatId, setFormatoId] = useState("");
  const [header, setCabecera] = useState({
    title: "",
    requester: "",
    areaId: "",
    priority: 0,
    source: "manual",
  });
  const [values, setValores] = useState({});
  const [error, setError] = useState(null);
  const [saving, setGuardando] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { schemas } = await api.listSchemas();
        if (cancelled) return;
        setFormatos(schemas.filter((format) => format.isActive && format.fields !== null));
      } catch (failure) {
        if (!cancelled) setError(failure.message);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const format = formats.find((one) => String(one.id) === String(formatId)) ?? null;
  const fields = format
    ? [...format.fields.deliverables, ...format.fields.information]
    : [];

  async function save(event) {
    event.preventDefault();
    setGuardando(true);
    setError(null);

    try {
      const { request } = await api.createRequest({
        schemaId: Number(formatId),
        title: header.title,
        requester: header.requester || undefined,
        areaId: header.areaId === "" ? undefined : Number(header.areaId),
        priority: Number(header.priority),
        source: header.source,
        data: values,
      });
      onCreada(request);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form className="request-form" onSubmit={save}>
      <header className="request-form-head">
        <span className="request-form-eyebrow">Nueva solicitud</span>
        <button
          className="request-form-close"
          type="button"
          onClick={onCancelar}
          aria-label="Cerrar la captura"
        >
          ✕
        </button>
      </header>

      <div className="request-form-grid">
        <label className="request-form-field">
          <span className="request-form-label">
            Formato
            <Help text="Decide qué campos pide esta solicitud. Se captura con la versión publicada hoy y se seguirá leyendo con ella." />
          </span>
          <select
            value={formatId}
            onChange={(event) => {
              setFormatoId(event.target.value);
              setValores({});
            }}
            required
          >
            <option value="">Elige un formato</option>
            {formats.map((one) => (
              <option value={one.id} key={one.id}>
                {one.name} (v{one.version})
              </option>
            ))}
          </select>
        </label>

        <label className="request-form-field">
          <span className="request-form-label">Título</span>
          <input
            value={header.title}
            onChange={(event) => setCabecera({ ...header, title: event.target.value })}
            placeholder="Ej: Papelería institucional de la facultad"
            required
          />
        </label>

        <div className="request-form-field">
          <span className="request-form-label">Entidad solicitante</span>
          <RequesterInput
            id="solicitante-nuevo"
            value={header.requester}
            onChange={(requester) => setCabecera({ ...header, requester })}
          />
        </div>

        <label className="request-form-field">
          <span className="request-form-label">
            Área asignada
            <Help text="El área que atiende la solicitud mientras no tiene flujo. Con flujo, la reciben las áreas de su primera fase." />
          </span>
          <select
            value={header.areaId}
            onChange={(event) => setCabecera({ ...header, areaId: event.target.value })}
          >
            <option value="">Sin asignar</option>
            {areas.map((area) => (
              <option value={area.id} key={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </label>

        <label className="request-form-field">
          <span className="request-form-label">
            Urgencia
            <Help text="Un número: mayor es más urgente. La imprenta y la producción priorizan por urgencia, nunca por orden de llegada (RF-FLW-08)." />
          </span>
          <input
            type="number"
            value={header.priority}
            onChange={(event) => setCabecera({ ...header, priority: event.target.value })}
          />
        </label>

        <label className="request-form-field">
          <span className="request-form-label">Cómo llegó</span>
          <select
            value={header.source}
            onChange={(event) => setCabecera({ ...header, source: event.target.value })}
          >
            {SOURCES.map((source) => (
              <option value={source.value} key={source.value}>
                {source.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {format ? (
        <section className="request-form-sec">
          <h3>Lo que pide {format.name}</h3>
          <div className="request-form-grid">
            {fields.map((field) => (
              <FieldInput
                key={field.code}
                field={field}
                value={values[field.code]}
                onChange={(value) => setValores({ ...values, [field.code]: value })}
              />
            ))}
          </div>
        </section>
      ) : null}

      {error !== null ? <p className="request-form-error">{error}</p> : null}

      <footer className="request-form-foot">
        <button className="request-form-btn" type="button" onClick={onCancelar}>
          Cancelar
        </button>
        <button
          className="request-form-btn is-primary"
          type="submit"
          disabled={saving || format === null}
        >
          {saving ? "Registrando…" : "Registrar solicitud"}
        </button>
      </footer>
    </form>
  );
}

export default RequestForm;
