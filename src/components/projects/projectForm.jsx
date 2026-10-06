// Capturing a project by hand: what does not come in through a request. It opens as the board's
// first row, in the place the new project is going to occupy.
//
// The server numbers the key when it is left empty (PRY-000001), so nobody has to invent a name to
// start; a suggestion the client does not reserve would be worse, because two people capturing at
// once would collide on it. The format is optional: when one is chosen, its values are saved as
// the project's values, the same ones the print order and the invoicing read later.
//
// The flow template is copied here, on the client: capturing by hand accepts a list of stages with
// their phase, so the template's phases are sent as stages. The project is not left pointing at
// the template's version -- for that the API would have to take the template itself -- so editing
// the template afterwards does not touch this project.
//
// **The extra fields belong to this project and not to the format.** A project often carries a
// value its format does not ask for and that is needed anyway --- a SIN folio, a pantone, a
// reference invoicing asked for --- and publishing a new version of the format for that would
// change it for every future project. `project_field_values` accepts any key, so the value gets in
// here without touching the catalog. The price, stated: a key typed by hand is checked by nobody
// against the vocabulary, and two people can invent two names for the same thing. Once a key is
// going to repeat, its right place is the format.
import { Fragment, useEffect, useState } from "react";

import * as api from "../../api/client.js";
import Help from "../shared/help.jsx";
import FieldInput from "../shared/fieldInput.jsx";
import RequesterInput from "../requests/requesterInput.jsx";
import "./projectForm.css";

