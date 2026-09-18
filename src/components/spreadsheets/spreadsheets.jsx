// Cuentas Microsoft conectadas y libros de Excel registrados. Es la primera mitad de la
// migración (RF-MIG-01): registrar qué libro se lee y con qué cuenta. Mapear sus columnas a
// un formato es la siguiente etapa y aquí sólo se muestra si ya está hecho.
import { Fragment, useEffect, useState } from "react";

import * as api from "../../api/client.js";
import { MICROSOFT_PARAM } from "../../config.js";

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

  // Los encabezados desplegados: { id, kind, name, headers } o null.
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
    <section className="spreadsheets">
      <h1 className="spreadsheets-title">Formatos de solicitud</h1>

      {aviso && (
        <p
          className={
            aviso.ok ? "spreadsheets-notice" : "spreadsheets-notice-error"
          }
        >
          {aviso.ok
            ? "Cuenta de Microsoft conectada."
            : `No se pudo conectar la cuenta (${aviso.reason ?? "error"}${
                aviso.description ? `: ${aviso.description}` : ""
              }).`}
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

      {/* Registro de aplicación de Azure: con qué credenciales se inicia sesión en
          Microsoft. El registro se crea en el portal de Entra; aquí se guardan sus datos. */}
      <section className="spreadsheets-app">
        <header className="spreadsheets-app-header">
          <h2 className="spreadsheets-subtitle">Registro de aplicación de Azure</h2>
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
            <dt>Estado</dt>
            <dd>
              {app.source === "database"
                ? "Guardado desde esta pantalla"
                : app.source === "env"
                  ? "Tomado del archivo .env del servidor"
                  : "Sin configurar: nadie puede conectar cuentas todavía"}
            </dd>
            <dt>Tenant</dt>
            <dd>{app.tenantId ?? "—"}</dd>
            <dt>Client ID</dt>
            <dd>{app.clientId ?? "—"}</dd>
            <dt>Secreto</dt>
            <dd>{app.hasSecret ? "Guardado" : "Falta"}</dd>
            <dt>URI de redirección</dt>
            <dd>
              <code>{app.redirectUri}</code>
            </dd>
            {app.updatedAt && (
              <>
                <dt>Última modificación</dt>
                <dd>
                  {new Date(app.updatedAt).toLocaleString()}
                  {app.updatedByName ? ` por ${app.updatedByName}` : ""}
                </dd>
              </>
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
              En el portal de Entra (Aplicaciones → Registros de aplicaciones) registra la
              aplicación con una URI de redirección de tipo Web igual a{" "}
              <code>{app?.redirectUri}</code>, crea un secreto de cliente y agrega los
              permisos delegados de Graph <code>offline_access</code>,{" "}
              <code>User.Read</code> y <code>Files.Read.All</code>. Copia aquí sus datos.
            </p>

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

            <label className="spreadsheets-field">
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
        <header className="spreadsheets-accounts-header">
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
                  <td>{cuenta.email}</td>
                  <td>{cuenta.displayName}</td>
                  <td>{cuenta.userFullName}</td>
                  <td>{new Date(cuenta.connectedAt).toLocaleDateString()}</td>
                  <td>
                    {cuenta.lastUsedAt
                      ? new Date(cuenta.lastUsedAt).toLocaleDateString()
                      : "—"}
                  </td>
                  <td>
                    <button
                      className="spreadsheets-disconnect"
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
        )}
      </section>

      {/* Registro de un libro nuevo */}
      <section className="spreadsheets-register">
        <h2 className="spreadsheets-subtitle">Registrar libro</h2>

        {cuentas.length === 0 ? null : (
          <form
            className="spreadsheets-form"
            onSubmit={libro ? handleRegistrar : handleBuscar}
          >
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
          <table className="spreadsheets-table">
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
                    <td>
                      {hoja.webUrl ? (
                        <a href={hoja.webUrl} target="_blank" rel="noreferrer">
                          {hoja.name}
                        </a>
                      ) : (
                        hoja.name
                      )}
                    </td>
                    <td>{hoja.tableName ?? "(primera)"}</td>
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
                    <td>{hoja.mapped ? "Mapeado" : "Sin mapear"}</td>
                    <td>
                      <button
                        className="spreadsheets-preview"
                        type="button"
                        onClick={() => handleVer(hoja)}
                        disabled={cargandoVista}
                      >
                        {vista?.id === hoja.id ? "Ocultar" : "Ver encabezados"}
                      </button>
                      <button
                        className="spreadsheets-delete"
                        type="button"
                        onClick={() => handleEliminar(hoja)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>

                  {vista?.id === hoja.id && (
                    <tr className="spreadsheets-headers">
                      <td colSpan={6}>
                        <p className="spreadsheets-headers-title">
                          Encabezados de{" "}
                          {vista.kind === "table" ? "la tabla" : "la hoja"}{" "}
                          {vista.name}:
                        </p>
                        <ol className="spreadsheets-headers-list">
                          {vista.headers.map((encabezado, i) => (
                            <li key={i}>{String(encabezado) || "(vacío)"}</li>
                          ))}
                        </ol>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </section>
  );
}

export default Spreadsheets;
