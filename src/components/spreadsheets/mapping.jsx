import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import "./mapping.css";

// El asistente de mapeo (RF-MIG-02): decir a qué formato se parece un libro y qué columna
// alimenta cada campo, sin tocar código.
//
// El orden es el de las preguntas que se pueden contestar: primero qué formato, porque de él
// salen los campos; luego qué columna para cada uno, elegida de los encabezados que el libro
// tiene de verdad; y al final "Probar", que trae las primeras filas ya transformadas. Eso
// último es lo que hace juzgable un mapeo: la pregunta «¿esta columna es el tiraje?» es sobre
// los datos, no sobre la regla.
//
// Las columnas se nombran por el texto de su encabezado, así que reordenar la hoja no rompe
// nada y renombrar una columna sí: el servidor lo dice al guardar, nombrando cuál.
const OPS = [
  { value: "column", label: "De una columna" },
  { value: "constant", label: "Un valor fijo" },
  { value: "concat", label: "Unir dos columnas" },
  { value: "split", label: "Partir una columna" },
];

const FORMATOS_FECHA = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"];

// Una regla vacía, que es lo mismo que "este campo no se llena".
const SIN_REGLA = { op: "", column: "" };

// Qué acepta cada tipo de campo, dicho en la pantalla y no solo en el código. Los textos siguen
// a `src/utils/fieldValues.js`, que es quien decide: el **tipo del campo destino** elige la
// conversión, nunca la regla del mapeo. Una celda que no cuadra no se guarda a medias --- la fila
// entera se reporta y no entra.
const QUE_ACEPTA = {
  text: "Cualquier texto.",
  location: "Cualquier texto.",
  document: "Cualquier texto.",
  email: "Un correo con @. Si no lo es, la fila no entra.",
  phone: "Dígitos, espacios y ( ) + . - (5 a 50).",
  url: "Un enlace http o https.",
  quantity: "Un número entero, cero o más. Quita comas y espacios; un texto no entra.",
  currency: "Un monto. Quita $ y comas, y redondea a dos decimales.",
  percentage: "Un número de 0 a 100.",
  date: "Fecha: el número de Excel, o escrita si eliges el orden a la derecha.",
  datetime: "Fecha y hora, igual que una fecha.",
  boolean: "Sí o no: sí, si, verdadero, 1 / no, falso, 0.",
  factura: "El folio que da el sistema financiero de la UAQ. Se captura tal cual.",
  cotizacion: "El folio de la cotización. Se captura tal cual.",
};

// Lo que se dice de un campo del formato: su tipo y qué acepta.
function aceptaDe(campo) {
  const dicho = QUE_ACEPTA[campo.type] ?? QUE_ACEPTA[campo.baseType];
  if (dicho === undefined) {
    return `Tipo «${campo.type}».`;
  }
  return dicho;
}

// Una regla lista para mandar, o `undefined` si no se llenó. Se queda solo con las llaves que su
// operación usa, igual que hace el servidor al guardarla: una regla que todavía recuerda la
// columna que alguien intentó primero se lee como una regla que la usa.
const LLAVES_DE_REGLA = ["column", "columns", "value", "separator", "index", "from", "format", "default"];

function limpiarRegla(regla) {
  if (regla === undefined || regla === null) {
    return undefined;
  }
  if (regla.op === "" || regla.op === undefined) {
    return undefined;
  }

  const limpia = { op: regla.op };
  for (const llave of LLAVES_DE_REGLA) {
    if (regla[llave] !== undefined && regla[llave] !== "") {
      limpia[llave] = regla[llave];
    }
  }
  return limpia;
}

// Los campos de un formato, como una sola lista: la clave es única entre las dos secciones, así
// que para mapear no hace falta distinguirlas.
function camposDe(formato) {
  if (!formato) return [];
  return [
    ...formato.fields.deliverables.map((campo) => ({ ...campo, section: "deliverables" })),
    ...formato.fields.information.map((campo) => ({ ...campo, section: "information" })),
  ];
}

