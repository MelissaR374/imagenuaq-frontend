// Captura directa de una solicitud (RF-SOL-08): lo que llega por correo se registra aquí, para
// que todo el trabajo entre por un solo canal. Se abre como el primer renglón de la bandeja, en
// el lugar que va a ocupar la solicitud nueva.
//
// El formato va primero porque es lo que decide el resto del formulario: los campos se dibujan
// del formato elegido, así que la pantalla no sabe nada de ellos. La conversión de valores la
// hace el servidor según el tipo de cada campo, de modo que "1,000" y "15/03/2026" llegan bien
// sin tocar nada aquí.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import FieldInput from "../shared/fieldInput.jsx";
import Ayuda from "../shared/ayuda.jsx";
import RequesterInput from "./requesterInput.jsx";
import "./requestForm.css";

const ORIGENES = [
  { value: "manual", label: "Captura directa" },
  { value: "email", label: "Correo" },
  { value: "form", label: "Formulario" },
];

function RequestForm({ areas, onCreada, onCancelar }) {
  const [formatos, setFormatos] = useState([]);
  const [formatoId, setFormatoId] = useState("");
  const [cabecera, setCabecera] = useState({
    title: "",
    requester: "",
    areaId: "",
    priority: 0,
    source: "manual",
  });
  const [valores, setValores] = useState({});
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      try {
        const { schemas } = await api.listSchemas();
        if (cancelado) return;
        setFormatos(schemas.filter((formato) => formato.isActive && formato.fields !== null));
      } catch (fallo) {
        if (!cancelado) setError(fallo.message);
      }
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, []);

  const formato = formatos.find((uno) => String(uno.id) === String(formatoId)) ?? null;
  const campos = formato
    ? [...formato.fields.deliverables, ...formato.fields.information]
    : [];

  async function guardar(evento) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);

    try {
      const { request } = await api.createRequest({
        schemaId: Number(formatoId),
        title: cabecera.title,
        requester: cabecera.requester || undefined,
        areaId: cabecera.areaId === "" ? undefined : Number(cabecera.areaId),
        priority: Number(cabecera.priority),
        source: cabecera.source,
        data: valores,
      });
      onCreada(request);
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form className="request-form" onSubmit={guardar}>
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
            <Ayuda texto="Decide qué campos pide esta solicitud. Se captura con la versión publicada hoy y se seguirá leyendo con ella." />
          </span>
          <select
            value={formatoId}
            onChange={(evento) => {
              setFormatoId(evento.target.value);
              setValores({});
            }}
            required
          >
            <option value="">Elige un formato</option>
            {formatos.map((uno) => (
              <option value={uno.id} key={uno.id}>
                {uno.name} (v{uno.version})
              </option>
            ))}
          </select>
        </label>

        <label className="request-form-field">
          <span className="request-form-label">Título</span>
          <input
            value={cabecera.title}
            onChange={(evento) => setCabecera({ ...cabecera, title: evento.target.value })}
            placeholder="Ej: Papelería institucional de la facultad"
            required
          />
        </label>

        <div className="request-form-field">
          <span className="request-form-label">Entidad solicitante</span>
          <RequesterInput
            id="solicitante-nuevo"
            value={cabecera.requester}
            onChange={(requester) => setCabecera({ ...cabecera, requester })}
          />
        </div>

        <label className="request-form-field">
          <span className="request-form-label">
            Área asignada
            <Ayuda texto="El área que atiende la solicitud mientras no tiene flujo. Con flujo, la reciben las áreas de su primera fase." />
          </span>
          <select
            value={cabecera.areaId}
            onChange={(evento) => setCabecera({ ...cabecera, areaId: evento.target.value })}
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
            <Ayuda texto="Un número: mayor es más urgente. La imprenta y la producción priorizan por urgencia, nunca por orden de llegada (RF-FLW-08)." />
          </span>
          <input
            type="number"
            value={cabecera.priority}
            onChange={(evento) => setCabecera({ ...cabecera, priority: evento.target.value })}
          />
        </label>

        <label className="request-form-field">
          <span className="request-form-label">Cómo llegó</span>
          <select
            value={cabecera.source}
            onChange={(evento) => setCabecera({ ...cabecera, source: evento.target.value })}
          >
            {ORIGENES.map((origen) => (
              <option value={origen.value} key={origen.value}>
                {origen.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {formato ? (
        <section className="request-form-sec">
          <h3>Lo que pide {formato.name}</h3>
          <div className="request-form-grid">
            {campos.map((campo) => (
              <FieldInput
                key={campo.code}
                field={campo}
                value={valores[campo.code]}
                onChange={(valor) => setValores({ ...valores, [campo.code]: valor })}
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
          disabled={guardando || formato === null}
        >
          {guardando ? "Registrando…" : "Registrar solicitud"}
        </button>
      </footer>
    </form>
  );
}

export default RequestForm;
