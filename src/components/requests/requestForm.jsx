import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import FieldInput from "../shared/fieldInput.jsx";
import RequesterInput from "./requesterInput.jsx";
import "./requestForm.css";

// Captura directa de una solicitud (RF-SOL-08): lo que llega por correo se registra aquí, para
// que todo el trabajo entre por un solo canal.
//
// Los campos se dibujan del formato elegido, así que la pantalla no sabe nada de ellos: cambia
// el formato y cambia el formulario. La conversión de valores la hace el servidor según el
// tipo de cada campo, de modo que "1,000" y "15/03/2026" llegan bien sin tocar nada aquí.
const ORIGENES = [
  { value: "manual", label: "Captura directa" },
  { value: "email", label: "Llegó por correo" },
  { value: "form", label: "Llegó por formulario" },
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
        // Solo los activos: un formato desactivado ya no recibe solicitudes.
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
      <h3 className="request-form-title">Nueva solicitud</h3>

      <label className="request-form-field">
        Formato
        <select
          value={formatoId}
          onChange={(evento) => {
            setFormatoId(evento.target.value);
            // Los campos cambian con el formato, así que lo capturado hasta ahora no aplica.
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
        Título
        <input
          value={cabecera.title}
          onChange={(evento) => setCabecera({ ...cabecera, title: evento.target.value })}
          required
        />
      </label>

      <label className="request-form-field" htmlFor="solicitante-nuevo">
        Entidad solicitante
      </label>
      <RequesterInput
        id="solicitante-nuevo"
        value={cabecera.requester}
        onChange={(requester) => setCabecera({ ...cabecera, requester })}
      />

      <label className="request-form-field">
        Área a la que cae
        <select
          value={cabecera.areaId}
          onChange={(evento) => setCabecera({ ...cabecera, areaId: evento.target.value })}
        >
          <option value="">Sin área todavía</option>
          {areas.map((area) => (
            <option value={area.id} key={area.id}>
              {area.name}
            </option>
          ))}
        </select>
      </label>

      <label className="request-form-field">
        Prioridad (mayor es más urgente)
        <input
          type="number"
          value={cabecera.priority}
          onChange={(evento) => setCabecera({ ...cabecera, priority: evento.target.value })}
        />
      </label>

      <label className="request-form-field">
        Cómo llegó
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

      {formato ? (
        <fieldset className="request-form-fields">
          <legend>Datos del formato</legend>
          {campos.map((campo) => (
            <FieldInput
              key={campo.code}
              field={campo}
              value={valores[campo.code]}
              onChange={(valor) => setValores({ ...valores, [campo.code]: valor })}
            />
          ))}
        </fieldset>
      ) : null}

      {error ? <p className="request-form-error">{error}</p> : null}

      <div className="request-form-actions">
        <button type="submit" disabled={guardando || formato === null}>
          {guardando ? "Guardando..." : "Registrar solicitud"}
        </button>
        <button type="button" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export default RequestForm;