// Las reglas con las que arranca el asistente: lo que ya estaba guardado se conserva y lo demás
// empieza vacío.
function reglasDe(campos, guardado = {}) {
  const reglas = {
    title: guardado.title ?? { ...SIN_REGLA },
    requester: guardado.requester ?? { ...SIN_REGLA },
    status: guardado.status ?? { ...SIN_REGLA },
  };
  for (const campo of campos) {
    reglas[campo.code] = guardado.fields?.[campo.code] ?? { ...SIN_REGLA };
  }
  return {
    reglas,
    hashColumns: guardado.hashColumns ?? [],
    tablaEstatus: Object.entries(guardado.status?.map ?? {}).map(([texto, code]) => ({ texto, code })),
  };
}

// El selector de columna que usan todas las reglas. Vive aquí y no dentro del componente
// porque una función que devuelve JSX declarada en cada render es un componente nuevo cada vez:
// React lo desmonta y lo vuelve a montar, y el campo pierde el foco mientras se escribe.
function SelectorDeColumna({ headers, valor, onChange }) {
  return (
    <select className="mapping-input" value={valor ?? ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">Elige una columna</option>
      {headers.map((header, indice) => (
        <option value={header} key={`${header}-${indice}`}>
          {header === "" ? `(columna ${indice + 1} sin encabezado)` : header}
        </option>
      ))}
    </select>
  );
}

// Una fila de regla: de dónde sale el valor, lo que ese "de dónde" necesita saber, y qué acepta
// el destino --- esto último para que nadie tenga que adivinar si una columna de texto cabe en un
// campo de número.
function FilaDeRegla({ etiqueta, ayuda, tipo, acepta, obligatorio, regla, headers, onCambio }) {
  const actual = regla ?? SIN_REGLA;

  let notaDelCampo = null;
  if (ayuda) {
    notaDelCampo = <p className="mapping-help">{ayuda}</p>;
  }

  return (
    <tr className="mapping-row">
      <th className="mapping-target">
        {etiqueta}
        {notaDelCampo}
      </th>
      <td>
        <select
          className="mapping-input"
          value={actual.op ?? ""}
          onChange={(e) => onCambio({ op: e.target.value })}
        >
          <option value="">No se llena</option>
          {OPS.map((op) => (
            <option value={op.value} key={op.value}>
              {op.label}
            </option>
          ))}
        </select>
      </td>
      <td>
        {actual.op === "column" || actual.op === "split" ? (
          <SelectorDeColumna
            headers={headers}
            valor={actual.column}
            onChange={(column) => onCambio({ column })}
          />
        ) : null}

        {actual.op === "constant" ? (
          <input
            className="mapping-input"
            value={actual.value ?? ""}
            onChange={(e) => onCambio({ value: e.target.value })}
            placeholder="El mismo valor para todas las filas"
          />
        ) : null}

        {actual.op === "concat" ? (
          <div className="mapping-pair">
            <SelectorDeColumna
              headers={headers}
              valor={actual.columns?.[0]}
              onChange={(column) => onCambio({ columns: [column, actual.columns?.[1] ?? ""] })}
            />
            <SelectorDeColumna
              headers={headers}
              valor={actual.columns?.[1]}
              onChange={(column) => onCambio({ columns: [actual.columns?.[0] ?? "", column] })}
            />
            <input
              className="mapping-input mapping-input-short"
              value={actual.separator ?? " "}
              onChange={(e) => onCambio({ separator: e.target.value })}
              placeholder="separador"
            />
          </div>
        ) : null}

        {actual.op === "split" ? (
          <div className="mapping-pair">
            <input
              className="mapping-input mapping-input-short"
              value={actual.separator ?? ""}
              onChange={(e) => onCambio({ separator: e.target.value })}
              placeholder="parte en"
            />
            <input
              className="mapping-input mapping-input-short"
              type="number"
              min="0"
              value={actual.index ?? 0}
              onChange={(e) => onCambio({ index: Number(e.target.value) })}
              placeholder="pedazo"
            />
          </div>
        ) : null}
      </td>
      <td>
        {/* Una fecha escrita a mano necesita decir en qué orden está; una fecha de verdad llega
            como número de Excel y no lo necesita. */}
        {actual.op !== "" && (tipo === "date" || tipo === "datetime") ? (
          <select
            className="mapping-input"
            value={actual.format ?? ""}
            onChange={(e) => onCambio({ format: e.target.value })}
          >
            <option value="">Fecha de Excel</option>
            {FORMATOS_FECHA.map((formato) => (
              <option value={formato} key={formato}>
                Escrita {formato}
              </option>
            ))}
          </select>
        ) : null}

        {actual.op === "column" || actual.op === "concat" || actual.op === "split" ? (
          <label className="mapping-from">
            <input
              type="checkbox"
              checked={actual.from === "text"}
              onChange={(e) => onCambio({ from: e.target.checked ? "text" : undefined })}
            />
            Como se ve
          </label>
        ) : null}
      </td>
      <td>
        {/* Un valor de respaldo sirve justo cuando el campo es obligatorio y la hoja trae la celda
            vacía: sin esto el renglón se rechaza y no hay nada que decidir. */}
        {actual.op === "column" || actual.op === "concat" || actual.op === "split" ? (
          <input
            className="mapping-input"
            value={actual.default ?? ""}
            onChange={(e) => onCambio({ default: e.target.value })}
            placeholder={obligatorio ? "Obligatorio: conviene uno" : "Se queda vacío"}
          />
        ) : null}
      </td>
      <td className="mapping-accepts">{acepta}</td>
    </tr>
  );
}

// Lo que pasaría con las filas de muestra, en una línea. Va junto al botón porque es la
// respuesta a haberlo pulsado.
function ResumenDePrueba({ rows }) {
  const entran = rows.filter((fila) => fila.ok && !fila.alreadyImported);
  const yaEstaban = rows.filter((fila) => fila.alreadyImported);
  const falladas = rows.filter((fila) => !fila.ok && !fila.alreadyImported);

  const partes = [`${entran.length} de ${rows.length} entrarían`];
  if (yaEstaban.length > 0) {
    partes.push(`${yaEstaban.length} ya estaban importadas`);
  }
  if (falladas.length > 0) {
    partes.push(`${falladas.length} no entrarían`);
  }

  let consejo = null;
  if (falladas.length > 0) {
    consejo = (
      <p className="mapping-help">
        Una fila que no entra se reporta con su motivo y no se guarda a medias. Los dos motivos
        frecuentes tienen arreglo aquí mismo: una columna apuntada a un campo de otro tipo se
        corrige cambiándola, y un campo obligatorio con la celda vacía se resuelve dándole un
        valor en «Si viene vacía».
      </p>
    );
  }

  return (
    <div className="mapping-summary">
      <p className="mapping-summary-line">De la muestra: {partes.join(", ")}.</p>
      {consejo}
    </div>
  );
}

// Las primeras filas ya transformadas. Es lo que hace juzgable un mapeo: la pregunta «¿esta
// columna es el tiraje?» es sobre los datos, no sobre la regla.
function VistaPrevia({ rows }) {
  return (
    <div className="mapping-preview">
      <h4>Así se leerían las primeras filas</h4>
      <table className="mapping-table">
        <thead>
          <tr>
            <th>Fila</th>
            <th>Título</th>
            <th>Solicitante</th>
            <th>Estatus</th>
            <th>Datos</th>
            <th>Qué pasaría</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((fila) => (
            <FilaDePrueba fila={fila} key={fila.index} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Una fila de la prueba, con su veredicto.
function FilaDePrueba({ fila }) {
  let veredicto = "No entraría";
  if (fila.alreadyImported) {
    veredicto = "Ya está importada; se saltaría";
  } else if (fila.ok) {
    veredicto = "Entraría";
  }

  const claves = Object.keys(fila.data);

  return (
    <tr className="mapping-row">
      {/* +2: la fila 1 de la hoja es el encabezado */}
      <td>{fila.index + 2}</td>
      <td>{fila.title ?? "—"}</td>
      <td>{fila.requester ?? "—"}</td>
      <td>{fila.statusCode ?? "—"}</td>
      <td className="mapping-data">
        {claves.map((clave) => (
          <span className="mapping-value" key={clave}>
            {clave}: {String(fila.data[clave])}
          </span>
        ))}
      </td>
      <td>
        {veredicto}
        {fila.errors.map((problema) => (
          <p className="mapping-problem" key={`${problema.key}-${problema.message}`}>
            {problema.message}
          </p>
        ))}
        {fila.warnings.map((advertencia) => (
          <p className="mapping-help" key={`${advertencia.key}-${advertencia.message}`}>
            {advertencia.message}
          </p>
        ))}
      </td>
    </tr>
  );
}

function Mapping({ sheet, onGuardado, onCerrar }) {
  const [formatos, setFormatos] = useState([]);
  const [estatus, setEstatus] = useState([]);
  const [versionId, setVersionId] = useState("");

  // Las reglas, por destino: "title", "requester", "status" y cada clave de campo.
  const [reglas, setReglas] = useState({});
  const [hashColumns, setHashColumns] = useState([]);
  const [tablaEstatus, setTablaEstatus] = useState([]);

  const [headers, setHeaders] = useState([]);
  const [prueba, setPrueba] = useState(null);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      try {
        const [{ schemas }, { statuses }] = await Promise.all([
          api.listSchemas(),
          api.listStatuses(),
        ]);
        if (cancelado) return;
        const usables = schemas.filter((uno) => uno.isActive && uno.fields !== null);
        setFormatos(usables);
        setEstatus(statuses);

        // Un libro ya mapeado abre en su formato, con su mapeo cargado.
        const ya = usables.find(
          (uno) => String(uno.schemaVersionId) === String(sheet.schemaVersionId ?? ""),
        );
        if (ya) {
          const inicial = reglasDe(camposDe(ya), sheet.columnMap ?? {});
          setVersionId(String(ya.schemaVersionId));
          setReglas(inicial.reglas);
          setHashColumns(inicial.hashColumns);
          setTablaEstatus(inicial.tablaEstatus);
        }
      } catch (fallo) {
        if (!cancelado) {
          setError(fallo.message);
        }
      }
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, [sheet.schemaVersionId, sheet.columnMap]);

  // Los encabezados reales del libro, leídos en vivo: son las opciones de cada selector.
  useEffect(() => {
    let cancelado = false;

    async function leer() {
      try {
        const lectura = await api.previewSpreadsheet(sheet.id);
        if (cancelado) {
          return;
        }
        setHeaders(lectura.headers.map((header) => String(header ?? "")));
      } catch (fallo) {
        if (!cancelado) {
          setError(`No se pudo leer el libro: ${fallo.message}`);
        }
      }
    }

    leer();
    return () => {
      cancelado = true;
    };
  }, [sheet.id]);

  const formato = formatos.find((uno) => String(uno.schemaVersionId) === String(versionId));
  const campos = camposDe(formato);

  // Elegir formato rehace las reglas: son los campos de ese formato y de ningún otro.
  function elegirVersion(valor) {
    setVersionId(valor);
    setPrueba(null);

    const elegido = formatos.find((uno) => String(uno.schemaVersionId) === String(valor));

    // El mapeo guardado solo sirve para el formato al que el libro ya apunta; para otro formato se
    // empieza de cero, porque sus claves son otras.
    let guardado = {};
    if (String(sheet.schemaVersionId ?? "") === String(valor)) {
      guardado = sheet.columnMap ?? {};
    }

    const inicial = reglasDe(camposDe(elegido), guardado);
    setReglas(inicial.reglas);
    setHashColumns(inicial.hashColumns);
    setTablaEstatus(inicial.tablaEstatus);
  }

  function cambiarRegla(destino, cambios) {
    setReglas((actual) => ({ ...actual, [destino]: { ...actual[destino], ...cambios } }));
  }

  // Las reglas vacías no se mandan: un campo sin regla simplemente no se llena.
  function armarMapa() {
    const fields = {};
    for (const campo of campos) {
      const regla = limpiarRegla(reglas[campo.code]);
      if (regla !== undefined) {
        fields[campo.code] = regla;
      }
    }

    // La tabla de equivalencias viaja dentro de la regla de estatus, y solo las filas completas.
    const status = limpiarRegla(reglas.status);
    if (status !== undefined) {
      const equivalencias = {};
      for (const fila of tablaEstatus) {
        if (fila.texto !== "" && fila.code !== "") {
          equivalencias[fila.texto] = fila.code;
        }
      }
      if (Object.keys(equivalencias).length > 0) {
        status.map = equivalencias;
      }
    }

    let columnasDeHuella;
    if (hashColumns.length > 0) {
      columnasDeHuella = hashColumns;
    }

    return {
      version: 1,
      title: limpiarRegla(reglas.title),
      requester: limpiarRegla(reglas.requester),
      status,
      hashColumns: columnasDeHuella,
      fields,
    };
  }

  async function probar() {
    setOcupado(true);
    setError(null);
    setPrueba(null);
    try {
      const resultado = await api.previewSpreadsheetMapping(sheet.id, {
        columnMap: armarMapa(),
        schemaVersionId: Number(versionId),
      });
      setPrueba(resultado);
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setOcupado(false);
    }
  }

  async function guardar(evento) {
    evento.preventDefault();
    setOcupado(true);
    setError(null);
    try {
      await api.setSpreadsheetMapping(sheet.id, {
        schemaVersionId: Number(versionId),
        columnMap: armarMapa(),
        headers,
      });
      setAviso("Mapeo guardado. Ya se puede importar el libro.");
      onGuardado();
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setOcupado(false);
    }
  }

  let bloqueDeError = null;
  if (error !== null) {
    bloqueDeError = <p className="mapping-error">{error}</p>;
  }

  let bloqueDeAviso = null;
  if (aviso !== null) {
    bloqueDeAviso = <p className="mapping-notice">{aviso}</p>;
  }

  let textoDeProbar = "Probar con las primeras filas";
  if (ocupado) {
    textoDeProbar = "Probando...";
  }

  let vistaPrevia = null;
  let resumen = null;
  if (prueba !== null) {
    vistaPrevia = <VistaPrevia rows={prueba.rows} />;
    resumen = <ResumenDePrueba rows={prueba.rows} />;
  }

  return (
    <section className="mapping">
      <header className="mapping-header">
        <h3 className="mapping-title">Reglas del mapeo</h3>
        <button type="button" onClick={onCerrar}>
          Seguir a importar
        </button>
      </header>

      {bloqueDeAviso}

      {/* Cómo se importan los datos, dicho antes de pedir que se mapee nada: es la pregunta que
          la pantalla dejaba sin contestar. */}
      <details className="mapping-explainer" open>
        <summary>Cómo se importan los datos</summary>
        <ul>
          <li>
            Cada fila de la hoja se convierte en una solicitud. Una regla dice de qué columna sale
            cada dato; el <strong>tipo del campo destino</strong> decide cómo se lee ese dato, y
            eso no lo cambia el mapeo. La columna «Qué acepta el destino» lo dice campo por campo.
          </li>
          <li>
            Si una celda no corresponde al tipo —un texto donde va un número, algo que no es
            correo en un campo de correo— <strong>la fila no entra</strong>. Se reporta con su
            número de renglón y el motivo, y las demás filas sí entran: una hoja con dos errores
            importa el resto en lugar de detenerse.
          </li>
          <li>
            Una celda vacía en un campo opcional simplemente no se guarda. Vacía en un campo
            obligatorio rechaza la fila, <strong>a menos que le pongas un valor en «Si viene
            vacía»</strong>: ahí se decide qué pasa con las filas incompletas, que en una hoja
            llena a mano son varias.
          </li>
          <li>
            Las columnas que ninguna regla lee <strong>igual se guardan</strong>, tal como venían,
            junto a la solicitud: nada de la hoja se pierde.
          </li>
          <li>
            «Probar» no guarda nada. La importación tampoco escribe en el libro de Excel, y correr
            la importación dos veces no duplica: las filas ya importadas se reconocen y se saltan.
          </li>
        </ul>
      </details>

      <form onSubmit={guardar}>
        <label className="mapping-field">
          Formato al que se parecen las filas
          <select value={versionId} onChange={(e) => elegirVersion(e.target.value)} required>
            <option value="">Elige un formato</option>
            {formatos.map((uno) => (
              <option value={uno.schemaVersionId} key={uno.id}>
                {uno.name} (v{uno.version})
              </option>
            ))}
          </select>
        </label>

        {campos.length > 0 ? (
          <>
            <table className="mapping-table">
              <thead>
                <tr>
                  <th>Destino</th>
                  <th>De dónde</th>
                  <th>Qué columna</th>
                  <th>Cómo leerla</th>
                  <th>Si viene vacía</th>
                  <th>Qué acepta el destino</th>
                </tr>
              </thead>
              <tbody>
                <FilaDeRegla
                  etiqueta="Título"
                  ayuda="Obligatorio: la solicitud necesita uno."
                  acepta="Cualquier texto. Una fila con el título vacío no entra."
                  obligatorio
                  regla={reglas.title}
                  headers={headers}
                  onCambio={(cambios) => cambiarRegla("title", cambios)}
                />
                <FilaDeRegla
                  etiqueta="Entidad solicitante"
                  acepta="Cualquier texto. Se corrige después, al convertir en proyecto."
                  regla={reglas.requester}
                  headers={headers}
                  onCambio={(cambios) => cambiarRegla("requester", cambios)}
                />
                <FilaDeRegla
                  etiqueta="Estatus"
                  ayuda="Traduce el estatus de la hoja al catálogo, para que lo ya terminado no entre como nuevo."
                  acepta="Lo que diga la hoja, traducido con la tabla de equivalencias de abajo."
                  regla={reglas.status}
                  headers={headers}
                  onCambio={(cambios) => cambiarRegla("status", cambios)}
                />
                {campos.map((campo) => (
                  <FilaDeRegla
                    key={campo.code}
                    etiqueta={`${campo.name}${campo.required ? " *" : ""}`}
                    ayuda={campo.note || null}
                    tipo={campo.type}
                    acepta={aceptaDe(campo)}
                    obligatorio={campo.required === true}
                    regla={reglas[campo.code]}
                    headers={headers}
                    onCambio={(cambios) => cambiarRegla(campo.code, cambios)}
                  />
                ))}
              </tbody>
            </table>

            {reglas.status?.op ? (
              <fieldset className="mapping-status">
                <legend>Qué significa cada estatus de la hoja</legend>
                {tablaEstatus.map((fila, indice) => (
                  <div className="mapping-pair" key={indice}>
                    <input
                      className="mapping-input"
                      value={fila.texto}
                      onChange={(e) =>
                        setTablaEstatus((actual) =>
                          actual.map((otra, i) => (i === indice ? { ...otra, texto: e.target.value } : otra)),
                        )
                      }
                      placeholder="Como lo dice la hoja: VoBo"
                    />
                    <select
                      className="mapping-input"
                      value={fila.code}
                      onChange={(e) =>
                        setTablaEstatus((actual) =>
                          actual.map((otra, i) => (i === indice ? { ...otra, code: e.target.value } : otra)),
                        )
                      }
                    >
                      <option value="">Elige un estatus</option>
                      {estatus.map((uno) => (
                        <option value={uno.code} key={uno.id}>
                          {uno.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setTablaEstatus((actual) => actual.filter((_, i) => i !== indice))}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setTablaEstatus((actual) => [...actual, { texto: "", code: "" }])}
                >
                  Agregar equivalencia
                </button>
              </fieldset>
            ) : null}

            <fieldset className="mapping-hash">
              <legend>Cómo se reconoce una fila ya importada</legend>
              <p className="mapping-help">
                Si la hoja trae una columna de identificador (como el «Id» de Formularios), esa
                sola es la mejor: corregir una celda deja de parecer una fila nueva. Sin ninguna
                marcada se usan todas las columnas mapeadas, y entonces una corrección entra otra
                vez marcada como posible duplicado.
              </p>
              <div className="mapping-columns">
                {headers.map((header, indice) => (
                  <label className="mapping-column" key={`${header}-${indice}`}>
                    <input
                      type="checkbox"
                      checked={hashColumns.includes(header)}
                      onChange={(e) =>
                        setHashColumns((actual) =>
                          e.target.checked
                            ? [...actual, header]
                            : actual.filter((otra) => otra !== header),
                        )
                      }
                    />
                    {header === "" ? `(columna ${indice + 1})` : header}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mapping-actions">
              <button type="button" onClick={probar} disabled={ocupado || versionId === ""}>
                {textoDeProbar}
              </button>
              <button type="submit" disabled={ocupado || versionId === ""}>
                Guardar mapeo
              </button>
            </div>

            {/* El rechazo del servidor va aquí, no arriba: el botón está al final de una lista
                larga y un mensaje a treinta casillas de distancia no se ve. */}
            {bloqueDeError}
            {resumen}
          </>
        ) : null}
      </form>

      {vistaPrevia}
    </section>
  );
}

export default Mapping;
