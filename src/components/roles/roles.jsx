import { Fragment, useEffect, useState } from "react";

import * as api from "../../api/client.js";

// Los mismos límites que el servidor: se ponen en los inputs para no mandar algo que va a
// rechazar.
const ROL_NOMBRE_MAX = 50;
const PERMISO_CODIGO_MAX = 100;
const PERMISO_ETIQUETA_MAX = 200;

// Los formularios vacíos: sirven para empezar y para limpiarlos después de registrar.
const FORMULARIO_ROL_VACIO = { name: "", description: "" };
const FORMULARIO_PERMISO_VACIO = { code: "", label: "", description: "" };

function Roles() {
  const [roles, setRoles] = useState([]);
  const [permisos, setPermisos] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Sube de uno en uno para volver a pedir las listas después de crear, editar o borrar.
  const [recarga, setRecarga] = useState(0);

  // El formulario de alta de rol
  const [form, setForm] = useState(FORMULARIO_ROL_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState(null);

  const [edicion, setEdicion] = useState(null);

  // El rol cuyo panel de permisos está desplegado: null si ninguno.
  const [abierto, setAbierto] = useState(null);

  // Los códigos marcados en el panel desplegado; se llenan con los que el rol ya tiene.
  const [seleccion, setSeleccion] = useState([]);
  const [cargandoPermisos, setCargandoPermisos] = useState(false);
  const [guardandoPermisos, setGuardandoPermisos] = useState(false);

  // El formulario de alta de permiso
  const [formPermiso, setFormPermiso] = useState(FORMULARIO_PERMISO_VACIO);
  const [guardandoPermiso, setGuardandoPermiso] = useState(false);
  const [errorPermiso, setErrorPermiso] = useState(null);

  const [edicionPermiso, setEdicionPermiso] = useState(null);

  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;

    Promise.all([api.listRoles(), api.listPermissions()])
      .then(([datosRoles, datosPermisos]) => {
        if (cancelado) return;
        setRoles(datosRoles.roles);
        setPermisos(datosPermisos.permissions);
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

  // --- Roles ---

  function handleChange(event) {
    const { name, value } = event.target;
    setForm({ ...form, [name]: value });
  }

  async function handleCrear(event) {
    event.preventDefault();
    setErrorForm(null);
    setGuardando(true);

    try {
      await api.createRole({
        name: form.name.trim(),
        description: form.description.trim() || null,
      });
      setForm(FORMULARIO_ROL_VACIO);
      setRecarga(recarga + 1);
    } catch (err) {
      setErrorForm(err.message);
    } finally {
      setGuardando(false);
    }
  }

  function handleEditar(rol) {
    setError(null);
    setEdicion({
      id: rol.id,
      name: rol.name,
      description: rol.description ?? "",
    });
  }

  function handleEdicionChange(event) {
    const { name, value } = event.target;
    setEdicion({ ...edicion, [name]: value });
  }

  async function handleGuardar(event) {
    event.preventDefault();
    setError(null);

    try {
      await api.updateRole(edicion.id, {
        name: edicion.name.trim(),
        description: edicion.description.trim() || null,
      });
      setEdicion(null);
      setRecarga(recarga + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleBorrar(rol) {
    const seguro = window.confirm(`¿Eliminar el rol ${rol.name}?`);
    if (!seguro) return;

    setError(null);

    try {
      await api.deleteRole(rol.id);
      setRecarga(recarga + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  // --- Permisos de un rol ---

  async function handleDesplegar(rol) {
    setError(null);

    if (abierto === rol.id) {
      setAbierto(null);
      setSeleccion([]);
      return;
    }

    setAbierto(rol.id);
    setSeleccion([]);
    setCargandoPermisos(true);

    try {
      const data = await api.getRolePermissions(rol.id);
      setSeleccion(data.permissions.map((permiso) => permiso.code));
    } catch (err) {
      setError(err.message);
    } finally {
      setCargandoPermisos(false);
    }
  }

  function handleMarcar(event) {
    const { value, checked } = event.target;
    if (checked) setSeleccion([...seleccion, value]);
    else setSeleccion(seleccion.filter((codigo) => codigo !== value));
  }

  async function handleGuardarPermisos(event, rol) {
    event.preventDefault();
    setError(null);
    setGuardandoPermisos(true);

    try {
      await api.setRolePermissions(rol.id, seleccion);
      setAbierto(null);
      setSeleccion([]);
      setRecarga(recarga + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardandoPermisos(false);
    }
  }

  // --- Catálogo de permisos ---

  function handlePermisoChange(event) {
    const { name, value } = event.target;
    setFormPermiso({ ...formPermiso, [name]: value });
  }

  async function handleCrearPermiso(event) {
    event.preventDefault();
    setErrorPermiso(null);
    setGuardandoPermiso(true);

    try {
      await api.createPermission({
        code: formPermiso.code.trim(),
        label: formPermiso.label.trim(),
        description: formPermiso.description.trim() || null,
      });
      setFormPermiso(FORMULARIO_PERMISO_VACIO);
      setRecarga(recarga + 1);
    } catch (err) {
      setErrorPermiso(err.message);
    } finally {
      setGuardandoPermiso(false);
    }
  }

  function handleEditarPermiso(permiso) {
    setError(null);
    setEdicionPermiso({
      id: permiso.id,
      code: permiso.code,
      label: permiso.label,
      description: permiso.description ?? "",
    });
  }

  function handleEdicionPermisoChange(event) {
    const { name, value } = event.target;
    setEdicionPermiso({ ...edicionPermiso, [name]: value });
  }

  async function handleGuardarPermiso(event) {
    event.preventDefault();
    setError(null);

    try {
      await api.updatePermission(edicionPermiso.id, {
        code: edicionPermiso.code.trim(),
        label: edicionPermiso.label.trim(),
        description: edicionPermiso.description.trim() || null,
      });
      setEdicionPermiso(null);
      setRecarga(recarga + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleBorrarPermiso(permiso) {
    const seguro = window.confirm(
      `¿Eliminar el permiso ${permiso.code}? Se le quita a todos los roles que lo tienen.`,
    );
    if (!seguro) return;

    setError(null);

    try {
      await api.deletePermission(permiso.id);
      setRecarga(recarga + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="roles-panel">
      <header className="roles-header">
        <h1 className="roles-title">Roles</h1>

        <p className="roles-count">
          {roles.length} {roles.length === 1 ? "rol" : "roles"}
        </p>
      </header>

      {/* FORMULARIO DE ALTA DE ROL */}
      <form className="role-form" onSubmit={handleCrear}>
        <h2 className="role-form-title">Registrar un rol</h2>

        <div className="role-form-field">
          <label className="role-form-label" htmlFor="role-name">
            Nombre
          </label>

          <input
            className="role-form-input"
            id="role-name"
            name="name"
            type="text"
            required
            maxLength={ROL_NOMBRE_MAX}
            value={form.name}
            onChange={handleChange}
          />
        </div>

        <div className="role-form-field">
          <label className="role-form-label" htmlFor="role-description">
            Descripción (opcional)
          </label>

          <textarea
            className="role-form-textarea"
            id="role-description"
            name="description"
            rows={3}
            value={form.description}
            onChange={handleChange}
          />
        </div>

        <p className="role-form-error" role="alert">
          {errorForm}
        </p>

        <button className="role-form-submit" type="submit" disabled={guardando}>
          {guardando ? "Registrando..." : "Registrar rol"}
        </button>
      </form>

      <p className="roles-error" role="alert">
        {error}
      </p>

      {/* TABLA DE ROLES */}
      <table className="roles-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Descripción</th>
            <th>Permisos</th>
            <th>Acciones</th>
          </tr>
        </thead>

        <tbody>
          {roles.map((rol) =>
            edicion && edicion.id === rol.id ? (
              // La fila en edición: los mismos campos que el formulario de alta.
              <tr className="roles-row editing" key={rol.id}>
                <td className="roles-cell-name">
                  <input
                    className="roles-edit-input"
                    name="name"
                    type="text"
                    required
                    maxLength={ROL_NOMBRE_MAX}
                    form={`role-edit-${rol.id}`}
                    value={edicion.name}
                    onChange={handleEdicionChange}
                  />

                  {/* El servidor compara el nombre del rol con el que trae la sesión, así
                      que renombrarlo deja fuera a quienes lo tienen hasta que vuelvan a
                      entrar. */}
                  <p className="roles-edit-hint">
                    Al renombrar un rol, quienes lo tienen deben volver a iniciar
                    sesión.
                  </p>
                </td>

                <td className="roles-cell-description">
                  <input
                    className="roles-edit-input"
                    name="description"
                    type="text"
                    form={`role-edit-${rol.id}`}
                    value={edicion.description}
                    onChange={handleEdicionChange}
                  />
                </td>

                <td className="roles-cell-permissions">—</td>

                <td className="roles-cell-actions">
                  {/* El <form> vive aquí y los inputs de las otras celdas lo referencian con
                      `form=`: un <form> no puede envolver varios <td>. */}
                  <form id={`role-edit-${rol.id}`} onSubmit={handleGuardar}>
                    <button className="roles-action" type="submit">
                      Guardar
                    </button>

                    <button
                      className="roles-action"
                      type="button"
                      onClick={() => setEdicion(null)}
                    >
                      Cancelar
                    </button>
                  </form>
                </td>
              </tr>
            ) : (
              <Fragment key={rol.id}>
                <tr
                  className={`roles-row ${abierto === rol.id ? "open" : ""}`}
                >
                  <td className="roles-cell-name">{rol.name}</td>

                  <td className="roles-cell-description">
                    {rol.description ?? "—"}
                  </td>

                  <td className="roles-cell-permissions">
                    <button
                      className="roles-permissions-toggle"
                      type="button"
                      aria-expanded={abierto === rol.id}
                      onClick={() => handleDesplegar(rol)}
                    >
                      {abierto === rol.id ? "Ocultar ▴" : "Ver permisos ▾"}
                    </button>
                  </td>

                  <td className="roles-cell-actions">
                    <button
                      className="roles-action"
                      type="button"
                      disabled={edicion !== null}
                      onClick={() => handleEditar(rol)}
                    >
                      Editar
                    </button>

                    {/* El servidor rechaza borrar un rol que alguien todavía tiene y dice
                        cuántas personas son; ese mensaje se muestra tal cual arriba. */}
                    <button
                      className="roles-action roles-action-danger"
                      type="button"
                      disabled={edicion !== null}
                      onClick={() => handleBorrar(rol)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>

                {/* PANEL DE PERMISOS DEL ROL */}
                {abierto === rol.id && (
                  <tr className="roles-grants-row">
                    <td className="roles-grants-panel" colSpan={4}>
                      <h3 className="roles-grants-title">
                        Permisos de {rol.name}
                      </h3>

                      {cargandoPermisos && (
                        <p className="roles-grants-loading">Cargando...</p>
                      )}

                      {/* Quitarle permisos al rol admin es quitárselos a quien administra
                          los permisos: si se pierde area.manage, por ejemplo, ya nadie puede
                          devolverlo desde la aplicación. */}
                      {rol.name === "admin" && (
                        <p className="roles-grants-hint">
                          Este es el rol que administra el sistema. Si le quitas un
                          permiso, nadie podrá devolvérselo desde aquí.
                        </p>
                      )}

                      <form
                        className="roles-grants-form"
                        onSubmit={(event) => handleGuardarPermisos(event, rol)}
                      >
                        <ul className="roles-grants-list">
                          {permisos.map((permiso) => (
                            <li className="roles-grant" key={permiso.id}>
                              <label
                                className="roles-grant-label"
                                htmlFor={`grant-${rol.id}-${permiso.id}`}
                              >
                                <input
                                  className="roles-grant-check"
                                  id={`grant-${rol.id}-${permiso.id}`}
                                  type="checkbox"
                                  value={permiso.code}
                                  checked={seleccion.includes(permiso.code)}
                                  disabled={cargandoPermisos}
                                  onChange={handleMarcar}
                                />

                                <span className="roles-grant-name">
                                  {permiso.label}
                                </span>

                                <code className="roles-grant-code">
                                  {permiso.code}
                                </code>
                              </label>
                            </li>
                          ))}
                        </ul>

                        {permisos.length === 0 && (
                          <p className="roles-grants-empty">
                            No hay permisos en el catálogo.
                          </p>
                        )}

                        <button
                          className="roles-grants-submit"
                          type="submit"
                          disabled={cargandoPermisos || guardandoPermisos}
                        >
                          {guardandoPermisos ? "Guardando..." : "Guardar permisos"}
                        </button>

                        <button
                          className="roles-action"
                          type="button"
                          onClick={() => handleDesplegar(rol)}
                        >
                          Cancelar
                        </button>
                      </form>
                    </td>
                  </tr>
                )}
              </Fragment>
            ),
          )}
        </tbody>
      </table>

      {cargando && <p className="roles-loading">Cargando...</p>}

      {!cargando && roles.length === 0 && (
        <p className="roles-empty">Todavía no hay roles registrados.</p>
      )}

      {/* CATÁLOGO DE PERMISOS */}
      <section className="permissions-panel">
        <header className="permissions-header">
          <h2 className="permissions-title">Catálogo de permisos</h2>

          <p className="permissions-count">
            {permisos.length} {permisos.length === 1 ? "permiso" : "permisos"}
          </p>
        </header>

        {/* FORMULARIO DE ALTA DE PERMISO */}
        <form className="permission-form" onSubmit={handleCrearPermiso}>
          <h3 className="permission-form-title">Registrar un permiso</h3>

          <div className="permission-form-field">
            <label className="permission-form-label" htmlFor="permission-code">
              Código
            </label>

            <input
              className="permission-form-input"
              id="permission-code"
              name="code"
              type="text"
              required
              maxLength={PERMISO_CODIGO_MAX}
              placeholder="proyecto.editar"
              value={formPermiso.code}
              onChange={handlePermisoChange}
            />

            <p className="permission-form-hint">
              En minúsculas y separado por puntos, p. ej. project.write. Es el
              nombre con el que el servidor lo reconoce.
            </p>
          </div>

          <div className="permission-form-field">
            <label
              className="permission-form-label"
              htmlFor="permission-label"
            >
              Etiqueta
            </label>

            <input
              className="permission-form-input"
              id="permission-label"
              name="label"
              type="text"
              required
              maxLength={PERMISO_ETIQUETA_MAX}
              value={formPermiso.label}
              onChange={handlePermisoChange}
            />
          </div>

          <div className="permission-form-field">
            <label
              className="permission-form-label"
              htmlFor="permission-description"
            >
              Descripción (opcional)
            </label>

            <textarea
              className="permission-form-textarea"
              id="permission-description"
              name="description"
              rows={2}
              value={formPermiso.description}
              onChange={handlePermisoChange}
            />
          </div>

          <p className="permission-form-error" role="alert">
            {errorPermiso}
          </p>

          <button
            className="permission-form-submit"
            type="submit"
            disabled={guardandoPermiso}
          >
            {guardandoPermiso ? "Registrando..." : "Registrar permiso"}
          </button>
        </form>

        {/* TABLA DE PERMISOS */}
        <table className="permissions-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Etiqueta</th>
              <th>Descripción</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {permisos.map((permiso) =>
              edicionPermiso && edicionPermiso.id === permiso.id ? (
                <tr className="permissions-row editing" key={permiso.id}>
                  <td className="permissions-cell-code">
                    <input
                      className="permissions-edit-input"
                      name="code"
                      type="text"
                      required
                      maxLength={PERMISO_CODIGO_MAX}
                      form={`permission-edit-${permiso.id}`}
                      value={edicionPermiso.code}
                      onChange={handleEdicionPermisoChange}
                    />
                  </td>

                  <td className="permissions-cell-label">
                    <input
                      className="permissions-edit-input"
                      name="label"
                      type="text"
                      required
                      maxLength={PERMISO_ETIQUETA_MAX}
                      form={`permission-edit-${permiso.id}`}
                      value={edicionPermiso.label}
                      onChange={handleEdicionPermisoChange}
                    />
                  </td>

                  <td className="permissions-cell-description">
                    <input
                      className="permissions-edit-input"
                      name="description"
                      type="text"
                      form={`permission-edit-${permiso.id}`}
                      value={edicionPermiso.description}
                      onChange={handleEdicionPermisoChange}
                    />
                  </td>

                  <td className="permissions-cell-actions">
                    <form
                      id={`permission-edit-${permiso.id}`}
                      onSubmit={handleGuardarPermiso}
                    >
                      <button className="roles-action" type="submit">
                        Guardar
                      </button>

                      <button
                        className="roles-action"
                        type="button"
                        onClick={() => setEdicionPermiso(null)}
                      >
                        Cancelar
                      </button>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr className="permissions-row" key={permiso.id}>
                  <td className="permissions-cell-code">
                    <code>{permiso.code}</code>
                  </td>

                  <td className="permissions-cell-label">{permiso.label}</td>

                  <td className="permissions-cell-description">
                    {permiso.description ?? "—"}
                  </td>

                  <td className="permissions-cell-actions">
                    <button
                      className="roles-action"
                      type="button"
                      disabled={edicionPermiso !== null}
                      onClick={() => handleEditarPermiso(permiso)}
                    >
                      Editar
                    </button>

                    <button
                      className="roles-action roles-action-danger"
                      type="button"
                      disabled={edicionPermiso !== null}
                      onClick={() => handleBorrarPermiso(permiso)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>

        {!cargando && permisos.length === 0 && (
          <p className="permissions-empty">
            Todavía no hay permisos en el catálogo.
          </p>
        )}
      </section>
    </section>
  );
}

export default Roles;
