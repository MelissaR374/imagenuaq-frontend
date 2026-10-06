// Los formatos de solicitud (RF-SOL-01). Un formato es la identidad; lo que pide vive en sus
// versiones, y una versión publicada no se edita: «editar» es publicar la siguiente, para que lo
// capturado con la anterior siga leyéndose como se capturó.
//
// La lista es ligera a propósito: no tiene botones por renglón, porque un formato se abre y todo
// lo que se le puede hacer vive adentro, junto a lo que va a cambiar. Las versiones se dicen en
// una línea discreta bajo el nombre: importan al actualizar y al mirar atrás, no al elegir.
//
// Lo que cada formato trae en uso —cuántas solicitudes se capturaron con él y cuántos libros de
// Excel lo tienen mapeado— sale del servidor, porque es lo que vuelve concreta la advertencia de
// publicar: las solicitudes de antes se siguen leyendo con su versión y un libro se queda en la
// suya hasta que alguien lo remapee.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import { fechaCorta } from "../shared/formato.js";
import SchemaFormat from "./schemaFormat.jsx";
import "./schemas.css";

const PESTANAS = [
  {
    clave: "activos",
    etiqueta: "Activos",
    regla: "Los que se pueden elegir al capturar una solicitud.",
  },
  {
    clave: "inactivos",
    etiqueta: "Inactivos",
    regla:
      "Ya no se ofrecen al capturar. Nada se borra: lo capturado con ellos se sigue leyendo.",
  },
];

/** Cuántos campos pide un formato, de qué tipo y cuántos obligatorios. */
function cuentaDeCampos(formato) {
  if (formato.fields === null || formato.fields === undefined) {
    return "Sin versión publicada";
  }
  const entrega = formato.fields.deliverables;
  const informacion = formato.fields.information;
  const total = entrega.length + informacion.length;
  const obligatorios = [...entrega, ...informacion].filter((campo) => campo.required).length;

  return `${total} ${total === 1 ? "campo" : "campos"} · ${obligatorios} ${
    obligatorios === 1 ? "obligatorio" : "obligatorios"
  } · ${entrega.length} de entrega`;
}

/** En qué se está usando: lo que vuelve concreta la advertencia de publicar una versión. */
function uso(formato) {
  const partes = [];
  if (formato.requestCount > 0) {
    partes.push(
      `${formato.requestCount} ${formato.requestCount === 1 ? "solicitud" : "solicitudes"}`,
    );
  }
  if (formato.sheetCount > 0) {
    partes.push(
      `${formato.sheetCount} ${formato.sheetCount === 1 ? "libro de Excel" : "libros de Excel"}`,
    );
  }
  if (partes.length === 0) {
    return "Sin uso todavía";
  }
  return partes.join(" · ");
}

function FilaDeFormato({ formato, onAbrir }) {
  return (
    <tr className="schemas-row" onClick={() => onAbrir(formato)}>
      <td className="schemas-cell-main">
        <span className="schemas-code">{formato.code}</span>
        <span className="schemas-row-name">{formato.name}</span>
        <span className="schemas-version-line">
          {formato.version === null ? "Sin versión" : `Versión ${formato.version}`}
          {formato.publishedAt === null ? "" : ` · ${fechaCorta(formato.publishedAt)}`}
          {formato.publishedByName === null ? "" : ` · ${formato.publishedByName}`}
        </span>
      </td>
      <td>{cuentaDeCampos(formato)}</td>
      <td>{uso(formato)}</td>
    </tr>
  );
}

function Schemas() {
  const [formatos, setFormatos] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [vocabulario, setVocabulario] = useState([]);
  const [pestana, setPestana] = useState("activos");
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(null);
  const [nuevo, setNuevo] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      try {
        const [formatosRes, tiposRes, clavesRes] = await Promise.all([
          api.listSchemas(),
          api.listDataTypes(),
          api.listFieldKeys(),
        ]);
        if (cancelado) return;
        setFormatos(formatosRes.schemas);
        setTipos(tiposRes.dataTypes);
        setVocabulario(clavesRes.fieldKeys);
      } catch (fallo) {
        if (!cancelado) setError(fallo.message);
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, []);

  async function recargar() {
    try {
      const [{ schemas }, { fieldKeys }] = await Promise.all([
        api.listSchemas(),
        api.listFieldKeys(),
      ]);
      setFormatos(schemas);
      setVocabulario(fieldKeys);
      return schemas;
    } catch (fallo) {
      setError(fallo.message);
      return formatos;
    }
  }

  /** Al publicar o clonar, el formato abierto se queda abierto con lo que ya quedó guardado. */
  async function alCambiar(id) {
    const lista = await recargar();
    if (id === undefined || id === null) {
      return;
    }
    const encontrado = lista.find((uno) => uno.id === id);
    if (encontrado !== undefined) {
      setAbierto(encontrado);
      setNuevo(false);
    }
  }

  if (nuevo || abierto !== null) {
    return (
      <SchemaFormat
        formato={nuevo ? null : abierto}
        formatos={formatos}
        tipos={tipos}
        vocabulario={vocabulario}
        onCambio={alCambiar}
        onCerrar={() => {
          setAbierto(null);
          setNuevo(false);
          recargar();
        }}
        key={nuevo ? "nuevo" : abierto.id}
      />
    );
  }

  const activa = PESTANAS.find((una) => una.clave === pestana) ?? PESTANAS[0];
  const texto = busqueda.trim().toLowerCase();
  const visibles = formatos.filter((formato) => {
    if (formato.isActive !== (pestana === "activos")) {
      return false;
    }
    if (texto === "") {
      return true;
    }
    return (
      formato.name.toLowerCase().includes(texto) || formato.code.toLowerCase().includes(texto)
    );
  });

  return (
    <section className="schemas">
      {error !== null ? <p className="schemas-error">{error}</p> : null}

      <div className="schemas-bar">
        <div className="schemas-tabs">
          {PESTANAS.map((una) => {
            const cuenta = formatos.filter(
              (formato) => formato.isActive === (una.clave === "activos"),
            ).length;
            return (
              <button
                className={una.clave === pestana ? "schemas-tab is-active" : "schemas-tab"}
                type="button"
                onClick={() => setPestana(una.clave)}
                key={una.clave}
              >
                {una.etiqueta}
                <span className="schemas-tab-count">{cuenta}</span>
              </button>
            );
          })}
        </div>

        <button
          className="schemas-btn schemas-btn-primary"
          type="button"
          onClick={() => setNuevo(true)}
        >
          Nuevo formato
        </button>
      </div>

      <p className="schemas-rule">{activa.regla}</p>

      <div className="schemas-filters">
        <div className="schemas-search">
          <input
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Ej: nombre o clave"
            aria-label="Buscar"
          />
        </div>
      </div>

      <div className="schemas-table-wrap">
        <table className="schemas-table">
          <thead>
            <tr>
              <th>Formato</th>
              <th>Qué pide</th>
              <th>En uso</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((formato) => (
              <FilaDeFormato formato={formato} onAbrir={setAbierto} key={formato.id} />
            ))}

            {!cargando && visibles.length === 0 ? (
              <tr>
                <td colSpan={3}>
                  <p className="schemas-empty">
                    {texto === ""
                      ? `Nada en «${activa.etiqueta}».`
                      : "Ningún formato coincide con lo que buscas."}
                  </p>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default Schemas;
