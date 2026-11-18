// Un campo de un formato, dibujado según su tipo. Lo usan la captura de solicitudes y la de
// proyectos, así que el tipo se traduce a un <input> en un solo lugar.
//
// `field` trae code, name, type, note y si es obligatorio, y un `choice` trae además `choices` y
// `multiple`. El tipo es un `data_types.code`: el servidor lo convierte al guardar, así que aquí
// solo elegimos con qué se teclea más cómodo. Con `archivos`, un `document` pide un archivo y su
// valor es el File. Sin él sigue siendo texto, que es como lo guardan los proyectos.
//
// La indicación del campo vive detrás del (?) de su etiqueta y no como texto corrido: un
// formulario con un párrafo bajo cada campo se vuelve ilegible justo donde hay que leerlo.
import Help from "./help.jsx";
import TypeIcon from "./typeIcon.jsx";
import "./fieldInput.css";

const TIPOS = {
  text: "text",
  email: "email",
  phone: "tel",
  url: "url",
  location: "text",
  document: "text",
  quantity: "number",
  currency: "number",
  percentage: "number",
  date: "date",
  datetime: "datetime-local",
};

function FieldInput({ field, value, onChange, archivos = false }) {
  const id = `campo-${field.code}`;
  const tipo = TIPOS[field.type] ?? "text";

  const etiqueta = (
    <label className="field-label" htmlFor={id}>
      <TypeIcon type={field.type} />
      <span className="field-name">{field.name}</span>
      {field.required ? <span className="field-required"> *</span> : null}
      {field.note ? <Help text={field.note} /> : null}
    </label>
  );

  if (field.type === "choice" && field.multiple) {
    const elegidas = Array.isArray(value) ? value : [];
    return (
      <fieldset className="field-input field-input-choices" id={id}>
        <legend className="field-label">
          <TypeIcon type={field.type} />
          <span className="field-name">{field.name}</span>
          {field.required ? <span className="field-required"> *</span> : null}
          {field.note ? <Help text={field.note} /> : null}
        </legend>
        {(field.choices ?? []).map((opcion) => (
          <label className="field-choice" key={opcion}>
            <input
              className="field-checkbox"
              type="checkbox"
              checked={elegidas.includes(opcion)}
              onChange={(evento) =>
                onChange(
                  evento.target.checked
                    ? [...elegidas, opcion]
                    : elegidas.filter((elegida) => elegida !== opcion),
                )
              }
            />
            <span className="field-choice-name">{opcion}</span>
          </label>
        ))}
      </fieldset>
    );
  }

  if (field.type === "choice") {
    return (
      <div className="field-input">
        {etiqueta}
        <select
          className="field-control"
          id={id}
          required={field.required}
          value={value ?? ""}
          onChange={(evento) => onChange(evento.target.value)}
        >
          <option value="">Elige una opción</option>
          {(field.choices ?? []).map((opcion) => (
            <option key={opcion} value={opcion}>
              {opcion}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === "document" && archivos) {
    return (
      <div className="field-input">
        {etiqueta}
        <input
          className="field-control field-file"
          id={id}
          type="file"
          required={field.required}
          onChange={(evento) => onChange(evento.target.files?.[0] ?? null)}
        />
        {value instanceof File ? <span className="field-file-name">{value.name}</span> : null}
      </div>
    );
  }

  if (field.type === "boolean") {
    return (
      <div className="field-input field-input-boolean">
        <label className="field-label" htmlFor={id}>
          <input
            className="field-checkbox"
            id={id}
            type="checkbox"
            checked={value === true || value === "true"}
            onChange={(evento) => onChange(evento.target.checked)}
          />
          <span className="field-name">{field.name}</span>
          {field.note ? <Help text={field.note} /> : null}
        </label>
      </div>
    );
  }

  return (
    <div className="field-input">
      {etiqueta}

      <input
        className="field-control"
        id={id}
        type={tipo}
        step={field.type === "currency" ? "0.01" : field.type === "quantity" ? "1" : undefined}
        min={field.type === "quantity" || field.type === "percentage" ? "0" : undefined}
        max={field.type === "percentage" ? "100" : undefined}
        required={field.required}
        value={value ?? ""}
        onChange={(evento) => onChange(evento.target.value)}
      />

    </div>
  );
}

export default FieldInput;
