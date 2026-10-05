// Captura directa de un proyecto: lo que no entra por una solicitud. Se abre como el primer
// renglón del tablero, en el lugar que va a ocupar el proyecto nuevo.
//
// La llave la numera el servidor si se deja vacía (PRY-000001), así que nadie tiene que inventar
// un nombre para empezar; una sugerencia que el cliente no reserva sería peor, porque dos
// personas capturando a la vez chocarían en la misma. El formato es opcional: si se elige, sus
// valores se guardan como valores del proyecto, los mismos que después leen la orden de impresión
// y facturación.
//
// La plantilla de flujo se copia aquí, del lado del cliente: la captura directa acepta una lista
// de etapas con su fase, así que las fases de la plantilla se mandan como etapas. El proyecto no
// queda apuntando a la versión de la plantilla —para eso la API tendría que aceptar la plantilla
// misma—, de modo que editarla después no toca este proyecto.
//
// **Los campos extra son de este proyecto y no del formato.** Un proyecto suele traer un dato que
// su formato no pide y que igual hace falta --- un folio del SIN, un pantone, una referencia que
// pidió facturación --- y publicar una versión nueva del formato por eso sería cambiárselo a todos
// los proyectos futuros. `project_field_values` acepta cualquier clave, así que el dato entra aquí
// sin tocar el catálogo. El precio, dicho: una clave escrita a mano no la valida nadie contra el
// vocabulario, y dos personas pueden inventar dos nombres para lo mismo. Cuando la clave vaya a
// repetirse, el lugar correcto es el formato.
import { Fragment, useEffect, useState } from "react";

import * as api from "../../api/client.js";
import Ayuda from "../shared/ayuda.jsx";
import FieldInput from "../shared/fieldInput.jsx";
import RequesterInput from "../requests/requesterInput.jsx";
import "./projectForm.css";

