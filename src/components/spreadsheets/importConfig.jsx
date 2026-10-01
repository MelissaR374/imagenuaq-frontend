// «Configuración de formatos de solicitud»: el mapeo de las columnas de un libro a un formato, y
// la importación (RF-MIG-02).
//
// Es la pestaña que el menú ya nombraba y que no tenía pantalla. La división entre las dos
// pestañas es la que el propio menú describe: «Formatos de solicitud» da de alta la cuenta y el
// libro —qué se lee y con qué permiso—, y aquí se decide qué significan sus columnas. Son dos
// trabajos distintos, de dos momentos distintos: registrar pasa una vez, mapear se ajusta cada vez
// que la hoja cambia.
//
// Se elige el libro primero porque el mapeo no existe sin uno: cada libro tiene los suyos.
/** En qué va cada libro, en las mismas palabras y colores que usa la canalización. */
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import { fechaCorta } from "../shared/formato.js";
import ImportPipeline from "./importPipeline.jsx";
import "./importConfig.css";

function estadoDelLibro(hoja) {
  if (!hoja.mapped) {
    return { texto: "Sin mapear", clase: "is-pendiente" };
  }
  if (hoja.lastImportedAt === null) {
    return { texto: "Mapeado, sin importar", clase: "is-listo" };
  }
  return { texto: `Importado el ${fechaCorta(hoja.lastImportedAt)}`, clase: "is-hecho" };
}

/**
 * Un libro en la lista para elegir. Lleva lo que hace falta para decidir si es éste: su nombre, la
 * hoja dentro del libro, la cuenta con la que se lee y en qué va.
 */
function LibroElegible({ hoja, onElegir }) {
  const estado = estadoDelLibro(hoja);

  let accion = "Configurar el mapeo";
  if (hoja.mapped) {
    accion = "Ver y ajustar";
  }

  let cuenta = hoja.accountEmail;
  if (hoja.accountRevoked) {
    cuenta = `${hoja.accountEmail} — desconectada`;
  }

  return (
    <li className="config-book">
      <button type="button" className="config-book-button" onClick={() => onElegir(hoja)}>
        <span className="config-book-main">
          <span className="config-book-name">{hoja.name}</span>
          <span className="config-book-meta">
            <span className="spreadsheets-tag">{hoja.tableName ?? "primera hoja"}</span>
            {cuenta}
          </span>
        </span>
        <span className="config-book-side">
          <span className={`config-book-state ${estado.clase}`}>{estado.texto}</span>
          <span className="config-book-action">{accion}</span>
        </span>
      </button>
    </li>
  );
}

function ImportConfig() {
  const [libros, setLibros] = useState([]);
  const [elegido, setElegido] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      setCargando(true);
      try {
        const respuesta = await api.listSpreadsheets();
        if (!cancelado) {
          setLibros(respuesta.sheets);
        }
      } catch (fallo) {
        if (!cancelado) {
          setError(fallo.message);
        }
      } finally {
        if (!cancelado) {
          setCargando(false);
        }
      }
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, [recarga]);

  function elegir(hoja) {
    setError(null);
    setElegido(hoja);
  }

  function volverALaLista() {
    setElegido(null);
    setRecarga(recarga + 1);
  }

  function recargar() {
    setRecarga(recarga + 1);
  }

  if (cargando) {
    return <p className="config-loading">Cargando...</p>;
  }

  if (elegido !== null) {
    const vigente = libros.find((hoja) => hoja.id === elegido.id) ?? elegido;
    return (
      <ImportPipeline
        key={vigente.id}
        sheet={vigente}
        onCerrar={volverALaLista}
        onCambio={recargar}
      />
    );
  }

  let bloqueDeError = null;
  if (error !== null) {
    bloqueDeError = <p className="config-error">{error}</p>;
  }

  let lista;
  if (libros.length === 0) {
    lista = (
      <p className="config-empty">
        No hay libros registrados todavía. Primero se da de alta el libro y la cuenta con la que se
        lee, en «Formatos de solicitud»; aquí se decide qué significan sus columnas.
      </p>
    );
  } else {
    lista = (
      <ul className="config-books">
        {libros.map((hoja) => (
          <LibroElegible hoja={hoja} onElegir={elegir} key={hoja.id} />
        ))}
      </ul>
    );
  }

  return (
    <section className="config">
      <header className="config-header">
        <h1 className="config-title">Configuración de formatos de solicitud</h1>
        <p className="config-count">
          {libros.length} libro{libros.length === 1 ? "" : "s"} registrado
          {libros.length === 1 ? "" : "s"}
        </p>
      </header>

      <p className="config-intro">
        Aquí se dice a qué formato se parecen las filas de un libro de Excel y qué columna alimenta
        cada campo, sin tocar código. Con eso, cada fila nueva se vuelve una solicitud con folio.
      </p>

      {bloqueDeError}
      {lista}
    </section>
  );
}

export default ImportConfig;
