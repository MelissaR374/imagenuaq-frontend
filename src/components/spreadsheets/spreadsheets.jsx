// Cuentas Microsoft conectadas y libros de Excel registrados. Es la primera mitad de la
// migración (RF-MIG-01): registrar qué libro se lee y con qué cuenta. Mapear sus columnas a
// un formato es la siguiente etapa y aquí sólo se muestra si ya está hecho.
import { Fragment, useEffect, useState } from "react";

import * as api from "../../api/client.js";
import { MICROSOFT_PARAM } from "../../config.js";
import "./spreadsheets.css";

// Lo que dejó el servidor en la URL al volver de Microsoft, o null si no venimos de ahí.
function resultadoEnLaUrl() {
  const params = new URLSearchParams(window.location.search);
  const resultado = params.get(MICROSOFT_PARAM);
  if (!resultado) return null;

  return {
    ok: resultado === "connected",
    reason: params.get("reason"),
    description: params.get("description"),
  };
}

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

// El formulario de registro vacío: sirve para empezar y para limpiarlo al terminar.
const FORMULARIO_VACIO = { accountId: "", url: "", tableName: "", name: "" };

// El formulario del registro de aplicación de Azure. El secreto siempre empieza vacío:
// el servidor nunca lo devuelve, y vacío significa "conservar el que ya está".
const APP_VACIA = { tenantId: "common", clientId: "", clientSecret: "" };