function ProjectForm({ onCreated, onCancel }) {
  const [formats, setFormatos] = useState([]);
  const [templates, setPlantillas] = useState([]);
  const [formatId, setFormatoId] = useState("");
  const [templateId, setPlantillaId] = useState("");
  const [template, setPlantilla] = useState(null);
  const [values, setValores] = useState({});
  const [header, setCabecera] = useState({
    key: "",
    title: "",
    requester: "",
    priority: 0,
    hasCost: false,
    dueOn: "",
  });
  const [extras, setExtras] = useState([]);
  const [error, setError] = useState(null);
  const [saving, setGuardando] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [respuestaFormatos, respuestaPlantillas] = await Promise.all([
          api.listSchemas(),
          api.listWorkflows(),
        ]);
        if (cancelled) return;
        setFormatos(
          respuestaFormatos.schemas.filter(
            (format) => format.isActive && format.fields !== null,
          ),
        );
        setPlantillas(respuestaPlantillas.workflows.filter((one) => one.isActive));
      } catch (failure) {
        if (!cancelled) setError(failure.message);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadTemplate() {
      if (templateId === "") {
        setPlantilla(null);
        return;
      }
      try {
        const response = await api.getWorkflow(Number(templateId));
        if (!cancelled) setPlantilla(response.workflow);
      } catch (failure) {
        if (!cancelled) setError(failure.message);
      }
    }

    loadTemplate();
    return () => {
      cancelled = true;
    };
  }, [templateId]);

  const format = formats.find((one) => String(one.id) === String(formatId)) ?? null;
  const fields = format ? [...format.fields.deliverables, ...format.fields.information] : [];

  /** The template's phases as stages with their phase, which is what capture accepts. */
  function stagesFromTemplate() {
    if (template === null || template.phases === undefined) {
      return [];
    }
    const stages = [];
    template.phases.forEach((phase, index) => {
      for (const stage of phase.stages) {
        stages.push({
          areaId: stage.areaId,
          title: stage.title,
          seq: index + 1,
          inputs: stage.inputs ?? [],
          outputs: stage.outputs ?? [],
          estimatedDays: stage.estimatedDays ?? undefined,
        });
      }
    });
    return stages;
  }

  async function save(event) {
    event.preventDefault();
    setGuardando(true);
    setError(null);

    try {
      const { project } = await api.createProject({
        key: header.key || undefined,
        title: header.title,
        requester: header.requester || undefined,
        priority: Number(header.priority),
        hasCost: header.hasCost,
        dueOn: header.dueOn || undefined,
        schemaVersionId: format ? format.schemaVersionId : undefined,
        fieldValues: [
          ...Object.entries(values)
            .filter(([, value]) => value !== "" && value !== undefined && value !== null)
            .map(([key, value]) => ({ key, value })),
          ...extras
            .filter((extra) => extra.key.trim() !== "" && extra.value !== "")
            .map((extra) => ({ key: extra.key.trim(), value: extra.value })),
        ],
        stages: stagesFromTemplate(),
      });
      onCreated(project);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setGuardando(false);
    }
  }

  function addExtra() {
    setExtras([...extras, { key: "", value: "" }]);
  }

  function changeExtra(index, cambios) {
    setExtras(extras.map((extra, i) => (i === index ? { ...extra, ...cambios } : extra)));
  }

  function removeExtra(index) {
    setExtras(extras.filter((_, i) => i !== index));
  }

  const formatKeys = fields.map((field) => field.code);
  const extraKeys = extras.map((extra) => extra.key.trim()).filter((key) => key !== "");
  const repeatedKeys = new Set(
    extraKeys.filter(
      (key, i) => extraKeys.indexOf(key) !== i || formatKeys.includes(key),
    ),
  );

  return (
    <form className="project-form" onSubmit={save}>
      <header className="project-form-head">
        <span className="project-form-eyebrow">Nuevo proyecto</span>
        <button
          className="project-form-close"
          type="button"
          onClick={onCancel}
          aria-label="Cerrar la captura"
        >
          ✕
        </button>
      </header>

      <div className="project-form-grid">
        <label className="project-form-field">
          <span className="project-form-label">
            Llave
            <Help text="Si se deja vacía, el servidor la numera como PRY-000001 al crear el proyecto. Escríbela solo si la coordinación ya usa una llave propia." />
          </span>
          <input
            value={header.key}
            onChange={(event) => setCabecera({ ...header, key: event.target.value })}
            placeholder="Ej: PAPEL-FCQ-03"
          />
        </label>

        <label className="project-form-field">
          <span className="project-form-label">Título</span>
          <input
            value={header.title}
            onChange={(event) => setCabecera({ ...header, title: event.target.value })}
            placeholder="Ej: Manual de identidad"
            required
          />
        </label>

        <div className="project-form-field">
          <span className="project-form-label">Entidad solicitante</span>
          <RequesterInput
            id="solicitante-proyecto"
            value={header.requester}
            onChange={(requester) => setCabecera({ ...header, requester })}
          />
        </div>

        <label className="project-form-field">
          <span className="project-form-label">
            Urgencia
            <Help text="Un número: mayor es más urgente. La imprenta y la producción priorizan por urgencia, nunca por orden de llegada (RF-FLW-08)." />
          </span>
          <input
            type="number"
            value={header.priority}
            onChange={(event) => setCabecera({ ...header, priority: event.target.value })}
          />
        </label>

        <label className="project-form-field">
          <span className="project-form-label">Fecha de entrega</span>
          <input
            type="date"
            value={header.dueOn}
            onChange={(event) => setCabecera({ ...header, dueOn: event.target.value })}
          />
        </label>

        <label className="project-form-check">
          <input
            type="checkbox"
            checked={header.hasCost}
            onChange={(event) => setCabecera({ ...header, hasCost: event.target.checked })}
          />
          Con costo
        </label>
      </div>

      <section className="project-form-sec">
        <h3>Flujo</h3>
        <label className="project-form-field">
          <span className="project-form-label">
            Partir de one template
            <Help text="Las fases de la plantilla se copian como etapas de este proyecto. El proyecto no queda apuntando a la plantilla: editarla después no lo toca." />
          </span>
          <select value={templateId} onChange={(event) => setPlantillaId(event.target.value)}>
            <option value="">Sin flujo todavía</option>
            {templates.map((one) => (
              <option value={one.id} key={one.id}>
                {one.name}
              </option>
            ))}
          </select>
        </label>

        {template === null || template.phases === undefined ? null : (
          <div className="project-form-flow">
            {template.phases.map((phase, index) => (
              <Fragment key={phase.id ?? index}>
                {index > 0 ? <div className="project-form-arrow" /> : null}
                <div className="project-form-phase">
                  <span className="project-form-phase-name">
                    FASE {index + 1} · {phase.name}
                  </span>
                  {phase.stages.map((stage) => (
                    <div className="project-form-card" key={stage.id}>
                      <span className="project-form-card-area">{stage.areaName}</span>
                      <strong>{stage.title}</strong>
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
            <Help text="Opcional. Sus campos se capturan aquí y se guardan como valores del proyecto; ninguno es obligatorio, porque un proyecto capturado directo puede empezar incompleto." />
          </span>
          <select
            value={formatId}
            onChange={(event) => {
              setFormatoId(event.target.value);
              setValores({});
            }}
          >
            <option value="">Sin formato</option>
            {formats.map((one) => (
              <option value={one.id} key={one.id}>
                {one.name} (v{one.version})
              </option>
            ))}
          </select>
        </label>

        {format ? (
          <div className="project-form-grid">
            {fields.map((field) => (
              <FieldInput
                key={field.code}
                field={{ ...field, required: false }}
                value={values[field.code]}
                onChange={(value) => setValores({ ...values, [field.code]: value })}
              />
            ))}
          </div>
        ) : null}
      </section>

      <section className="project-form-sec">
        <h3>
          Datos solo de este proyecto
          <Help text="Para lo que este proyecto trae y su formato no pide. No cambia el formato. Si la clave va a servir en otros proyectos, su lugar es el formato." />
        </h3>

        {extras.map((extra, index) => {
          const repeated = extra.key.trim() !== "" && repeatedKeys.has(extra.key.trim());

          return (
            <div className="project-form-extra" key={index}>
              <input
                className={repeated ? "project-form-key is-bad" : "project-form-key"}
                value={extra.key}
                onChange={(event) => changeExtra(index, { key: event.target.value })}
                placeholder="Ej: folio_sin"
                aria-label="Clave"
              />
              <input
                value={extra.value}
                onChange={(event) => changeExtra(index, { value: event.target.value })}
                placeholder="Valor"
                aria-label="Valor"
              />
              <button className="project-form-btn" type="button" onClick={() => removeExtra(index)}>
                Quitar
              </button>
              {repeated ? (
                <p className="project-form-bad">
                  Esa clave ya está en este proyecto: se guardaría una sola.
                </p>
              ) : null}
            </div>
          );
        })}

        <button className="project-form-add" type="button" onClick={addExtra}>
          + Agregar un dato
        </button>
      </section>

      {error !== null ? <p className="project-form-error">{error}</p> : null}

      <footer className="project-form-foot">
        <button className="project-form-btn" type="button" onClick={onCancel}>
          Cancelar
        </button>
        <button
          className="project-form-btn is-primary"
          type="submit"
          disabled={saving || header.title.trim() === ""}
        >
          {saving ? "Creando…" : "Crear proyecto"}
        </button>
      </footer>
    </form>
  );
}

export default ProjectForm;
