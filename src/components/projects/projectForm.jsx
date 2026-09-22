import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import FieldInput from "../shared/fieldInput.jsx";
import RequesterInput from "../requests/requesterInput.jsx";
import "./projectForm.css";

// Captura directa de un proyecto: lo que no entra por una solicitud.
//
// La llave se genera si se deja vacía (PRY-000001), así que nadie tiene que inventar un nombre
// para empezar. El formato es opcional: si se elige, sus valores se guardan como valores del
// proyecto, los mismos que después leen la orden de impresión y facturación.
function ProjectForm({ areas, onCreado, onCancelar }) {
  const [formatos, setFormatos] = useState([]);
  const [formatoId, setFormatoId] = useState("");
  const [valores, setValores] = useState({});
  const [cabecera, setCabecera] = useState({
    key: "",
    title: "",
    requester: "",
    priority: 0,
    hasCost: false,
    dueOn: "",
    areaId: "",
    stageTitle: "",
  });
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
  const campos = formato ? [...formato.fields.deliverables, ...formato.fields.information] : [];

  async function guardar(evento) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);

    try {
      const { project } = await api.createProject({
        key: cabecera.key || undefined,
        title: cabecera.title,
        requester: cabecera.requester || undefined,
        priority: Number(cabecera.priority),
        hasCost: cabecera.hasCost,
        dueOn: cabecera.dueOn || undefined,
        schemaVersionId: formato ? formato.schemaVersionId : undefined,
        // Los valores capturados se guardan con la clave de su campo.
        fieldValues: Object.entries(valores)
          .filter(([, valor]) => valor !== "" && valor !== undefined && valor !== null)
          .map(([key, value]) => ({ key, value })),
        stages:
          cabecera.areaId === ""
            ? []
            : [
                {
                  areaId: Number(cabecera.areaId),
                  title: cabecera.stageTitle || "Primera etapa",
                },
              ],
      });
      onCreado(project);
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form className="project-form" onSubmit={guardar}>
      <h3 className="project-form-title">Nuevo proyecto</h3>

      <label className="project-form-field">
        Llave (vacío: se genera como PRY-000001)
        <input
          value={cabecera.key}
          onChange={(evento) => setCabecera({ ...cabecera, key: evento.target.value })}
          placeholder="PAPEL-FCQ-03"
        />
      </label>

      <label className="project-form-field">
        Título
        <input
          value={cabecera.title}
          onChange={(evento) => setCabecera({ ...cabecera, title: evento.target.value })}
          required
        />
      </label>

      <label className="project-form-field" htmlFor="solicitante-proyecto">
        Entidad solicitante
      </label>
      <RequesterInput
        id="solicitante-proyecto"
        value={cabecera.requester}
        onChange={(requester) => setCabecera({ ...cabecera, requester })}
      />

      <label className="project-form-field">
        Urgencia (mayor es más urgente)
        <input
          type="number"
          value={cabecera.priority}
          onChange={(evento) => setCabecera({ ...cabecera, priority: evento.target.value })}
        />
      </label>

      <label className="project-form-field">
        <input
          type="checkbox"
          checked={cabecera.hasCost}
          onChange={(evento) => setCabecera({ ...cabecera, hasCost: evento.target.checked })}
        />
        Con costo
      </label>

      <label className="project-form-field">
        Fecha de entrega
        <input
          type="date"
          value={cabecera.dueOn}
          onChange={(evento) => setCabecera({ ...cabecera, dueOn: evento.target.value })}
        />
      </label>

      <label className="project-form-field">
        Primera etapa, en el área
        <select
          value={cabecera.areaId}
          onChange={(evento) => setCabecera({ ...cabecera, areaId: evento.target.value })}
        >
          <option value="">Sin etapas todavía</option>
          {areas.map((area) => (
            <option value={area.id} key={area.id}>
              {area.name}
            </option>
          ))}
        </select>
      </label>

      {cabecera.areaId !== "" ? (
        <label className="project-form-field">
          Nombre de la etapa
          <input
            value={cabecera.stageTitle}
            onChange={(evento) => setCabecera({ ...cabecera, stageTitle: evento.target.value })}
            placeholder="Diseño de la propuesta"
          />
        </label>
      ) : null}

      <label className="project-form-field">
        Formato (opcional, para capturar sus datos)
        <select
          value={formatoId}
          onChange={(evento) => {
            setFormatoId(evento.target.value);
            setValores({});
          }}
        >
          <option value="">Sin formato</option>
          {formatos.map((uno) => (
            <option value={uno.id} key={uno.id}>
              {uno.name} (v{uno.version})
            </option>
          ))}
        </select>
      </label>

      {formato ? (
        <fieldset className="project-form-fields">
          <legend>Datos del formato</legend>
          {campos.map((campo) => (
            <FieldInput
              key={campo.code}
              field={{ ...campo, required: false }}
              value={valores[campo.code]}
              onChange={(valor) => setValores({ ...valores, [campo.code]: valor })}
            />
          ))}
          <p className="project-form-help">
            Aquí ningún campo es obligatorio: un proyecto capturado directo puede empezar
            incompleto, y lo que falte se agrega después como valor del proyecto.
          </p>
        </fieldset>
      ) : null}

      {error ? <p className="project-form-error">{error}</p> : null}

      <div className="project-form-actions">
        <button type="submit" disabled={guardando}>
          {guardando ? "Guardando..." : "Crear proyecto"}
        </button>
        <button type="button" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export default ProjectForm;
