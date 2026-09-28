import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import Mapping from "./mapping.jsx";
import "./importPipeline.css";

// La canalización de importación de un libro, de principio a fin (RF-MIG-01, RF-MIG-02).
//
// Antes esto vivía dentro de una celda de la tabla de libros: mapear, importar y el historial se
// expandían bajo el renglón, uno encima de otro, sin que nada dijera en qué orden van ni en cuál
// va este libro. Aquí el libro se abre y ocupa la pantalla, con su identidad fija arriba y las
// etapas como un riel: el recorrido es de DATAMODEL.md §8.2, pasos 1b a 2.
//
// Las tres primeras etapas son estados que el libro sí conoce —está registrado, tiene mapeo, se
// importó alguna vez—. La cuarta no: repartir pasa en la bandeja, sobre las solicitudes, no sobre
// el libro. Se muestra como entrega y no como palomita, porque afirmar aquí que ya se repartió
// sería inventarlo.

const ETAPAS = [
  {
    clave: "registro",
    numero: 1,
    titulo: "Registrado",
    resumen: "Qué libro se lee y con qué cuenta.",
  },
  {
    clave: "mapeo",
    numero: 2,
    titulo: "Mapeado",
    resumen: "A qué formato se parecen las filas y qué columna alimenta cada campo.",
  },
  {
    clave: "importacion",
    numero: 3,
    titulo: "Importado",
    resumen: "Cada fila nueva se vuelve una solicitud con folio.",
  },
  {
    clave: "reparto",
    numero: 4,
    titulo: "Repartido",
    resumen: "Lo importado llega sin área y se reparte desde la bandeja.",
  },
];

// La letra de columna de Excel para un índice base cero: 0 → A, 25 → Z, 26 → AA.
function letraDeColumna(indice) {
  let letra = "";
  let n = indice;
  while (n >= 0) {
    letra = String.fromCharCode(65 + (n % 26)) + letra;
    n = Math.floor(n / 26) - 1;
  }
  return letra;
}

function fechaLarga(valor) {
  return new Date(valor).toLocaleString();
}

// En qué está cada etapa. `hecho` pinta la palomita; `actual` es la que toca.
function estadoDeEtapas(sheet, abierta) {
  const hechos = {
    registro: true,
    mapeo: sheet.mapped,
    importacion: sheet.lastImportedAt !== null,
    reparto: false,
  };

  let laQueToca = "reparto";
  if (!sheet.mapped) {
    laQueToca = "mapeo";
  } else if (sheet.lastImportedAt === null) {
    laQueToca = "importacion";
  }

  return ETAPAS.map((etapa) => {
    let estado = "pendiente";
    if (hechos[etapa.clave]) {
      estado = "hecho";
    }
    if (etapa.clave === laQueToca && estado !== "hecho") {
      estado = "toca";
    }
    return { ...etapa, estado, abierta: etapa.clave === abierta };
  });
}

