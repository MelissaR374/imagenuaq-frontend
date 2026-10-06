// Los libros de Excel registrados (RF-MIG-01): lo que la gente viene a hacer aquí.
//
// Los libros van primero y la conexión con Microsoft es una línea: el registro de aplicación de
// Azure y la cuenta se tocan una vez, y antes ocupaban la pantalla entera cada visita. Solo en la
// primera vez, cuando todavía no hay nada conectado, la línea se vuelve dos pasos de verdad.
//
// Lo que se hace *con* un libro --- mapearlo, importarlo, ver sus corridas --- no está aquí: vive
// en «Importar de Excel». Son dos trabajos de dos momentos: dar de alta el libro pasa una vez, y
// el mapeo se ajusta cada vez que la hoja cambia.
//
// Los libros se leen con el acceso delegado de una persona, así que una cuenta revocada detiene
// todos los libros que se leen con ella hasta que alguien la reconecte: por eso una cuenta
// desconectada se dice en ámbar en el renglón del libro, y desconectarla avisa de cuántos libros
// depende.
import { Fragment, useEffect, useState } from "react";

import * as api from "../../api/client.js";
import { fechaCorta, letraDeColumna } from "../shared/formato.js";
import Ayuda from "../shared/ayuda.jsx";
import { MICROSOFT_PARAM } from "../../config.js";
import "./spreadsheets.css";

/**
 * Por qué no se pudo conectar, en palabras. El servidor manda el código de Microsoft, que no le
 * dice nada a nadie; lo que importa es si se puede volver a intentar o hay que hablar con quien
 * administra.
 */
const MOTIVOS = {
  access_denied: "No se otorgó el permiso en la pantalla de Microsoft.",
  invalid_grant: "El permiso venció antes de terminar. Vuelve a intentarlo.",
  invalid_client: "El registro de aplicación de Azure no es válido: revísalo aquí abajo.",
  not_configured: "Todavía no hay un registro de aplicación de Azure guardado.",
  state_mismatch: "La vuelta de Microsoft no correspondía a esta sesión. Vuelve a intentarlo.",
};

/** Lo que dejó el servidor en la URL al volver de Microsoft, o null si no venimos de ahí. */
function resultadoEnLaUrl() {
  const params = new URLSearchParams(window.location.search);
  const resultado = params.get(MICROSOFT_PARAM);
  if (!resultado) return null;

  return { ok: resultado === "connected", reason: params.get("reason") };
}

const FORMULARIO_VACIO = { accountId: "", url: "", tableName: "", name: "" };

/**
 * El formulario del registro de aplicación de Azure. El secreto siempre empieza vacío: el
 * servidor nunca lo devuelve, y vacío significa «conservar el que ya está».
 */
const APP_VACIA = { tenantId: "common", clientId: "", clientSecret: "" };

/** Cómo salió la última importación, en una frase. */
function ultimaImportacion(libro) {
  if (libro.markedRows > 0 && libro.lastImport === null) {
    return `${libro.markedRows} filas marcadas como ya atendidas`;
  }
  if (libro.lastImport === null) {
    return "Nunca se ha importado";
  }

  const partes = [fechaCorta(libro.lastImport.finishedAt)];
  partes.push(
    `${libro.lastImport.created} ${libro.lastImport.created === 1 ? "nueva" : "nuevas"}`,
  );
  if (libro.lastImport.failed > 0) {
    partes.push(`${libro.lastImport.failed} con error`);
  }
  return partes.join(" · ");
}

/**
 * El libro como lo muestra Excel: letras de columna, números de fila y el encabezado teñido.
 *
 * Las filas vienen por posición, no por nombre de columna: Graph devuelve un arreglo por renglón
 * y el encabezado es el renglón 1, así que la celda se busca por su índice.
 */
