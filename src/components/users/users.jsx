// Pestaña "Personal": la lista de la gente que trabaja aquí y el formulario para dar de
// alta a alguien nuevo. Solo la ven los administradores. Los estilos van en users.css.
//
// Al crear una cuenta el servidor devuelve un token de invitación y no lo guarda: esa
// respuesta es la única vez que se puede ver, por eso se muestra en una tarjeta aparte.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import "./users.css";

// Cuántas personas se muestran por página.
const PAGE = 25;

// Los roles llegan del servidor en inglés; aquí se traducen para mostrarlos. Si aparece uno
// que no está en la lista, se muestra tal cual.
const ROLES_EN_ESPANOL = {
  admin: "Coordinación",
  area_lead: "Responsable de área",
  worker: "Integrante",
  finance: "Finanzas",
};

// El formulario vacío: sirve para empezar y para limpiarlo después de crear a alguien.
const FORMULARIO_VACIO = {
  fullName: "",
  email: "",
  roleId: "",
  contractTypeId: "",
  primaryAreaId: "",
  birthday: "",
  isAreaLeader: false,
};

// `admin` es quien está usando la pantalla, no una de las personas de la lista.
function Users({ admin }) {
  // La lista
  const [usuarios, setUsuarios] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [cargando, setCargando] = useState(true);

  // Sube de uno en uno para volver a pedir la lista después de crear o dar de baja.
  const [recarga, setRecarga] = useState(0);

  // Los filtros de arriba de la tabla
  const [filtroRol, setFiltroRol] = useState("");
  const [filtroArea, setFiltroArea] = useState("");
  const [verBajas, setVerBajas] = useState(false);

  // Los catálogos que llenan los <select>
  const [roles, setRoles] = useState([]);
  const [areas, setAreas] = useState([]);
  const [contratos, setContratos] = useState([]);

  // El formulario de alta
  const [form, setForm] = useState(FORMULARIO_VACIO);
  const [invitacion, setInvitacion] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const [error, setError] = useState(null);
  const [errorForm, setErrorForm] = useState(null);

  // Los catálogos se piden una sola vez, al abrir la pestaña.
  useEffect(() => {
    api
      .listRoles()
      .then((data) => setRoles(data.roles))
      .catch((err) => setError(err.message));

    api
      .listAreas()
      .then((data) => setAreas(data.areas))
      .catch((err) => setError(err.message));

    api
      .listContractTypes()
      .then((data) => setContratos(data.contractTypes))
      .catch((err) => setError(err.message));
  }, []);

  // La lista se vuelve a pedir cada vez que cambia un filtro, la página o `recarga`.
  useEffect(() => {
    // Si el usuario cambia de filtro antes de que llegue la respuesta anterior, esta
    // bandera evita que la vieja pise a la nueva.
    let cancelado = false;

    api
      .listUsers({
        limit: PAGE,
        offset,
        roleId: filtroRol,
        areaId: filtroArea,
        includeDeleted: verBajas ? "true" : "",
      })
      .then((pagina) => {
        if (cancelado) return;
        setUsuarios(pagina.users);
        setTotal(pagina.total);
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
  }, [offset, filtroRol, filtroArea, verBajas, recarga]);

  // Un solo manejador para todo el formulario: cada input tiene su `name`.
  function handleChange(event) {
    const { name, type, value, checked } = event.target;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
  }

  async function handleCrear(event) {
    event.preventDefault();
    setErrorForm(null);
    setGuardando(true);

    try {
      const creado = await api.createUser({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        roleId: Number(form.roleId),
        contractTypeId: Number(form.contractTypeId),
        // Un <select> sin elegir vale ""; el servidor espera null.
        primaryAreaId: form.primaryAreaId ? Number(form.primaryAreaId) : null,
        birthday: form.birthday || null,
        isAreaLeader: form.primaryAreaId ? form.isAreaLeader : false,
      });

      setInvitacion({ nombre: creado.user.fullName, token: creado.inviteToken });
      setForm(FORMULARIO_VACIO);
      setOffset(0);
      setRecarga(recarga + 1);
    } catch (err) {
      setErrorForm(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function handleReinvitar(usuario) {
    setError(null);

    try {
      const respuesta = await api.reinviteUser(usuario.id);
      setInvitacion({ nombre: usuario.fullName, token: respuesta.inviteToken });
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleBaja(usuario) {
    const seguro = window.confirm(
      `¿Dar de baja a ${usuario.fullName}? Su sesión se cierra de inmediato.`,
    );
    if (!seguro) return;

    setError(null);

    try {
      await api.deleteUser(usuario.id);
      setRecarga(recarga + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  const desde = total === 0 ? 0 : offset + 1;
  const hasta = Math.min(offset + PAGE, total);

  return (
    <section className="users-panel">
      <header className="users-header">
        <h1 className="users-title">Personal</h1>

        <p className="users-count">
          {total} {total === 1 ? "persona" : "personas"}
        </p>
      </header>

      {/* INVITACIÓN RECIÉN CREADA */}
      {invitacion && (
        <aside className="invite-card">
          <h2 className="invite-title">Invitación para {invitacion.nombre}</h2>

          <p className="invite-note">
            Este token se muestra una sola vez. Compártelo con la persona para que active su
            cuenta y elija contraseña.
          </p>

          <textarea className="invite-token" readOnly rows={3} value={invitacion.token} />

          <div className="invite-actions">
            <button
              className="invite-copy"
              type="button"
              onClick={() => navigator.clipboard.writeText(invitacion.token)}
            >
              Copiar
            </button>

            <button
              className="invite-dismiss"
              type="button"
              onClick={() => setInvitacion(null)}
            >
              Listo
            </button>
          </div>
        </aside>
      )}

      {/* FORMULARIO DE ALTA */}
      <form className="user-form" onSubmit={handleCrear}>
        <h2 className="user-form-title">Dar de alta a una persona</h2>

        <div className="user-form-field">
          <label className="user-form-label" htmlFor="user-full-name">
            Nombre completo
          </label>

          <input
            className="user-form-input"
            id="user-full-name"
            name="fullName"
            type="text"
            required
            maxLength={200}
            value={form.fullName}
            onChange={handleChange}
          />
        </div>

        <div className="user-form-field">
          <label className="user-form-label" htmlFor="user-email">
            Correo institucional
          </label>

          <input
            className="user-form-input"
            id="user-email"
            name="email"
            type="email"
            required
            placeholder="nombre@uaq.mx"
            value={form.email}
            onChange={handleChange}
          />
        </div>

        <div className="user-form-field">
          <label className="user-form-label" htmlFor="user-role">
            Rol
          </label>

          <select
            className="user-form-select"
            id="user-role"
            name="roleId"
            required
            value={form.roleId}
            onChange={handleChange}
          >
            <option value="">Selecciona un rol</option>

            {roles.map((rol) => (
              <option key={rol.id} value={rol.id}>
                {ROLES_EN_ESPANOL[rol.name] ?? rol.name}
              </option>
            ))}
          </select>
        </div>

        <div className="user-form-field">
          <label className="user-form-label" htmlFor="user-contract-type">
            Tipo de contrato
          </label>

          <select
            className="user-form-select"
            id="user-contract-type"
            name="contractTypeId"
            required
            value={form.contractTypeId}
            onChange={handleChange}
          >
            <option value="">Selecciona un tipo</option>

            {contratos.map((contrato) => (
              <option key={contrato.id} value={contrato.id}>
                {contrato.name}
              </option>
            ))}
          </select>

          <p className="user-form-hint">
            Determina los días de permiso a los que la persona tiene derecho.
          </p>
        </div>

        <div className="user-form-field">
          <label className="user-form-label" htmlFor="user-area">
            Área principal
          </label>

          <select
            className="user-form-select"
            id="user-area"
            name="primaryAreaId"
            value={form.primaryAreaId}
            onChange={handleChange}
          >
            <option value="">Sin área</option>

            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </div>

        <div className="user-form-field user-form-field-check">
          <input
            className="user-form-check"
            id="user-area-leader"
            name="isAreaLeader"
            type="checkbox"
            disabled={!form.primaryAreaId}
            checked={form.isAreaLeader}
            onChange={handleChange}
          />

          <label className="user-form-label" htmlFor="user-area-leader">
            Es responsable del área
          </label>
        </div>

        <div className="user-form-field">
          <label className="user-form-label" htmlFor="user-birthday">
            Cumpleaños (opcional)
          </label>

          <input
            className="user-form-input"
            id="user-birthday"
            name="birthday"
            type="date"
            value={form.birthday}
            onChange={handleChange}
          />
        </div>

        <p className="user-form-error" role="alert">
          {errorForm}
        </p>

        <button className="user-form-submit" type="submit" disabled={guardando}>
          {guardando ? "Creando..." : "Crear cuenta e invitar"}
        </button>
      </form>

      {/* FILTROS */}
      <div className="users-filters">
        <div className="users-filter">
          <label className="users-filter-label" htmlFor="filter-role">
            Rol
          </label>

          <select
            className="users-filter-select"
            id="filter-role"
            value={filtroRol}
            onChange={(event) => {
              setFiltroRol(event.target.value);
              setOffset(0);
            }}
          >
            <option value="">Todos</option>

            {roles.map((rol) => (
              <option key={rol.id} value={rol.id}>
                {ROLES_EN_ESPANOL[rol.name] ?? rol.name}
              </option>
            ))}
          </select>
        </div>

        <div className="users-filter">
          <label className="users-filter-label" htmlFor="filter-area">
            Área
          </label>

          <select
            className="users-filter-select"
            id="filter-area"
            value={filtroArea}
            onChange={(event) => {
              setFiltroArea(event.target.value);
              setOffset(0);
            }}
          >
            <option value="">Todas</option>

            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </div>

        <div className="users-filter users-filter-check">
          <input
            className="users-filter-checkbox"
            id="filter-deleted"
            type="checkbox"
            checked={verBajas}
            onChange={(event) => {
              setVerBajas(event.target.checked);
              setOffset(0);
            }}
          />

          <label className="users-filter-label" htmlFor="filter-deleted">
            Ver dados de baja
          </label>
        </div>
      </div>

      <p className="users-error" role="alert">
        {error}
      </p>

      {/* TABLA */}
      <table className="users-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Correo</th>
            <th>Rol</th>
            <th>Áreas</th>
            <th>Acciones</th>
          </tr>
        </thead>

        <tbody>
          {usuarios.map((usuario) => (
            <tr className={`users-row ${usuario.deletedAt ? "deleted" : ""}`} key={usuario.id}>
              <td className="users-cell-name">{usuario.fullName}</td>

              <td className="users-cell-email">{usuario.email}</td>

              <td className="users-cell-role">
                {ROLES_EN_ESPANOL[usuario.role] ?? usuario.role}
              </td>

              <td className="users-cell-areas">
                {usuario.areas.length === 0
                  ? "—"
                  : usuario.areas.map((area) => area.name).join(", ")}
              </td>

              <td className="users-cell-actions">
                <button
                  className="users-action"
                  type="button"
                  onClick={() => handleReinvitar(usuario)}
                >
                  Reinvitar
                </button>

                {/* Darte de baja a ti mismo cierra tu propia sesión, así que no se puede. */}
                <button
                  className="users-action users-action-danger"
                  type="button"
                  disabled={usuario.id === admin.id || Boolean(usuario.deletedAt)}
                  onClick={() => handleBaja(usuario)}
                >
                  Dar de baja
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {cargando && <p className="users-loading">Cargando...</p>}

      {!cargando && usuarios.length === 0 && (
        <p className="users-empty">No hay personas que coincidan con estos filtros.</p>
      )}

      {/* PÁGINAS */}
      <nav className="users-pagination">
        <button
          className="users-page-prev"
          type="button"
          disabled={offset === 0}
          onClick={() => setOffset(offset - PAGE)}
        >
          Anterior
        </button>

        <span className="users-page-range">
          {desde}–{hasta} de {total}
        </span>

        <button
          className="users-page-next"
          type="button"
          disabled={hasta >= total}
          onClick={() => setOffset(offset + PAGE)}
        >
          Siguiente
        </button>
      </nav>
    </section>
  );
}

export default Users;