// El riel. Cada etapa es un botón: abre su panel sin perder de vista las demás.
function Riel({ etapas, onAbrir }) {
  return (
    <ol className="pipeline-rail">
      {etapas.map((etapa) => {
        const clases = ["pipeline-step", `is-${etapa.estado}`];
        if (etapa.abierta) {
          clases.push("is-open");
        }

        let marca = etapa.numero;
        if (etapa.estado === "hecho") {
          marca = "✓";
        }

        return (
          <li className={clases.join(" ")} key={etapa.clave}>
            <button type="button" className="pipeline-step-button" onClick={() => onAbrir(etapa.clave)}>
              <span className="pipeline-step-mark">{marca}</span>
              <span className="pipeline-step-text">
                <span className="pipeline-step-title">{etapa.titulo}</span>
                <span className="pipeline-step-summary">{etapa.resumen}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// La hoja como se ve en Excel: los encabezados son el renglón 1 y debajo van las de muestra. El
// teal es el color que este sistema reserva para la hoja de cálculo, aquí y en el mapeo.
function CuadriculaDeLaHoja({ vista }) {
  const columnas = vista.headers;

  return (
    <div className="sheet-preview">
      <div className="sheet-preview-head">
        <span className="sheet-preview-label">{vista.kind === "table" ? "Tabla" : "Hoja"}</span>
        <span className="sheet-preview-name">{vista.name}</span>
        <span className="sheet-preview-count">
          {columnas.length} columna{columnas.length === 1 ? "" : "s"} · {vista.rows.length} fila
          {vista.rows.length === 1 ? "" : "s"} de muestra
        </span>
      </div>
      <div className="sheet-preview-scroll">
        <table className="sheet-preview-grid">
          <thead>
            <tr>
              <th className="sheet-preview-corner" />
              {columnas.map((_, indice) => (
                <th className="sheet-preview-col" key={indice}>
                  {letraDeColumna(indice)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th className="sheet-preview-row">1</th>
              {columnas.map((encabezado, indice) => (
                <td className="sheet-preview-cell sheet-preview-cell--header" key={indice}>
                  {String(encabezado) || "(vacío)"}
                </td>
              ))}
            </tr>
            {vista.rows.map((fila, renglon) => (
              <tr key={renglon}>
                <th className="sheet-preview-row">{renglon + 2}</th>
                {/* Se recorren los encabezados para que cada fila tenga las mismas celdas */}
                {columnas.map((_, columna) => (
                  <td className="sheet-preview-cell" key={columna}>
                    {fila[columna] == null ? "" : String(fila[columna])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Etapa 1. Lo que se sabe del libro sin llamar a Microsoft, y la hoja en vivo si se pide.
function PanelDeRegistro({ sheet, vista, cargando, onVer }) {
  let cuadricula = null;
  if (vista !== null) {
    cuadricula = <CuadriculaDeLaHoja vista={vista} />;
  }

  let textoDelBoton = "Ver la hoja";
  if (vista !== null) {
    textoDelBoton = "Ocultar la hoja";
  }
  if (cargando) {
    textoDelBoton = "Leyendo...";
  }

  let cuenta = sheet.accountEmail;
  if (sheet.accountRevoked) {
    cuenta = `${sheet.accountEmail} (desconectada: hay que volver a conectarla)`;
  }

  let ultima = "Nunca";
  if (sheet.lastImportedAt !== null) {
    ultima = fechaLarga(sheet.lastImportedAt);
  }

  return (
    <div className="pipeline-body">
      <dl className="pipeline-facts">
        <dt>Se lee como</dt>
        <dd>{cuenta}</dd>

        <dt>Dentro del libro</dt>
        <dd>{sheet.tableName ?? "la primera hoja"}</dd>

        <dt>Lo registró</dt>
        <dd>{sheet.registeredByName ?? "—"}</dd>

        <dt>Última importación</dt>
        <dd>{ultima}</dd>
      </dl>

      <p className="pipeline-note">
        El libro se lee con el permiso de quien conectó la cuenta, nunca con uno del sistema: si
        esa cuenta se desconecta, deja de poder leerse hasta que se vuelva a conectar.
      </p>

      <div className="pipeline-actions">
        <button type="button" className="pipeline-button-ghost" onClick={onVer} disabled={cargando}>
          {textoDelBoton}
        </button>
      </div>

      {cuadricula}
    </div>
  );
}

// Etapa 3. Correr la importación, el resumen de la corrida y el historial.
function PanelDeImportacion({ sheet, corrida, corridas, importando, onImportar, onProbarEnSeco }) {
  if (!sheet.mapped) {
    return (
      <div className="pipeline-body">
        <p className="pipeline-blocked">
          Este libro todavía no tiene mapeo, así que no hay nada que importar. Ve a la etapa 2 y
          di a qué formato se parecen sus filas.
        </p>
      </div>
    );
  }

  if (corrida !== null) {
    const partes = [
      `${corrida.rowsCreated} nueva${corrida.rowsCreated === 1 ? "" : "s"}`,
      `${corrida.rowsSkipped} ya estaba${corrida.rowsSkipped === 1 ? "" : "n"}`,
    ];
    if (corrida.rowsFailed > 0) {
      partes.push(`${corrida.rowsFailed} con error`);
    }
    if (corrida.rowsFlagged > 0) {
      partes.push(`${corrida.rowsFlagged} como posible duplicado`);
    }

    let aviso = null;
    if (corrida.truncated) {
      aviso = (
        <p className="pipeline-warning">
          El libro es más largo de lo que se lee en una corrida: vuelve a importar para traer el
          resto.
        </p>
      );
    }

    let errores = null;
    if (corrida.errors.length > 0) {
      errores = (
        <ul className="pipeline-errors">
          {corrida.errors.map((fallo) => (
            <li key={fallo.index}>
              {/* +2: el renglón 1 de la hoja es el encabezado */}
              Renglón {fallo.index + 2}: {fallo.message}
            </li>
          ))}
        </ul>
      );
    }

    let leyenda = "Corrida";
    if (corrida.dryRun) {
      leyenda = "Ensayo, no se guardó nada";
    }

    return (
      <div className="pipeline-body">
        <div className="pipeline-run">
          <span className="pipeline-run-label">{leyenda}</span>
          <p className="pipeline-run-line">
            {corrida.rowsRead} fila{corrida.rowsRead === 1 ? "" : "s"} leída
            {corrida.rowsRead === 1 ? "" : "s"}: {partes.join(", ")}.
          </p>
          {aviso}
          {errores}
        </div>
        <Acciones
          importando={importando}
          onImportar={onImportar}
          onProbarEnSeco={onProbarEnSeco}
        />
        <Historial corridas={corridas} />
      </div>
    );
  }

  return (
    <div className="pipeline-body">
      <p className="pipeline-note">
        Cada fila que no se haya importado antes se vuelve una solicitud con folio. Una fila que ya
        entró se reconoce y se salta, así que correr esto dos veces no duplica nada. No se escribe
        nada en el libro de Excel.
      </p>
      <Acciones importando={importando} onImportar={onImportar} onProbarEnSeco={onProbarEnSeco} />
      <Historial corridas={corridas} />
    </div>
  );
}

function Acciones({ importando, onImportar, onProbarEnSeco }) {
  let texto = "Importar las filas nuevas";
  if (importando) {
    texto = "Importando...";
  }

  return (
    <div className="pipeline-actions">
      <button type="button" className="pipeline-button" onClick={onImportar} disabled={importando}>
        {texto}
      </button>
      <button
        type="button"
        className="pipeline-button-ghost"
        onClick={onProbarEnSeco}
        disabled={importando}
      >
        Contar sin guardar
      </button>
    </div>
  );
}

function Historial({ corridas }) {
  if (corridas === null) {
    return null;
  }

  if (corridas.length === 0) {
    return <p className="pipeline-note">Este libro no se ha importado todavía.</p>;
  }

  return (
    <div className="pipeline-history">
      <h4 className="pipeline-history-title">Corridas anteriores</h4>
      <table className="pipeline-table">
        <thead>
          <tr>
            <th>Cuándo</th>
            <th>Quién</th>
            <th>Leídas</th>
            <th>Nuevas</th>
            <th>Ya estaban</th>
            <th>Con error</th>
          </tr>
        </thead>
        <tbody>
          {corridas.map((una) => (
            <tr key={una.id}>
              <td>{fechaLarga(una.startedAt)}</td>
              <td>{una.runByName ?? "—"}</td>
              <td>{una.rowsRead}</td>
              <td>{una.rowsCreated}</td>
              <td>{una.rowsSkipped}</td>
              <td>{una.rowsFailed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Etapa 4. No es un estado del libro: es dónde sigue el trabajo.
function PanelDeReparto({ sheet }) {
  let cuando = "todavía no se ha importado";
  if (sheet.lastImportedAt !== null) {
    cuando = `la última vez el ${fechaLarga(sheet.lastImportedAt)}`;
  }

  return (
    <div className="pipeline-body">
      <p className="pipeline-note">
        Las solicitudes que salen de este libro llegan <strong>sin área</strong>: el libro no sabe
        a quién le toca atenderlas. Se reparten a mano en la bandeja de solicitudes, filtrando por
        «Sin área»; mientras no tengan una, nadie las ve en su bandeja.
      </p>
      <p className="pipeline-note">
        Este libro {cuando}. El reparto no se puede dar por hecho desde aquí, porque pasa sobre las
        solicitudes y no sobre el libro.
      </p>
    </div>
  );
}

// La etapa con la que abre el libro: la que toca. Se calcula al montar y desde ahí la manda quien
// usa la pantalla --- no es algo que haya que volver a sincronizar en cada render.
function etapaInicial(sheet) {
  if (!sheet.mapped) {
    return "mapeo";
  }
  if (sheet.lastImportedAt === null) {
    return "importacion";
  }
  return "registro";
}

function ImportPipeline({ sheet, onCerrar, onCambio }) {
  const [abierta, setAbierta] = useState(() => etapaInicial(sheet));
  const [vista, setVista] = useState(null);
  const [cargandoVista, setCargandoVista] = useState(false);
  const [corrida, setCorrida] = useState(null);
  const [corridas, setCorridas] = useState(null);
  const [importando, setImportando] = useState(false);
  const [error, setError] = useState(null);

  // El historial se pide una vez y se refresca tras cada corrida.
  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      try {
        const respuesta = await api.listSpreadsheetImports(sheet.id);
        if (!cancelado) {
          setCorridas(respuesta.imports);
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
  }, [sheet.id]);

  async function refrescarHistorial() {
    try {
      const respuesta = await api.listSpreadsheetImports(sheet.id);
      setCorridas(respuesta.imports);
    } catch (fallo) {
      setError(fallo.message);
    }
  }

  async function verLaHoja() {
    if (vista !== null) {
      setVista(null);
      return;
    }

    setError(null);
    setCargandoVista(true);
    try {
      const datos = await api.previewSpreadsheet(sheet.id);
      setVista(datos);
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setCargandoVista(false);
    }
  }

  async function correr(dryRun) {
    setError(null);
    setCorrida(null);
    setImportando(true);
    try {
      const respuesta = await api.importSpreadsheet(sheet.id, { dryRun });
      setCorrida({ ...respuesta.import, dryRun });
      if (!dryRun) {
        await refrescarHistorial();
        onCambio();
      }
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setImportando(false);
    }
  }

  function importar() {
    correr(false);
  }

  function probarEnSeco() {
    correr(true);
  }

  function guardadoElMapeo() {
    onCambio();
  }

  const etapas = estadoDeEtapas(sheet, abierta);

  let bloqueDeError = null;
  if (error !== null) {
    bloqueDeError = <p className="pipeline-error">{error}</p>;
  }

  let nombre = sheet.name;
  if (sheet.webUrl) {
    nombre = (
      <a href={sheet.webUrl} target="_blank" rel="noreferrer">
        {sheet.name}
      </a>
    );
  }

  let panel = null;
  if (abierta === "registro") {
    panel = (
      <PanelDeRegistro
        sheet={sheet}
        vista={vista}
        cargando={cargandoVista}
        onVer={verLaHoja}
      />
    );
  }
  if (abierta === "mapeo") {
    panel = (
      <Mapping sheet={sheet} onGuardado={guardadoElMapeo} onCerrar={() => setAbierta("importacion")} />
    );
  }
  if (abierta === "importacion") {
    panel = (
      <PanelDeImportacion
        sheet={sheet}
        corrida={corrida}
        corridas={corridas}
        importando={importando}
        onImportar={importar}
        onProbarEnSeco={probarEnSeco}
      />
    );
  }
  if (abierta === "reparto") {
    panel = <PanelDeReparto sheet={sheet} />;
  }

  return (
    <section className="pipeline">
      <header className="pipeline-header">
        <div className="pipeline-identity">
          <h2 className="pipeline-title">{nombre}</h2>
          <p className="pipeline-subtitle">
            <span className="spreadsheets-tag">{sheet.tableName ?? "primera hoja"}</span>
            {sheet.accountEmail}
          </p>
        </div>
        <button type="button" className="pipeline-back" onClick={onCerrar}>
          Volver a los libros
        </button>
      </header>

      {bloqueDeError}

      <Riel etapas={etapas} onAbrir={setAbierta} />

      <div className="pipeline-panel">{panel}</div>
    </section>
  );
}

export default ImportPipeline;