function Spreadsheets() {
  const [cuentas, setCuentas] = useState([]);
  const [libros, setLibros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Sube de uno en uno para volver a pedir las listas después de cada cambio.
  const [recarga, setRecarga] = useState(0);

  // El aviso de "cuenta conectada" o el error con el que Microsoft nos regresó.
  const [aviso, setAviso] = useState(resultadoEnLaUrl);

  // El formulario de registro: primero el enlace, luego lo que el servidor encontró.
  const [form, setForm] = useState(FORMULARIO_VACIO);
  const [libro, setLibro] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState(null);

  // Los encabezados desplegados y unas filas de muestra: { id, kind, name, headers, rows } o null.
  const [vista, setVista] = useState(null);
  const [cargandoVista, setCargandoVista] = useState(false);

  // El registro de aplicación de Azure: lo que hay y el formulario para cambiarlo.
  const [app, setApp] = useState(null);
  const [formApp, setFormApp] = useState(APP_VACIA);
  const [editandoApp, setEditandoApp] = useState(false);
  const [guardandoApp, setGuardandoApp] = useState(false);
  const [errorApp, setErrorApp] = useState(null);

  // Limpia la URL una vez leído el resultado, para que recargar no lo repita.
  useEffect(() => {
    if (!aviso) return;
    const limpia = window.location.pathname + window.location.hash;
    window.history.replaceState(null, "", limpia);
  }, [aviso]);

  useEffect(() => {
    let cancelado = false;

    Promise.all([
      api.getMicrosoftApp(),
      api.listMicrosoftAccounts(),
      api.listSpreadsheets(),
    ])
      .then(([datosApp, datosCuentas, datosLibros]) => {
        if (cancelado) return;
        setApp(datosApp.app);
        setCuentas(datosCuentas.accounts);
        setLibros(datosLibros.sheets);
        setError(null);
      })
      .catch((err) => {
        if (!cancelado) setError(err.message);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [recarga]);

  // --- Registro de aplicación ---

  function handleEditarApp() {
    setErrorApp(null);
    setFormApp({
      tenantId: app?.tenantId ?? "common",
      clientId: app?.clientId ?? "",
      clientSecret: "",
    });
    setEditandoApp(true);
  }

  function handleAppChange(event) {
    const { name, value } = event.target;
    setFormApp({ ...formApp, [name]: value });
  }

  async function handleGuardarApp(event) {
    event.preventDefault();
    setErrorApp(null);
    setGuardandoApp(true);

    try {
      const datos = await api.setMicrosoftApp({
        tenantId: formApp.tenantId.trim() || "common",
        clientId: formApp.clientId.trim(),
        // Vacío = conservar el secreto guardado; el servidor pide uno la primera vez.
        clientSecret: formApp.clientSecret.trim() || undefined,
      });
      setApp(datos.app);
      setEditandoApp(false);
      setFormApp(APP_VACIA);
    } catch (err) {
      setErrorApp(err.message);
    } finally {
      setGuardandoApp(false);
    }
  }

  async function handleOlvidarApp() {
    const seguro = window.confirm(
      "¿Olvidar el registro guardado? Si el servidor tiene uno en .env se usará ése; si no, nadie podrá conectar cuentas hasta guardar otro.",
    );
    if (!seguro) return;

    setErrorApp(null);

    try {
      const datos = await api.clearMicrosoftApp();
      setApp(datos.app);
    } catch (err) {
      setErrorApp(err.message);
    }
  }

  // --- Cuentas ---

  async function handleConectar() {
    setError(null);

    try {
      const { url } = await api.connectMicrosoft();
      // Nos vamos a Microsoft; el servidor nos trae de vuelta a esta pestaña.
      window.location.href = url;
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDesconectar(cuenta) {
    const seguro = window.confirm(
      `¿Desconectar la cuenta ${cuenta.email}? Los libros registrados con ella dejarán de poder leerse hasta que se vuelva a conectar.`,
    );
    if (!seguro) return;

    setError(null);

    try {
      await api.revokeMicrosoftAccount(cuenta.id);
      setRecarga(recarga + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  // --- Registro de un libro ---

  function handleChange(event) {
    const { name, value } = event.target;
    setForm({ ...form, [name]: value });
  }

  async function handleBuscar(event) {
    event.preventDefault();
    setErrorForm(null);
    setLibro(null);
    setBuscando(true);

    try {
      const encontrado = await api.resolveSpreadsheet(
        form.accountId,
        form.url.trim(),
      );
      setLibro(encontrado);
      // La primera tabla como sugerencia, o la primera hoja si no hay tablas.
      const primera = encontrado.tables[0] ?? encontrado.worksheets[0];
      setForm({
        ...form,
        name: form.name || encontrado.name,
        tableName: primera ? primera.name : "",
      });
    } catch (err) {
      setErrorForm(err.message);
    } finally {
      setBuscando(false);
    }
  }

  async function handleRegistrar(event) {
    event.preventDefault();
    setErrorForm(null);
    setGuardando(true);

    try {
      await api.registerSpreadsheet({
        accountId: Number(form.accountId),
        name: form.name.trim(),
        driveId: libro.driveId,
        itemId: libro.itemId,
        tableName: form.tableName || null,
        webUrl: libro.webUrl,
      });
      setForm(FORMULARIO_VACIO);
      setLibro(null);
      setRecarga(recarga + 1);
    } catch (err) {
      setErrorForm(err.message);
    } finally {
      setGuardando(false);
    }
  }

  // --- Libros registrados ---

  async function handleVer(hoja) {
    setError(null);

    if (vista?.id === hoja.id) {
      setVista(null);
      return;
    }

    setCargandoVista(true);
    try {
      const datos = await api.previewSpreadsheet(hoja.id);
      setVista({
        id: hoja.id,
        kind: datos.kind,
        name: datos.name,
        headers: datos.headers,
        rows: datos.rows,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setCargandoVista(false);
    }
  }

  async function handleEliminar(hoja) {
    const seguro = window.confirm(
      `¿Quitar el libro ${hoja.name} del registro?`,
    );
    if (!seguro) return;

    setError(null);

    try {
      await api.deleteSpreadsheet(hoja.id);
      if (vista?.id === hoja.id) setVista(null);
      setRecarga(recarga + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  if (cargando) return <p className="spreadsheets-loading">Cargando...</p>;

  return (
    <section className="spreadsheets-panel">
      <header className="spreadsheets-header">
        <h1 className="spreadsheets-title">Formatos de solicitud</h1>
        <p className="spreadsheets-count">
          {libros.length} libro{libros.length === 1 ? "" : "s"} registrado
          {libros.length === 1 ? "" : "s"}
        </p>
      </header>

      {aviso && (
        <p
          className={
            aviso.ok ? "spreadsheets-notice" : "spreadsheets-notice-error"
          }
        >
          <span>
            {aviso.ok
              ? "Cuenta de Microsoft conectada."
              : `No se pudo conectar la cuenta (${aviso.reason ?? "error"}${
                  aviso.description ? `: ${aviso.description}` : ""
                }).`}
          </span>
          <button
            className="spreadsheets-notice-close"
            type="button"
            onClick={() => setAviso(null)}
          >
            Cerrar
          </button>
        </p>
      )}

      {error && <p className="spreadsheets-error">{error}</p>}

      {/* Registro de aplicación de Azure */}
      <section className="spreadsheets-app">
        <header className="spreadsheets-section-header">
          <h2 className="spreadsheets-subtitle">
            Registro de aplicación de Azure
          </h2>
          {!editandoApp && (
            <button
              className="spreadsheets-app-edit"
              type="button"
              onClick={handleEditarApp}
            >
              {app?.source ? "Cambiar" : "Configurar"}
            </button>
          )}
        </header>

        {app && !editandoApp && (
          <dl className="spreadsheets-app-summary">
            <div className="spreadsheets-app-summary-row">
              <dt>Estado</dt>
              <dd>
                {app.source === "database"
                  ? "Guardado desde esta pantalla"
                  : app.source === "env"
                    ? "Tomado del archivo .env del servidor"
                    : "Sin configurar: nadie puede conectar cuentas todavía"}
              </dd>
            </div>
            <div className="spreadsheets-app-summary-row">
              <dt>Tenant</dt>
              <dd>{app.tenantId ?? "—"}</dd>
            </div>
            <div className="spreadsheets-app-summary-row">
              <dt>Client ID</dt>
              <dd>{app.clientId ?? "—"}</dd>
            </div>
            <div className="spreadsheets-app-summary-row">
              <dt>Secreto</dt>
              <dd>{app.hasSecret ? "Guardado" : "Falta"}</dd>
            </div>
            <div className="spreadsheets-app-summary-row">
              <dt>URI de redirección</dt>
              <dd>
                <code>{app.redirectUri}</code>
              </dd>
            </div>
            {app.updatedAt && (
              <div className="spreadsheets-app-summary-row">
                <dt>Última modificación</dt>
                <dd>
                  {new Date(app.updatedAt).toLocaleString()}
                  {app.updatedByName ? ` por ${app.updatedByName}` : ""}
                </dd>
              </div>
            )}
          </dl>
        )}

        {app?.source === "database" && !editandoApp && (
          <button
            className="spreadsheets-app-clear"
            type="button"
            onClick={handleOlvidarApp}
          >
            Olvidar registro guardado
          </button>
        )}

        {editandoApp && (
          <form className="spreadsheets-app-form" onSubmit={handleGuardarApp}>
            <p className="spreadsheets-app-help">
              En el portal de Entra (Aplicaciones → Registros de aplicaciones)
              registra la aplicación con una URI de redirección de tipo Web
              igual a <code>{app?.redirectUri}</code>, crea un secreto de
              cliente y agrega los permisos delegados de Graph{" "}
              <code>offline_access</code>, <code>User.Read</code> y{" "}
              <code>Files.Read.All</code>. Copia aquí sus datos.
            </p>

            <div className="spreadsheets-form-grid">
              <label className="spreadsheets-field">
                Tenant
                <input
                  type="text"
                  name="tenantId"
                  value={formApp.tenantId}
                  onChange={handleAppChange}
                  placeholder="common"
                  maxLength={64}
                />
              </label>

              <label className="spreadsheets-field">
                Application (client) ID
                <input
                  type="text"
                  name="clientId"
                  value={formApp.clientId}
                  onChange={handleAppChange}
                  maxLength={64}
                  required
                />
              </label>

              <label className="spreadsheets-field spreadsheets-field--full">
                Secreto de cliente
                <input
                  type="password"
                  name="clientSecret"
                  value={formApp.clientSecret}
                  onChange={handleAppChange}
                  placeholder={app?.hasSecret ? "Vacío conserva el actual" : ""}
                  autoComplete="new-password"
                />
              </label>
            </div>

            <div className="spreadsheets-form-actions">
              <button
                className="spreadsheets-app-save"
                type="submit"
                disabled={guardandoApp}
              >
                {guardandoApp ? "Guardando..." : "Guardar"}
              </button>
              <button
                className="spreadsheets-cancel"
                type="button"
                onClick={() => setEditandoApp(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {errorApp && <p className="spreadsheets-form-error">{errorApp}</p>}
      </section>

      {/* Cuentas conectadas */}
      <section className="spreadsheets-accounts">
        <header className="spreadsheets-section-header">
          <h2 className="spreadsheets-subtitle">Cuentas Microsoft</h2>
          <button
            className="spreadsheets-connect"
            type="button"
            onClick={handleConectar}
          >
            Conectar cuenta Microsoft
          </button>
        </header>

        {cuentas.length === 0 ? (
          <p className="spreadsheets-empty">
            No hay cuentas conectadas. Conecta una para poder registrar libros.
          </p>
        ) : (
          <div className="spreadsheets-table-wrap">
            <table className="spreadsheets-table">
              <thead>
                <tr>
                  <th>Cuenta</th>
                  <th>Nombre</th>
                  <th>Conectada por</th>
                  <th>Desde</th>
                  <th>Último uso</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cuentas.map((cuenta) => (
                  <tr key={cuenta.id} className="spreadsheets-account">
                    <td className="spreadsheets-cell-strong">{cuenta.email}</td>
                    <td>{cuenta.displayName}</td>
                    <td>{cuenta.userFullName}</td>
                    <td>{new Date(cuenta.connectedAt).toLocaleDateString()}</td>
                    <td>
                      {cuenta.lastUsedAt
                        ? new Date(cuenta.lastUsedAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="spreadsheets-cell-actions">
                      <button
                        className="spreadsheets-action spreadsheets-action-danger"
                        type="button"
                        onClick={() => handleDesconectar(cuenta)}
                      >
                        Desconectar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Registro de un libro nuevo */}
      <section className="spreadsheets-register">
        <h2 className="spreadsheets-subtitle">Registrar libro</h2>
        <p>
          Registrar una hoja de cálculo conectada a un formulario para poder ser
          utilizada dentro del sistema
        </p>

        {cuentas.length === 0 ? (
          <p className="spreadsheets-empty">
            Conecta una cuenta Microsoft para poder registrar libros.
          </p>
        ) : (
          <form
            className="spreadsheets-form"
            onSubmit={libro ? handleRegistrar : handleBuscar}
          >
            <div className="spreadsheets-form-grid">
              <label className="spreadsheets-field">
                Cuenta
                <select
                  name="accountId"
                  value={form.accountId}
                  onChange={handleChange}
                  required
                  disabled={Boolean(libro)}
                >
                  <option value="">Elige una cuenta</option>
                  {cuentas.map((cuenta) => (
                    <option key={cuenta.id} value={cuenta.id}>
                      {cuenta.email}
                    </option>
                  ))}
                </select>
              </label>

              <label className="spreadsheets-field">
                Enlace al libro
                <input
                  type="url"
                  name="url"
                  value={form.url}
                  onChange={handleChange}
                  placeholder="https://uaq-my.sharepoint.com/..."
                  required
                  disabled={Boolean(libro)}
                />
              </label>
            </div>

            {!libro && (
              <button
                className="spreadsheets-search"
                type="submit"
                disabled={buscando}
              >
                {buscando ? "Buscando..." : "Buscar"}
              </button>
            )}

            {libro && (
              <>
                <p className="spreadsheets-found">
                  Libro encontrado: <strong>{libro.name}</strong>
                </p>

                <div className="spreadsheets-form-grid">
                  <label className="spreadsheets-field">
                    Tabla u hoja
                    <select
                      name="tableName"
                      value={form.tableName}
                      onChange={handleChange}
                    >
                      {libro.tables.length > 0 && (
                        <optgroup label="Tablas">
                          {libro.tables.map((tabla) => (
                            <option key={`t-${tabla.id}`} value={tabla.name}>
                              {tabla.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="Hojas">
                        {libro.worksheets.map((hoja) => (
                          <option key={`w-${hoja.id}`} value={hoja.name}>
                            {hoja.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </label>

                  <label className="spreadsheets-field">
                    Nombre
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      maxLength={300}
                      required
                    />
                  </label>
                </div>

                <div className="spreadsheets-form-actions">
                  <button
                    className="spreadsheets-save"
                    type="submit"
                    disabled={guardando}
                  >
                    {guardando ? "Registrando..." : "Registrar"}
                  </button>
                  <button
                    className="spreadsheets-cancel"
                    type="button"
                    onClick={() => setLibro(null)}
                  >
                    Cambiar enlace
                  </button>
                </div>
              </>
            )}

            {errorForm && (
              <p className="spreadsheets-form-error">{errorForm}</p>
            )}
          </form>
        )}
      </section>

      {/* Libros registrados */}
      <section className="spreadsheets-list">
        <h2 className="spreadsheets-subtitle">Libros registrados</h2>

        {libros.length === 0 ? (
          <p className="spreadsheets-empty">
            Todavía no hay libros registrados.
          </p>
        ) : (
          <div className="spreadsheets-table-wrap">
            <table className="spreadsheets-table spreadsheets-table--books">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Tabla</th>
                  <th>Cuenta</th>
                  <th>Registró</th>
                  <th>Formato</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {libros.map((hoja) => (
                  <Fragment key={hoja.id}>
                    <tr className="spreadsheets-sheet">
                      <td className="spreadsheets-cell-strong">
                        {hoja.webUrl ? (
                          <a
                            href={hoja.webUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {hoja.name}
                          </a>
                        ) : (
                          hoja.name
                        )}
                      </td>
                      <td>
                        <span className="spreadsheets-tag">
                          {hoja.tableName ?? "(primera)"}
                        </span>
                      </td>
                      <td>
                        {hoja.accountEmail}
                        {hoja.accountRevoked && (
                          <span className="spreadsheets-revoked">
                            {" "}
                            (desconectada)
                          </span>
                        )}
                      </td>
                      <td>{hoja.registeredByName ?? "—"}</td>
                      <td>
                        <span
                          className={
                            hoja.mapped
                              ? "spreadsheets-badge spreadsheets-badge--ok"
                              : "spreadsheets-badge spreadsheets-badge--pending"
                          }
                        >
                          {hoja.mapped ? "Mapeado" : "Sin mapear"}
                        </span>
                      </td>
                      <td className="spreadsheets-cell-actions">
                        <button
                          className="spreadsheets-action"
                          type="button"
                          onClick={() => handleVer(hoja)}
                          disabled={cargandoVista}
                        >
                          {vista?.id === hoja.id
                            ? "Ocultar"
                            : "Ver encabezados"}
                        </button>
                        <button
                          className="spreadsheets-action spreadsheets-action-danger"
                          type="button"
                          onClick={() => handleEliminar(hoja)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>

                    {/* Los encabezados como fila 1 de la hoja y debajo las filas de muestra */}
                    {vista?.id === hoja.id && (
                      <tr className="spreadsheets-headers-row">
                        <td colSpan={6}>
                          <div className="sheet-preview">
                            <div className="sheet-preview-head">
                              <span className="sheet-preview-label">
                                {vista.kind === "table" ? "Tabla" : "Hoja"}
                              </span>
                              <span className="sheet-preview-name">
                                {vista.name}
                              </span>
                              <span className="sheet-preview-count">
                                {vista.headers.length} columna
                                {vista.headers.length === 1 ? "" : "s"} ·{" "}
                                {vista.rows.length} fila
                                {vista.rows.length === 1 ? "" : "s"} de muestra
                              </span>
                            </div>
                            <div className="sheet-preview-scroll">
                              <table className="sheet-preview-grid">
                                <thead>
                                  <tr>
                                    <th className="sheet-preview-corner"></th>
                                    {vista.headers.map((_, i) => (
                                      <th key={i} className="sheet-preview-col">
                                        {letraDeColumna(i)}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr>
                                    <th className="sheet-preview-row">1</th>
                                    {vista.headers.map((encabezado, i) => (
                                      <td
                                        key={i}
                                        className="sheet-preview-cell sheet-preview-cell--header"
                                      >
                                        {String(encabezado) || "(vacío)"}
                                      </td>
                                    ))}
                                  </tr>
                                  {vista.rows.map((fila, r) => (
                                    <tr key={r}>
                                      <th className="sheet-preview-row">
                                        {r + 2}
                                      </th>
                                      {/* Se recorren los encabezados para que cada fila tenga las mismas celdas */}
                                      {vista.headers.map((_, c) => (
                                        <td
                                          key={c}
                                          className="sheet-preview-cell"
                                        >
                                          {fila[c] == null
                                            ? ""
                                            : String(fila[c])}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

export default Spreadsheets;
