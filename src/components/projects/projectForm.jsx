// Captura directa de un proyecto: lo que no entra por una solicitud.
//
// La llave se genera si se deja vacía (PRY-000001), así que nadie tiene que inventar un nombre
// para empezar. El formato es opcional: si se elige, sus valores se guardan como valores del
// proyecto, los mismos que después leen la orden de impresión y facturación.
//
// **Los campos extra son de este proyecto y no del formato.** Un proyecto suele traer un dato que
// su formato no pide y que igual hace falta --- un folio del SIN, un pantone, una referencia que
// pidió facturación --- y publicar una versión nueva del formato por eso sería cambiárselo a todos
// los proyectos futuros. `project_field_values` acepta cualquier clave, así que el dato entra aquí
// sin tocar el catálogo. El precio, dicho: una clave escrita a mano no la valida nadie contra el
// vocabulario, y dos personas pueden inventar dos nombres para lo mismo. Cuando la clave vaya a
// repetirse, el lugar correcto es el formato.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import FieldInput from "../shared/fieldInput.jsx";
import RequesterInput from "../requests/requesterInput.jsx";
import "./projectForm.css";

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
  const [extras, setExtras] = useState([]);
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
        fieldValues: [
          ...Object.entries(valores)
            .filter(([, valor]) => valor !== "" && valor !== undefined && valor !== null)
            .map(([key, value]) => ({ key, value })),
          ...extras
            .filter((extra) => extra.key.trim() !== "" && extra.value !== "")
            .map((extra) => ({ key: extra.key.trim(), value: extra.value })),
        ],
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

  function agregarExtra() {
    setExtras([...extras, { key: "", value: "" }]);
  }

  function cambiarExtra(indice, cambios) {
    setExtras(extras.map((extra, i) => (i === indice ? { ...extra, ...cambios } : extra)));
  }

  function quitarExtra(indice) {
    setExtras(extras.filter((_, i) => i !== indice));
  }

  const clavesDelFormato = campos.map((campo) => campo.code);
  const clavesExtra = extras.map((extra) => extra.key.trim()).filter((clave) => clave !== "");
  const repetidas = new Set(
    clavesExtra.filter(
      (clave, i) => clavesExtra.indexOf(clave) !== i || clavesDelFormato.includes(clave),
    ),
  );

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

      <fieldset className="project-form-extras">
        <legend>Datos sólo de este proyecto</legend>
        <p className="project-form-help">
          Para lo que este proyecto trae y su formato no pide. No cambia el formato: se guarda como
          un valor más del proyecto, con la clave que le pongas. Si la clave va a servir en otros
          proyectos, conviene agregarla al formato en «Esquemas de datos».
        </p>

        {extras.map((extra, indice) => {
          const repetida = extra.key.trim() !== "" && repetidas.has(extra.key.trim());

          let aviso = null;
          if (repetida) {
            aviso = (
              <p className="project-form-bad">
                Esa clave ya está en este proyecto: se guardaría una sola.
              </p>
            );
          }

          return (
            <div className="project-form-extra" key={indice}>
              <input
                className={repetida ? "project-form-key project-form-key--bad" : "project-form-key"}
                value={extra.key}
                onChange={(evento) => cambiarExtra(indice, { key: evento.target.value })}
                placeholder="folio_sin"
                aria-label="Clave"
              />
              <input
                value={extra.value}
                onChange={(evento) => cambiarExtra(indice, { value: evento.target.value })}
                placeholder="Valor"
                aria-label="Valor"
              />
              <button type="button" onClick={() => quitarExtra(indice)}>
                Quitar
              </button>
              {aviso}
            </div>
          );
        })}

        <button className="project-form-add" type="button" onClick={agregarExtra}>
          Agregar un dato
        </button>
      </fieldset>

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