function Vista({ vista, cargando }) {
  if (cargando) {
    return <p className="books-note">Leyendo el libro…</p>;
  }
  if (vista === null) {
    return null;
  }

  return (
    <div className="books-sheet-wrap">
      <table className="books-sheet">
        <thead>
          <tr>
            <th className="books-sheet-corner" />
            {vista.headers.map((_, indice) => (
              <th key={indice}>{letraDeColumna(indice)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="books-sheet-headers">
            <th>1</th>
            {vista.headers.map((encabezado, indice) => (
              <td key={indice}>{encabezado}</td>
            ))}
          </tr>
          {vista.rows.map((fila, indice) => (
            <tr key={indice}>
              <th>{indice + 2}</th>
              {vista.headers.map((_, columna) => (
                <td key={columna}>{String(fila[columna] ?? "")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Spreadsheets({ onIr = null }) {
  const [cuentas, setCuentas] = useState([]);
  const [libros, setLibros] = useState([]);
  const [app, setApp] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [recarga, setRecarga] = useState(0);
  const [aviso, setAviso] = useState(resultadoEnLaUrl);

  const [verConexion, setVerConexion] = useState(false);
  const [editandoApp, setEditandoApp] = useState(false);
  const [formApp, setFormApp] = useState(APP_VACIA);
  const [errorApp, setErrorApp] = useState(null);
  const [guardandoApp, setGuardandoApp] = useState(false);
  const [confirmando, setConfirmando] = useState(null);

  const [registrando, setRegistrando] = useState(false);
  const [form, setForm] = useState(FORMULARIO_VACIO);
  const [encontrado, setEncontrado] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState(null);

  const [abierto, setAbierto] = useState(null);
  const [vista, setVista] = useState(null);
  const [cargandoVista, setCargandoVista] = useState(false);

  useEffect(() => {
    if (!aviso) return;
    const limpia = window.location.pathname + window.location.hash;
    window.history.replaceState(null, "", limpia);
  }, [aviso]);

  useEffect(() => {
    let cancelado = false;

    Promise.all([api.getMicrosoftApp(), api.listMicrosoftAccounts(), api.listSpreadsheets()])
      .then(([datosApp, datosCuentas, datosLibros]) => {
        if (cancelado) return;
        setApp(datosApp.app);
        setCuentas(datosCuentas.accounts);
        setLibros(datosLibros.sheets);
        setError(null);
      })
      .catch((fallo) => {
        if (!cancelado) setError(fallo.message);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [recarga]);

  function recargar() {
    setRecarga((actual) => actual + 1);
  }

  async function conectar() {
    setError(null);
    try {
      const { url } = await api.connectMicrosoft();
      window.location.href = url;
    } catch (fallo) {
      setError(fallo.message);
    }
  }

  async function desconectar(cuenta) {
    setError(null);
    try {
      await api.revokeMicrosoftAccount(cuenta.id);
      setConfirmando(null);
      recargar();
    } catch (fallo) {
      setError(fallo.message);
    }
  }

  async function guardarApp(evento) {
    evento.preventDefault();
    setErrorApp(null);
    setGuardandoApp(true);
    try {
      const datos = await api.setMicrosoftApp({
        tenantId: formApp.tenantId.trim() || "common",
        clientId: formApp.clientId.trim(),
        clientSecret: formApp.clientSecret.trim() || undefined,
      });
      setApp(datos.app);
      setEditandoApp(false);
      setFormApp(APP_VACIA);
    } catch (fallo) {
      setErrorApp(fallo.message);
    } finally {
      setGuardandoApp(false);
    }
  }

  async function olvidarApp() {
    setErrorApp(null);
    try {
      const datos = await api.clearMicrosoftApp();
      setApp(datos.app);
      setConfirmando(null);
    } catch (fallo) {
      setErrorApp(fallo.message);
    }
  }

  async function buscar(evento) {
    evento.preventDefault();
    setErrorForm(null);
    setEncontrado(null);
    setBuscando(true);
    try {
      const libro = await api.resolveSpreadsheet(form.accountId, form.url.trim());
      setEncontrado(libro);
      const primera = libro.tables[0] ?? libro.worksheets[0];
      setForm({
        ...form,
        name: form.name || libro.name,
        tableName: primera ? primera.name : "",
      });
    } catch (fallo) {
      setErrorForm(fallo.message);
    } finally {
      setBuscando(false);
    }
  }

  async function registrar(evento) {
    evento.preventDefault();
    setErrorForm(null);
    setGuardando(true);
    try {
      await api.registerSpreadsheet({
        accountId: Number(form.accountId),
        name: form.name.trim(),
        driveId: encontrado.driveId,
        itemId: encontrado.itemId,
        tableName: form.tableName || null,
        webUrl: encontrado.webUrl,
      });
      setForm(FORMULARIO_VACIO);
      setEncontrado(null);
      setRegistrando(false);
      recargar();
    } catch (fallo) {
      setErrorForm(fallo.message);
    } finally {
      setGuardando(false);
    }
  }

  async function abrir(libro) {
    if (abierto === libro.id) {
      setAbierto(null);
      setVista(null);
      return;
    }

    setAbierto(libro.id);
    setVista(null);
    setError(null);
    setCargandoVista(true);
    try {
      const datos = await api.previewSpreadsheet(libro.id);
      setVista({ id: libro.id, ...datos });
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setCargandoVista(false);
    }
  }

  async function quitar(libro) {
    setError(null);
    try {
      await api.deleteSpreadsheet(libro.id);
      setAbierto(null);
      setVista(null);
      setConfirmando(null);
      recargar();
    } catch (fallo) {
      setError(fallo.message);
    }
  }

  if (cargando) {
    return <p className="books-note">Cargando…</p>;
  }

  const vivas = cuentas.filter((cuenta) => cuenta.revokedAt === null);
  const revocadas = cuentas.filter((cuenta) => cuenta.revokedAt !== null);
  const primeraVez = app.source === null || vivas.length === 0;

  return (
    <section className="books">
      {aviso ? (
        <p className={aviso.ok ? "books-status" : "books-status is-bad"}>
          {aviso.ok
            ? "Cuenta de Microsoft conectada."
            : (MOTIVOS[aviso.reason] ??
              "No se pudo conectar la cuenta. Vuelve a intentarlo.")}
          <button className="books-quiet" type="button" onClick={() => setAviso(null)}>
            Entendido
          </button>
        </p>
      ) : null}

      {error !== null ? <p className="books-error">{error}</p> : null}

      {primeraVez ? (
        <div className="books-first">
          <ol>
            <li className={app.source === null ? "is-now" : "is-done"}>
              <span className="books-step">Paso 1</span>
              <strong>Registro de aplicación de Azure</strong>
              <p className="books-note">
                Es lo que autoriza a este sistema a pedirle archivos a Microsoft en nombre de una
                persona. Lo da de alta quien administra el inquilino de la universidad.
              </p>
              <button
                className="books-btn"
                type="button"
                onClick={() => {
                  setVerConexion(true);
                  setEditandoApp(true);
                  setFormApp({
                    tenantId: app.tenantId ?? "common",
                    clientId: app.clientId ?? "",
                    clientSecret: "",
                  });
                }}
              >
                {app.source === null ? "Guardar el registro" : "Cambiar el registro"}
              </button>
            </li>
            <li className={app.source === null ? "" : "is-now"}>
              <span className="books-step">Paso 2</span>
              <strong>Una cuenta Microsoft</strong>
              <p className="books-note">
                Los libros se leen con el acceso de una persona, no con el del sistema.
              </p>
              <button
                className="books-btn is-primary"
                type="button"
                onClick={conectar}
                disabled={app.source === null}
              >
                Conectar una cuenta
              </button>
            </li>
          </ol>
        </div>
      ) : (
        <div className="books-strip">
          <span>
            Conectado a Microsoft con {vivas.length}{" "}
            {vivas.length === 1 ? "cuenta" : "cuentas"}
            {revocadas.length === 0 ? "" : ` · ${revocadas.length} desconectada`}
            {revocadas.length > 1 ? "s" : ""}
          </span>
          <button
            className="books-quiet"
            type="button"
            onClick={() => setVerConexion(!verConexion)}
          >
            {verConexion ? "Ocultar la conexión" : "Administrar conexión"}
          </button>
        </div>
      )}

      {verConexion ? (
        <div className="books-connection">
          <section>
            <h3>Cuentas</h3>
            <ul className="books-accounts">
              {cuentas.map((cuenta) => (
                <li
                  className={cuenta.revokedAt === null ? "books-account" : "books-account is-off"}
                  key={cuenta.id}
                >
                  <span className="books-account-who">
                    {cuenta.email}
                    {cuenta.revokedAt === null ? null : (
                      <span className="books-off">desconectada</span>
                    )}
                  </span>
                  <span className="books-note">
                    La conectó {cuenta.userFullName} el {fechaCorta(cuenta.connectedAt)}
                    {cuenta.lastUsedAt === null
                      ? ""
                      : ` · se usó el ${fechaCorta(cuenta.lastUsedAt)}`}{" "}
                    · {cuenta.sheetCount}{" "}
                    {cuenta.sheetCount === 1 ? "libro depende" : "libros dependen"} de ella
                  </span>

                  {cuenta.revokedAt === null ? (
                    confirmando === `cuenta-${cuenta.id}` ? (
                      <span className="books-action-row">
                        <span className="books-confirm">
                          {cuenta.sheetCount === 0
                            ? "Ningún libro se lee con ella."
                            : `${cuenta.sheetCount} ${
                                cuenta.sheetCount === 1 ? "libro deja" : "libros dejan"
                              } de poder leerse hasta que alguien la reconecte.`}
                        </span>
                        <button
                          className="books-btn"
                          type="button"
                          onClick={() => desconectar(cuenta)}
                        >
                          Desconectar
                        </button>
                        <button
                          className="books-quiet"
                          type="button"
                          onClick={() => setConfirmando(null)}
                        >
                          Dejarla
                        </button>
                      </span>
                    ) : (
                      <button
                        className="books-quiet"
                        type="button"
                        onClick={() => setConfirmando(`cuenta-${cuenta.id}`)}
                      >
                        Desconectar
                      </button>
                    )
                  ) : (
                    <button className="books-quiet" type="button" onClick={conectar}>
                      Reconectar
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <button className="books-btn" type="button" onClick={conectar}>
              Conectar otra cuenta
            </button>
          </section>

          <section>
            <h3>
              Registro de aplicación de Azure
              <Ayuda texto="Es lo que autoriza a este sistema a pedirle archivos a Microsoft en nombre de una persona. Se da de alta una vez, en el portal de Azure de la universidad." />
            </h3>

            {errorApp !== null ? <p className="books-error">{errorApp}</p> : null}

            {editandoApp ? (
              <form className="books-grid" onSubmit={guardarApp}>
                <label className="books-field">
                  <span className="books-label">Inquilino</span>
                  <input
                    value={formApp.tenantId}
                    onChange={(evento) =>
                      setFormApp({ ...formApp, tenantId: evento.target.value })
                    }
                    placeholder="Ej: common"
                  />
                </label>
                <label className="books-field">
                  <span className="books-label">Id de la aplicación</span>
                  <input
                    value={formApp.clientId}
                    onChange={(evento) =>
                      setFormApp({ ...formApp, clientId: evento.target.value })
                    }
                    required
                  />
                </label>
                <label className="books-field">
                  <span className="books-label">
                    Secreto
                    <Ayuda texto="El servidor nunca lo devuelve. Dejarlo vacío conserva el que ya está guardado." />
                  </span>
                  <input
                    type="password"
                    value={formApp.clientSecret}
                    onChange={(evento) =>
                      setFormApp({ ...formApp, clientSecret: evento.target.value })
                    }
                    placeholder={app.hasSecret ? "Se conserva el guardado" : ""}
                  />
                </label>

                <div className="books-field books-field-wide">
                  <span className="books-label">
                    URI de redirección que hay que registrar en Azure
                  </span>
                  <code className="books-code">{app.redirectUri}</code>
                </div>

                <div className="books-action-row books-field-wide">
                  <button
                    className="books-quiet"
                    type="button"
                    onClick={() => setEditandoApp(false)}
                  >
                    Cancelar
                  </button>
                  <button className="books-btn is-primary" type="submit" disabled={guardandoApp}>
                    {guardandoApp ? "Guardando…" : "Guardar el registro"}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <p className="books-note">
                  {app.source === null
                    ? "Todavía no hay ninguno: sin él nadie puede conectar una cuenta."
                    : app.source === "env"
                      ? `Viene del archivo de entorno del servidor, no de esta pantalla. Id ${app.clientId}.`
                      : `Guardado${
                          app.updatedByName === null ? "" : ` por ${app.updatedByName}`
                        }${
                          app.updatedAt === null ? "" : ` el ${fechaCorta(app.updatedAt)}`
                        }. Id ${app.clientId}.`}
                </p>
                <div className="books-action-row">
                  {app.source === "database" ? (
                    confirmando === "app" ? (
                      <>
                        <span className="books-confirm">
                          Si el servidor tiene uno en su archivo de entorno se usará ése; si no,
                          nadie podrá conectar cuentas hasta guardar otro.
                        </span>
                        <button className="books-btn" type="button" onClick={olvidarApp}>
                          Olvidarlo
                        </button>
                        <button
                          className="books-quiet"
                          type="button"
                          onClick={() => setConfirmando(null)}
                        >
                          Conservarlo
                        </button>
                      </>
                    ) : (
                      <button
                        className="books-quiet"
                        type="button"
                        onClick={() => setConfirmando("app")}
                      >
                        Olvidar el registro guardado
                      </button>
                    )
                  ) : null}
                  <button
                    className="books-btn"
                    type="button"
                    onClick={() => {
                      setFormApp({
                        tenantId: app.tenantId ?? "common",
                        clientId: app.clientId ?? "",
                        clientSecret: "",
                      });
                      setEditandoApp(true);
                    }}
                  >
                    {app.source === null ? "Guardar el registro" : "Cambiar"}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}

      <div className="books-bar">
        <p className="books-count">
          {libros.length} {libros.length === 1 ? "libro registrado" : "libros registrados"}
        </p>
        <button
          className="books-btn is-primary"
          type="button"
          onClick={() => setRegistrando(true)}
          disabled={vivas.length === 0}
        >
          Registrar libro
        </button>
      </div>

      <div className="books-table-wrap">
        <table className="books-table">
          <thead>
            <tr>
              <th>Libro</th>
              <th>Se lee con</th>
              <th>Formato</th>
              <th>Última importación</th>
            </tr>
          </thead>
          <tbody>
            {registrando ? (
              <tr className="books-expanded">
                <td colSpan={4}>
                  <form className="books-register" onSubmit={encontrado === null ? buscar : registrar}>
                    <header className="books-register-head">
                      <span className="books-eyebrow">Registrar libro</span>
                      <button
                        className="books-close"
                        type="button"
                        onClick={() => {
                          setRegistrando(false);
                          setEncontrado(null);
                          setForm(FORMULARIO_VACIO);
                        }}
                        aria-label="Cerrar"
                      >
                        ✕
                      </button>
                    </header>

                    <ol className="books-steps">
                      <li className={form.accountId === "" ? "is-now" : "is-done"}>Cuenta</li>
                      <li
                        className={
                          form.accountId === ""
                            ? ""
                            : encontrado === null
                              ? "is-now"
                              : "is-done"
                        }
                      >
                        Enlace
                      </li>
                      <li className={encontrado === null ? "" : "is-now"}>Tabla y nombre</li>
                    </ol>

                    <div className="books-grid">
                      <label className="books-field">
                        <span className="books-label">
                          Se leerá con la cuenta
                          <Ayuda texto="El libro se lee con el acceso de esa persona. Si su cuenta se desconecta, el libro deja de poder leerse hasta que alguien la reconecte." />
                        </span>
                        <select
                          value={form.accountId}
                          onChange={(evento) => setForm({ ...form, accountId: evento.target.value })}
                          required
                        >
                          <option value="">Elige una cuenta</option>
                          {vivas.map((cuenta) => (
                            <option value={cuenta.id} key={cuenta.id}>
                              {cuenta.email}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="books-field books-field-wide">
                        <span className="books-label">
                          Enlace del libro
                          <Ayuda texto="El enlace que da OneDrive o SharePoint al compartir o abrir el archivo. Otro tipo de enlace no se puede resolver." />
                        </span>
                        <input
                          value={form.url}
                          onChange={(evento) => setForm({ ...form, url: evento.target.value })}
                          placeholder="Ej: https://uaq-my.sharepoint.com/:x:/g/personal/…"
                          required
                        />
                      </label>
                    </div>

                    {encontrado === null ? (
                      <div className="books-action-row">
                        <button className="books-btn is-primary" type="submit" disabled={buscando}>
                          {buscando ? "Buscando…" : "Buscar el libro"}
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="books-note">
                          Libro encontrado: {encontrado.name} · {encontrado.tables.length}{" "}
                          {encontrado.tables.length === 1 ? "tabla" : "tablas"},{" "}
                          {encontrado.worksheets.length}{" "}
                          {encontrado.worksheets.length === 1 ? "hoja" : "hojas"}
                        </p>

                        <div className="books-grid">
                          <label className="books-field">
                            <span className="books-label">
                              Tabla u hoja
                              <Ayuda texto="Una tabla es mejor: sus columnas tienen nombre propio y no se mueven al insertar filas. Una hoja se lee por el texto de su primer renglón." />
                            </span>
                            <select
                              value={form.tableName}
                              onChange={(evento) =>
                                setForm({ ...form, tableName: evento.target.value })
                              }
                            >
                              {encontrado.tables.map((tabla) => (
                                <option value={tabla.name} key={`t-${tabla.name}`}>
                                  Tabla · {tabla.name}
                                </option>
                              ))}
                              {encontrado.worksheets.map((hoja) => (
                                <option value={hoja.name} key={`h-${hoja.name}`}>
                                  Hoja · {hoja.name}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="books-field">
                            <span className="books-label">Cómo se va a llamar aquí</span>
                            <input
                              value={form.name}
                              onChange={(evento) => setForm({ ...form, name: evento.target.value })}
                              required
                            />
                          </label>
                        </div>

                        <div className="books-action-row">
                          <span className="books-note">
                            Registrarlo no importa nada: eso se hace en «Importar de Excel».
                          </span>
                          <button
                            className="books-btn"
                            type="button"
                            onClick={() => setEncontrado(null)}
                          >
                            Buscar otro
                          </button>
                          <button
                            className="books-btn is-primary"
                            type="submit"
                            disabled={guardando}
                          >
                            {guardando ? "Registrando…" : "Registrar libro"}
                          </button>
                        </div>
                      </>
                    )}

                    {errorForm !== null ? <p className="books-error">{errorForm}</p> : null}
                  </form>
                </td>
              </tr>
            ) : null}

            {libros.map((libro) => (
              <Fragment key={libro.id}>
                <tr
                  className={
                    libro.accountRevoked ? "books-row is-stale" : "books-row"
                  }
                  onClick={() => abrir(libro)}
                >
                  <td className="books-cell-main">
                    <span className="books-kind">
                      {libro.tableName === null ? "Hoja" : "Tabla"}
                      {libro.tableName === null ? "" : ` · ${libro.tableName}`}
                    </span>
                    <span className="books-row-name">{libro.name}</span>
                  </td>
                  <td>
                    {libro.accountEmail}
                    {libro.accountRevoked ? <span className="books-off">desconectada</span> : null}
                  </td>
                  <td>
                    {libro.mapped ? (
                      `${libro.schemaName} v${libro.schemaVersion}`
                    ) : (
                      <span className="books-off">Sin mapear</span>
                    )}
                  </td>
                  <td>{ultimaImportacion(libro)}</td>
                </tr>

                {abierto === libro.id ? (
                  <tr className="books-expanded">
                    <td colSpan={4}>
                      <div className="books-open">
                        <Vista vista={vista} cargando={cargandoVista} />

                        <div className="books-facts">
                          <div className="books-fact">
                            <span className="books-label">Formato</span>
                            {libro.mapped
                              ? `${libro.schemaName} v${libro.schemaVersion}`
                              : "Sin mapear"}
                          </div>
                          <div className="books-fact">
                            <span className="books-label">Última importación</span>
                            {ultimaImportacion(libro)}
                          </div>
                          <div className="books-fact">
                            <span className="books-label">Se lee con</span>
                            {libro.accountEmail}
                            {libro.accountRevoked ? " (desconectada)" : ""}
                          </div>
                          <div className="books-fact">
                            <span className="books-label">Lo registró</span>
                            {libro.registeredByName ?? "alguien que ya no está"} el{" "}
                            {fechaCorta(libro.createdAt)}
                          </div>
                          {libro.webUrl === null ? null : (
                            <a
                              className="books-quiet"
                              href={libro.webUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Abrir el libro ↗
                            </a>
                          )}
                        </div>

                        <footer className="books-open-foot">
                          {confirmando === `libro-${libro.id}` ? (
                            <span className="books-action-row">
                              <span className="books-confirm">
                                Las solicitudes que ya se importaron se quedan: solo deja de
                                leerse el libro.
                              </span>
                              <button
                                className="books-btn"
                                type="button"
                                onClick={() => quitar(libro)}
                              >
                                Quitarlo
                              </button>
                              <button
                                className="books-quiet"
                                type="button"
                                onClick={() => setConfirmando(null)}
                              >
                                Dejarlo
                              </button>
                            </span>
                          ) : (
                            <button
                              className="books-quiet is-danger"
                              type="button"
                              onClick={() => setConfirmando(`libro-${libro.id}`)}
                            >
                              Quitar del registro
                            </button>
                          )}

                          {libro.accountRevoked ? (
                            <button className="books-btn is-primary" type="button" onClick={conectar}>
                              Reconectar la cuenta
                            </button>
                          ) : (
                            <button
                              className="books-btn is-primary"
                              type="button"
                              onClick={() => (onIr === null ? null : onIr("Importar de Excel"))}
                              disabled={onIr === null}
                            >
                              {libro.mapped ? "Importar filas nuevas" : "Mapear e importar"}
                            </button>
                          )}
                        </footer>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}

            {libros.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <p className="books-empty">
                    {vivas.length === 0
                      ? "Los libros se registran una vez que hay una cuenta conectada."
                      : "Ningún libro registrado todavía."}
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

export default Spreadsheets;
