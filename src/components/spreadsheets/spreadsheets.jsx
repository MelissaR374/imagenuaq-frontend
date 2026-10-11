// The registered Excel workbooks (RF-MIG-01): what people come here to do.
//
// The books come first and the Microsoft connection is one line: the Azure app registration and
// the account are touched once, and they used to take the whole screen on every visit. Only on the
// first run, when nothing is connected yet, does that line become two real steps.
//
// What is done *with* a book --- mapping it, importing it, looking at its runs --- is not here: it
// lives in "Importar de Excel". They are two jobs from two moments: registering a book happens
// once, and the mapping is adjusted every time the sheet changes.
//
// Books are read with one person's delegated access, so a revoked account stops every book read
// with it until somebody reconnects: that is why a disconnected account is said in amber on the
// book's row, and why disconnecting one warns how many books depend on it.
import { Fragment, useEffect, useState } from "react";

import * as api from "../../api/client.js";
import { shortDate, columnLetter } from "../shared/format.js";
import Help from "../shared/help.jsx";
import { MICROSOFT_PARAM } from "../../config.js";
import "./spreadsheets.css";

/**
 * Why connecting failed, in words. The server sends Microsoft's code, which tells nobody anything;
 * what matters is whether it can be tried again or somebody has to talk to whoever administers it.
 */
const REASONS = {
  access_denied: "No se otorgó el permiso en la pantalla de Microsoft.",
  invalid_grant: "El permiso venció antes de terminar. Vuelve a intentarlo.",
  invalid_client: "El registro de aplicación de Azure no es válido: revísalo aquí abajo.",
  not_configured: "Todavía no hay un registro de aplicación de Azure guardado.",
  state_mismatch: "La vuelta de Microsoft no correspondía a esta sesión. Vuelve a intentarlo.",
};

/** What the server left in the URL on the way back from Microsoft, or null if we did not come from there. */
function resultInTheUrl() {
  const params = new URLSearchParams(window.location.search);
  const result = params.get(MICROSOFT_PARAM);
  if (!result) return null;

  return { ok: result === "connected", reason: params.get("reason") };
}

const NO_FORM = { accountId: "", url: "", tableName: "", name: "" };

/**
 * The Azure app registration form. The secret always starts empty: the server never returns it, and
 * empty means "keep the one already stored".
 */
const NO_APP = { tenantId: "common", clientId: "", clientSecret: "" };

/** How the last import went, in one sentence. */
function lastImport(book) {
  if (book.markedRows > 0 && book.lastImport === null) {
    return `${book.markedRows} filas marcadas como ya atendidas`;
  }
  if (book.lastImport === null) {
    return "Nunca se ha importado";
  }

  const parts = [shortDate(book.lastImport.finishedAt)];
  parts.push(
    `${book.lastImport.created} ${book.lastImport.created === 1 ? "nueva" : "nuevas"}`,
  );
  if (book.lastImport.failed > 0) {
    parts.push(`${book.lastImport.failed} con error`);
  }
  return parts.join(" · ");
}

/**
 * The book as Excel shows it: column letters, row numbers and the tinted header row.
 *
 * The rows come by position, not by column name: Graph returns an array per row and the header is
 * row 1, so a cell is found by its index.
 */