function ProjectForm({ onCreado, onCancelar }) {
  const [formatos, setFormatos] = useState([]);
  const [plantillas, setPlantillas] = useState([]);
  const [formatoId, setFormatoId] = useState("");
  const [plantillaId, setPlantillaId] = useState("");
  const [plantilla, setPlantilla] = useState(null);
  const [valores, setValores] = useState({});
  const [cabecera, setCabecera] = useState({
    key: "",
    title: "",
    requester: "",
    priority: 0,
    hasCost: false,
    dueOn: "",
  });
  const [extras, setExtras] = useState([]);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      try {
        const [respuestaFormatos, respuestaPlantillas] = await Promise.all([
          api.listSchemas(),
          api.listWorkflows(),
        ]);
        if (cancelado) return;
        setFormatos(
          respuestaFormatos.schemas.filter(
            (formato) => formato.isActive && formato.fields !== null,
          ),
        );
        setPlantillas(respuestaPlantillas.workflows.filter((una) => una.isActive));
      } catch (fallo) {
        if (!cancelado) setError(fallo.message);
      }
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    let cancelado = false;

    async function cargarPlantilla() {
      if (plantillaId === "") {
        setPlantilla(null);
        return;
      }
      try {
        const respuesta = await api.getWorkflow(Number(plantillaId));
        if (!cancelado) setPlantilla(respuesta.workflow);
      } catch (fallo) {
        if (!cancelado) setError(fallo.message);
      }
    }

    cargarPlantilla();
    return () => {
      cancelado = true;
    };
  }, [plantillaId]);

  const formato = formatos.find((uno) => String(uno.id) === String(formatoId)) ?? null;
  const campos = formato ? [...formato.fields.deliverables, ...formato.fields.information] : [];

  /** Las fases de la plantilla como etapas con su fase, que es lo que la captura acepta. */
  function etapasDeLaPlantilla() {
    if (plantilla === null || plantilla.phases === undefined) {
      return [];
    }
    const etapas = [];
    plantilla.phases.forEach((fase, indice) => {
      for (const etapa of fase.stages) {
        etapas.push({
          areaId: etapa.areaId,
          title: etapa.title,
          seq: indice + 1,
          inputs: etapa.inputs ?? [],
          outputs: etapa.outputs ?? [],
          estimatedDays: etapa.estimatedDays ?? undefined,
        });
      }
    });
    return etapas;
  }

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
        stages: etapasDeLaPlantilla(),
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
      <header className="project-form-head">
        <span className="project-form-eyebrow">Nuevo proyecto</span>
        <button
          className="project-form-close"
          type="button"
          onClick={onCancelar}
          aria-label="Cerrar la captura"
        >
          ✕
        </button>
      </header>

      <div className="project-form-grid">
        <label className="project-form-field">
          <span className="project-form-label">
            Llave
            <Ayuda texto="Si se deja vacía, el servidor la numera como PRY-000001 al crear el proyecto. Escríbela solo si la coordinación ya usa una llave propia." />
          </span>
          <input
            value={cabecera.key}
            onChange={(evento) => setCabecera({ ...cabecera, key: evento.target.value })}
            placeholder="Ej: PAPEL-FCQ-03"
          />
        </label>

        <label className="project-form-field">
          <span className="project-form-label">Título</span>
          <input
            value={cabecera.title}
            onChange={(evento) => setCabecera({ ...cabecera, title: evento.target.value })}
            placeholder="Ej: Manual de identidad"
            required
          />
        </label>

        <div className="project-form-field">
          <span className="project-form-label">Entidad solicitante</span>
          <RequesterInput
            id="solicitante-proyecto"
            value={cabecera.requester}
            onChange={(requester) => setCabecera({ ...cabecera, requester })}
          />
        </div>

        <label className="project-form-field">
          <span className="project-form-label">
            Urgencia
            <Ayuda texto="Un número: mayor es más urgente. La imprenta y la producción priorizan por urgencia, nunca por orden de llegada (RF-FLW-08)." />
          </span>
          <input
            type="number"
            value={cabecera.priority}
            onChange={(evento) => setCabecera({ ...cabecera, priority: evento.target.value })}
          />
        </label>

        <label className="project-form-field">
          <span className="project-form-label">Fecha de entrega</span>
          <input
            type="date"
            value={cabecera.dueOn}
            onChange={(evento) => setCabecera({ ...cabecera, dueOn: evento.target.value })}
          />
        </label>

        <label className="project-form-check">
          <input
            type="checkbox"
            checked={cabecera.hasCost}
            onChange={(evento) => setCabecera({ ...cabecera, hasCost: evento.target.checked })}
          />
          Con costo
        </label>
      </div>

      <section className="project-form-sec">
        <h3>Flujo</h3>
        <label className="project-form-field">
          <span className="project-form-label">
            Partir de una plantilla
            <Ayuda texto="Las fases de la plantilla se copian como etapas de este proyecto. El proyecto no queda apuntando a la plantilla: editarla después no lo toca." />
          </span>
          <select value={plantillaId} onChange={(evento) => setPlantillaId(evento.target.value)}>
            <option value="">Sin flujo todavía</option>
            {plantillas.map((una) => (
              <option value={una.id} key={una.id}>
                {una.name}
              </option>
            ))}
          </select>
        </label>

        {plantilla === null || plantilla.phases === undefined ? null : (
          <div className="project-form-flow">
            {plantilla.phases.map((fase, indice) => (
              <Fragment key={fase.id ?? indice}>
                {indice > 0 ? <div className="project-form-arrow" /> : null}
                <div className="project-form-phase">
                  <span className="project-form-phase-name">
                    FASE {indice + 1} · {fase.name}
                  </span>
                  {fase.stages.map((etapa) => (
                    <div className="project-form-card" key={etapa.id}>
                      <span className="project-form-card-area">{etapa.areaName}</span>
                      <strong>{etapa.title}</strong>
                    </div>
                  ))}
                </div>
              </Fragment>
            ))}
          </div>
        )}
      </section>

      <section className="project-form-sec">
        <h3>Datos</h3>
        <label className="project-form-field">
          <span className="project-form-label">
            Formato
            <Ayuda texto="Opcional. Sus campos se capturan aquí y se guardan como valores del proyecto; ninguno es obligatorio, porque un proyecto capturado directo puede empezar incompleto." />
          </span>
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
          <div className="project-form-grid">
            {campos.map((campo) => (
              <FieldInput
                key={campo.code}
                field={{ ...campo, required: false }}
                value={valores[campo.code]}
                onChange={(valor) => setValores({ ...valores, [campo.code]: valor })}
              />
            ))}
          </div>
        ) : null}
      </section>

      <section className="project-form-sec">
        <h3>
          Datos solo de este proyecto
          <Ayuda texto="Para lo que este proyecto trae y su formato no pide. No cambia el formato. Si la clave va a servir en otros proyectos, su lugar es el formato." />
        </h3>

        {extras.map((extra, indice) => {
          const repetida = extra.key.trim() !== "" && repetidas.has(extra.key.trim());

          return (
            <div className="project-form-extra" key={indice}>
              <input
                className={repetida ? "project-form-key is-bad" : "project-form-key"}
                value={extra.key}
                onChange={(evento) => cambiarExtra(indice, { key: evento.target.value })}
                placeholder="Ej: folio_sin"
                aria-label="Clave"
              />
              <input
                value={extra.value}
                onChange={(evento) => cambiarExtra(indice, { value: evento.target.value })}
                placeholder="Valor"
                aria-label="Valor"
              />
              <button className="project-form-btn" type="button" onClick={() => quitarExtra(indice)}>
                Quitar
              </button>
              {repetida ? (
                <p className="project-form-bad">
                  Esa clave ya está en este proyecto: se guardaría una sola.
                </p>
              ) : null}
            </div>
          );
        })}

        <button className="project-form-add" type="button" onClick={agregarExtra}>
          + Agregar un dato
        </button>
      </section>

      {error !== null ? <p className="project-form-error">{error}</p> : null}

      <footer className="project-form-foot">
        <button className="project-form-btn" type="button" onClick={onCancelar}>
          Cancelar
        </button>
        <button
          className="project-form-btn is-primary"
          type="submit"
          disabled={guardando || cabecera.title.trim() === ""}
        >
          {guardando ? "Creando…" : "Crear proyecto"}
        </button>
      </footer>
    </form>
  );
}

export default ProjectForm;