function SheetPreview({ preview, loading }) {
  if (loading) {
    return <p className="books-note">Leyendo el libro…</p>;
  }
  if (preview === null) {
    return null;
  }

  return (
    <div className="books-sheet-wrap">
      <table className="books-sheet">
        <thead>
          <tr>
            <th className="books-sheet-corner" />
            {preview.headers.map((_, index) => (
              <th key={index}>{columnLetter(index)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="books-sheet-headers">
            <th>1</th>
            {preview.headers.map((header, index) => (
              <td key={index}>{header}</td>
            ))}
          </tr>
          {preview.rows.map((row, index) => (
            <tr key={index}>
              <th>{index + 2}</th>
              {preview.headers.map((_, column) => (
                <td key={column}>{String(row[column] ?? "")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Spreadsheets({ onGo = null }) {
  const [accounts, setCuentas] = useState([]);
  const [books, setLibros] = useState([]);
  const [app, setApp] = useState(null);
  const [loading, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [reloads, setRecarga] = useState(0);
  const [notice, setAviso] = useState(resultInTheUrl);

  const [showConnection, setVerConexion] = useState(false);
  const [editingApp, setEditandoApp] = useState(false);
  const [appForm, setFormApp] = useState(NO_APP);
  const [appError, setErrorApp] = useState(null);
  const [savingApp, setGuardandoApp] = useState(false);
  const [confirming, setConfirmando] = useState(null);

  const [registering, setRegistrando] = useState(false);
  const [form, setForm] = useState(NO_FORM);
  const [found, setEncontrado] = useState(null);
  const [searching, setBuscando] = useState(false);
  const [saving, setGuardando] = useState(false);
  const [formError, setErrorForm] = useState(null);

  const [opened, setAbierto] = useState(null);
  const [preview, setVista] = useState(null);
  const [loadingPreview, setCargandoVista] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const clean = window.location.pathname + window.location.hash;
    window.history.replaceState(null, "", clean);
  }, [notice]);

  useEffect(() => {
    let cancelled = false;

    Promise.all([api.getMicrosoftApp(), api.listMicrosoftAccounts(), api.listSpreadsheets()])
      .then(([datosApp, datosCuentas, datosLibros]) => {
        if (cancelled) return;
        setApp(datosApp.app);
        setCuentas(datosCuentas.accounts);
        setLibros(datosLibros.sheets);
        setError(null);
      })
      .catch((failure) => {
        if (!cancelled) setError(failure.message);
      })
      .finally(() => {
        if (!cancelled) setCargando(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloads]);

  function reload() {
    setRecarga((actual) => actual + 1);
  }

  async function connect() {
    setError(null);
    try {
      const { url } = await api.connectMicrosoft();
      window.location.href = url;
    } catch (failure) {
      setError(failure.message);
    }
  }

  async function disconnect(account) {
    setError(null);
    try {
      await api.revokeMicrosoftAccount(account.id);
      setConfirmando(null);
      reload();
    } catch (failure) {
      setError(failure.message);
    }
  }

  async function saveApp(event) {
    event.preventDefault();
    setErrorApp(null);
    setGuardandoApp(true);
    try {
      const data = await api.setMicrosoftApp({
        tenantId: appForm.tenantId.trim() || "common",
        clientId: appForm.clientId.trim(),
        clientSecret: appForm.clientSecret.trim() || undefined,
      });
      setApp(data.app);
      setEditandoApp(false);
      setFormApp(NO_APP);
    } catch (failure) {
      setErrorApp(failure.message);
    } finally {
      setGuardandoApp(false);
    }
  }

  async function forgetApp() {
    setErrorApp(null);
    try {
      const data = await api.clearMicrosoftApp();
      setApp(data.app);
      setConfirmando(null);
    } catch (failure) {
      setErrorApp(failure.message);
    }
  }

  async function findBook(event) {
    event.preventDefault();
    setErrorForm(null);
    setEncontrado(null);
    setBuscando(true);
    try {
      const book = await api.resolveSpreadsheet(form.accountId, form.url.trim());
      setEncontrado(book);
      const first = book.tables[0] ?? book.worksheets[0];
      setForm({
        ...form,
        name: form.name || book.name,
        tableName: first ? first.name : "",
      });
    } catch (failure) {
      setErrorForm(failure.message);
    } finally {
      setBuscando(false);
    }
  }

  async function registerBook(event) {
    event.preventDefault();
    setErrorForm(null);
    setGuardando(true);
    try {
      await api.registerSpreadsheet({
        accountId: Number(form.accountId),
        name: form.name.trim(),
        driveId: found.driveId,
        itemId: found.itemId,
        tableName: form.tableName || null,
        webUrl: found.webUrl,
      });
      setForm(NO_FORM);
      setEncontrado(null);
      setRegistrando(false);
      reload();
    } catch (failure) {
      setErrorForm(failure.message);
    } finally {
      setGuardando(false);
    }
  }

  async function openBook(book) {
    if (opened === book.id) {
      setAbierto(null);
      setVista(null);
      return;
    }

    setAbierto(book.id);
    setVista(null);
    setError(null);
    setCargandoVista(true);
    try {
      const data = await api.previewSpreadsheet(book.id);
      setVista({ id: book.id, ...data });
    } catch (failure) {
      setError(failure.message);
    } finally {
      setCargandoVista(false);
    }
  }

  async function removeBook(book) {
    setError(null);
    try {
      await api.deleteSpreadsheet(book.id);
      setAbierto(null);
      setVista(null);
      setConfirmando(null);
      reload();
    } catch (failure) {
      setError(failure.message);
    }
  }

  if (loading) {
    return <p className="books-note">Cargando…</p>;
  }

  const live = accounts.filter((account) => account.revokedAt === null);
  const revoked = accounts.filter((account) => account.revokedAt !== null);
  const firstRun = app.source === null || live.length === 0;

  return (
    <section className="books">
      {notice ? (
        <p className={notice.ok ? "books-status" : "books-status is-bad"}>
          {notice.ok
            ? "Cuenta de Microsoft conectada."
            : (REASONS[notice.reason] ??
              "No se pudo conectar la cuenta. Vuelve a intentarlo.")}
          <button className="books-quiet" type="button" onClick={() => setAviso(null)}>
            Entendido
          </button>
        </p>
      ) : null}

      {error !== null ? <p className="books-error">{error}</p> : null}

      {firstRun ? (
        <div className="books-first">
          <ol>
            <li className={app.source === null ? "is-now" : "is-done"}>
              <span className="books-step">Paso 1</span>
              <strong>Registro de aplicación de Azure</strong>
              <p className="books-note">
                Es lo que autoriza a este sistema a pedirle archivos a Microsoft en nombre de one
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
                Los books se leen con el acceso de one persona, no con el del sistema.
              </p>
              <button
                className="books-btn is-primary"
                type="button"
                onClick={connect}
                disabled={app.source === null}
              >
                Conectar one account
              </button>
            </li>
          </ol>
        </div>
      ) : (
        <div className="books-strip">
          <span>
            Conectado a Microsoft con {live.length}{" "}
            {live.length === 1 ? "cuenta" : "cuentas"}
            {revoked.length === 0 ? "" : ` · ${revoked.length} desconectada`}
            {revoked.length > 1 ? "s" : ""}
          </span>
          <button
            className="books-quiet"
            type="button"
            onClick={() => setVerConexion(!showConnection)}
          >
            {showConnection ? "Ocultar la conexión" : "Administrar conexión"}
          </button>
        </div>
      )}

      {showConnection ? (
        <div className="books-connection">
          <section>
            <h3>Cuentas</h3>
            <ul className="books-accounts">
              {accounts.map((account) => (
                <li
                  className={account.revokedAt === null ? "books-account" : "books-account is-off"}
                  key={account.id}
                >
                  <span className="books-account-who">
                    {account.email}
                    {account.revokedAt === null ? null : (
                      <span className="books-off">desconectada</span>
                    )}
                  </span>
                  <span className="books-note">
                    La conectó {account.userFullName} el {shortDate(account.connectedAt)}
                    {account.lastUsedAt === null
                      ? ""
                      : ` · se usó el ${shortDate(account.lastUsedAt)}`}{" "}
                    · {account.sheetCount}{" "}
                    {account.sheetCount === 1 ? "libro depende" : "libros dependen"} de ella
                  </span>

                  {account.revokedAt === null ? (
                    confirming === `cuenta-${account.id}` ? (
                      <span className="books-action-row">
                        <span className="books-confirm">
                          {account.sheetCount === 0
                            ? "Ningún libro se lee con ella."
                            : `${account.sheetCount} ${
                                account.sheetCount === 1 ? "book deja" : "books dejan"
                              } de poder leerse hasta que alguien la reconecte.`}
                        </span>
                        <button
                          className="books-btn"
                          type="button"
                          onClick={() => disconnect(account)}
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
                        onClick={() => setConfirmando(`cuenta-${account.id}`)}
                      >
                        Desconectar
                      </button>
                    )
                  ) : (
                    <button className="books-quiet" type="button" onClick={connect}>
                      Reconectar
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <button className="books-btn" type="button" onClick={connect}>
              Conectar otra account
            </button>
          </section>

          <section>
            <h3>
              Registro de aplicación de Azure
              <Help text="Es lo que autoriza a este sistema a pedirle archivos a Microsoft en nombre de una persona. Se da de alta una vez, en el portal de Azure de la universidad." />
            </h3>

            {appError !== null ? <p className="books-error">{appError}</p> : null}

            {editingApp ? (
              <form className="books-grid" onSubmit={saveApp}>
                <label className="books-field">
                  <span className="books-label">Inquilino</span>
                  <input
                    value={appForm.tenantId}
                    onChange={(event) =>
                      setFormApp({ ...appForm, tenantId: event.target.value })
                    }
                    placeholder="Ej: common"
                  />
                </label>
                <label className="books-field">
                  <span className="books-label">Id de la aplicación</span>
                  <input
                    value={appForm.clientId}
                    onChange={(event) =>
                      setFormApp({ ...appForm, clientId: event.target.value })
                    }
                    required
                  />
                </label>
                <label className="books-field">
                  <span className="books-label">
                    Secreto
                    <Help text="El servidor nunca lo devuelve. Dejarlo vacío conserva el que ya está guardado." />
                  </span>
                  <input
                    type="password"
                    value={appForm.clientSecret}
                    onChange={(event) =>
                      setFormApp({ ...appForm, clientSecret: event.target.value })
                    }
                    placeholder={app.hasSecret ? "Se conserva el guardado" : ""}
                  />
                </label>

                <div className="books-field books-field-wide">
                  <span className="books-label">
                    URI de redirección que hay que registerBook en Azure
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
                  <button className="books-btn is-primary" type="submit" disabled={savingApp}>
                    {savingApp ? "Guardando…" : "Guardar el registro"}
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
                          app.updatedAt === null ? "" : ` el ${shortDate(app.updatedAt)}`
                        }. Id ${app.clientId}.`}
                </p>
                <div className="books-action-row">
                  {app.source === "database" ? (
                    confirming === "app" ? (
                      <>
                        <span className="books-confirm">
                          Si el servidor tiene uno en su archivo de entorno se usará ése; si no,
                          nadie podrá conectar cuentas hasta guardar otro.
                        </span>
                        <button className="books-btn" type="button" onClick={forgetApp}>
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
          {books.length} {books.length === 1 ? "libro registrado" : "libros registrados"}
        </p>
        <button
          className="books-btn is-primary"
          type="button"
          onClick={() => setRegistrando(true)}
          disabled={live.length === 0}
        >
          Registrar book
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
            {registering ? (
              <tr className="books-expanded">
                <td colSpan={4}>
                  <form className="books-register" onSubmit={found === null ? findBook : registerBook}>
                    <header className="books-register-head">
                      <span className="books-eyebrow">Registrar libro</span>
                      <button
                        className="books-close"
                        type="button"
                        onClick={() => {
                          setRegistrando(false);
                          setEncontrado(null);
                          setForm(NO_FORM);
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
                            : found === null
                              ? "is-now"
                              : "is-done"
                        }
                      >
                        Enlace
                      </li>
                      <li className={found === null ? "" : "is-now"}>Tabla y nombre</li>
                    </ol>

                    <div className="books-grid">
                      <label className="books-field">
                        <span className="books-label">
                          Se leerá con la cuenta
                          <Help text="El libro se lee con el acceso de esa persona. Si su cuenta se desconecta, el libro deja de poder leerse hasta que alguien la reconecte." />
                        </span>
                        <select
                          value={form.accountId}
                          onChange={(event) => setForm({ ...form, accountId: event.target.value })}
                          required
                        >
                          <option value="">Elige una cuenta</option>
                          {live.map((account) => (
                            <option value={account.id} key={account.id}>
                              {account.email}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="books-field books-field-wide">
                        <span className="books-label">
                          Enlace del book
                          <Help text="El enlace que da OneDrive o SharePoint al compartir o abrir el archivo. Otro tipo de enlace no se puede resolver." />
                        </span>
                        <input
                          value={form.url}
                          onChange={(event) => setForm({ ...form, url: event.target.value })}
                          placeholder="Ej: https://uaq-my.sharepoint.com/:x:/g/personal/…"
                          required
                        />
                      </label>
                    </div>

                    {found === null ? (
                      <div className="books-action-row">
                        <button className="books-btn is-primary" type="submit" disabled={searching}>
                          {searching ? "Buscando…" : "Buscar el libro"}
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="books-note">
                          Libro found: {found.name} · {found.tables.length}{" "}
                          {found.tables.length === 1 ? "tabla" : "tablas"},{" "}
                          {found.worksheets.length}{" "}
                          {found.worksheets.length === 1 ? "hoja" : "hojas"}
                        </p>

                        <div className="books-grid">
                          <label className="books-field">
                            <span className="books-label">
                              Tabla u worksheet
                              <Help text="Una tabla es mejor: sus columnas tienen nombre propio y no se mueven al insertar filas. Una hoja se lee por el texto de su primer renglón." />
                            </span>
                            <select
                              value={form.tableName}
                              onChange={(event) =>
                                setForm({ ...form, tableName: event.target.value })
                              }
                            >
                              {found.tables.map((table) => (
                                <option value={table.name} key={`t-${table.name}`}>
                                  Tabla · {table.name}
                                </option>
                              ))}
                              {found.worksheets.map((worksheet) => (
                                <option value={worksheet.name} key={`h-${worksheet.name}`}>
                                  Hoja · {worksheet.name}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="books-field">
                            <span className="books-label">Cómo se va a llamar aquí</span>
                            <input
                              value={form.name}
                              onChange={(event) => setForm({ ...form, name: event.target.value })}
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
                            disabled={saving}
                          >
                            {saving ? "Registrando…" : "Registrar libro"}
                          </button>
                        </div>
                      </>
                    )}

                    {formError !== null ? <p className="books-error">{formError}</p> : null}
                  </form>
                </td>
              </tr>
            ) : null}

            {books.map((book) => (
              <Fragment key={book.id}>
                <tr
                  className={
                    book.accountRevoked ? "books-row is-stale" : "books-row"
                  }
                  onClick={() => openBook(book)}
                >
                  <td className="books-cell-main">
                    <span className="books-kind">
                      {book.tableName === null ? "Hoja" : "Tabla"}
                      {book.tableName === null ? "" : ` · ${book.tableName}`}
                    </span>
                    <span className="books-row-name">{book.name}</span>
                  </td>
                  <td>
                    {book.accountEmail}
                    {book.accountRevoked ? <span className="books-off">desconectada</span> : null}
                  </td>
                  <td>
                    {book.mapped ? (
                      `${book.schemaName} v${book.schemaVersion}`
                    ) : (
                      <span className="books-off">Sin mapear</span>
                    )}
                  </td>
                  <td>{lastImport(book)}</td>
                </tr>

                {opened === book.id ? (
                  <tr className="books-expanded">
                    <td colSpan={4}>
                      <div className="books-open">
                        <SheetPreview preview={preview} loading={loadingPreview} />

                        <div className="books-facts">
                          <div className="books-fact">
                            <span className="books-label">Formato</span>
                            {book.mapped
                              ? `${book.schemaName} v${book.schemaVersion}`
                              : "Sin mapear"}
                          </div>
                          <div className="books-fact">
                            <span className="books-label">Última importación</span>
                            {lastImport(book)}
                          </div>
                          <div className="books-fact">
                            <span className="books-label">Se lee con</span>
                            {book.accountEmail}
                            {book.accountRevoked ? " (desconectada)" : ""}
                          </div>
                          <div className="books-fact">
                            <span className="books-label">Lo registró</span>
                            {book.registeredByName ?? "alguien que ya no está"} el{" "}
                            {shortDate(book.createdAt)}
                          </div>
                          {book.webUrl === null ? null : (
                            <a
                              className="books-quiet"
                              href={book.webUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Abrir el book ↗
                            </a>
                          )}
                        </div>

                        <footer className="books-open-foot">
                          {confirming === `libro-${book.id}` ? (
                            <span className="books-action-row">
                              <span className="books-confirm">
                                Las solicitudes que ya se importaron se quedan: solo deja de
                                leerse el book.
                              </span>
                              <button
                                className="books-btn"
                                type="button"
                                onClick={() => removeBook(book)}
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
                              onClick={() => setConfirmando(`libro-${book.id}`)}
                            >
                              Quitar del registro
                            </button>
                          )}

                          {book.accountRevoked ? (
                            <button className="books-btn is-primary" type="button" onClick={connect}>
                              Reconectar la account
                            </button>
                          ) : (
                            <button
                              className="books-btn is-primary"
                              type="button"
                              onClick={() => (onGo === null ? null : onGo("Importar de Excel"))}
                              disabled={onGo === null}
                            >
                              {book.mapped ? "Importar filas nuevas" : "Mapear e importar"}
                            </button>
                          )}
                        </footer>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}

            {books.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <p className="books-empty">
                    {live.length === 0
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
