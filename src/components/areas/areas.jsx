import { Fragment, useEffect, useState } from "react";

import * as api from "../../api/client.js";
import "./areas.css";


const PERSONAS_MAX = 50;

// Los roles llegan del servidor en inglés; los mismos nombres que usa users.jsx.
const ROLES_EN_ESPANOL = {
  admin: "Coordinación",
  area_lead: "Responsable de área",
  worker: "Integrante",
  finance: "Finanzas",
};

// El formulario vacío: sirve para empezar y para limpiarlo después de crear un área.
const FORMULARIO_VACIO = {
  name: "",
  description: "",
  parentAreaId: "",
  leaderUserId: "",
};

// Recorre el árbol de arriba a abajo y devuelve las áreas en una sola lista, cada una con
// su `depth` y el nombre de su área superior, en el orden en que se leen en un organigrama.
function aplanar(nodos, padre = null, acumulado = []) {
  for (const nodo of nodos) {
    acumulado.push({ ...nodo, parentName: padre ? padre.name : null });
    aplanar(nodo.children, nodo, acumulado);
  }
  return acumulado;
}

// Las áreas que cuelgan de `area` (ella incluida): un área no puede ser su propia superior
// ni colgar de una de sus hijas, así que estas se sacan del <select> al editar.
function descendientes(area) {
  const ids = new Set([area.id]);
  for (const hija of area.children) {
    for (const id of descendientes(hija)) ids.add(id);
  }
  return ids;
}

function Areas() {
  const [areas, setAreas] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Sube de uno en uno para volver a pedir la lista después de crear, editar o borrar.
  const [recarga, setRecarga] = useState(0);

  const [personas, setPersonas] = useState([]);

  // El formulario de alta
  const [form, setForm] = useState(FORMULARIO_VACIO);
  const [guardando, setGuardando] = useState(false);

  const [edicion, setEdicion] = useState(null);

  // El área cuyo panel de integrantes está desplegado: null si ninguno.
  const [abierta, setAbierta] = useState(null);

  // El formulario de "agregar integrante" del panel desplegado.
  const [nuevoMiembro, setNuevoMiembro] = useState({ userId: "", isAreaLeader: false });

  const [error, setError] = useState(null);
  const [errorForm, setErrorForm] = useState(null);

  // Las personas se piden una sola vez, al abrir la pestaña.
  useEffect(() => {
    api
      .listUsers({ limit: PERSONAS_MAX })
      .then((pagina) => setPersonas(pagina.users))
      .catch((err) => setError(err.message));
  }, []);

  // La lista se vuelve a pedir cada vez que cambia `recarga`.
  useEffect(() => {
    let cancelado = false;

    api
      .getOrgChart()
      .then((data) => {
        if (cancelado) return;
        setAreas(aplanar(data.roots));
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

  // Un solo manejador para todo el formulario: cada input tiene su `name`.
  function handleChange(event) {
    const { name, value } = event.target;
    setForm({ ...form, [name]: value });
  }

  async function handleCrear(event) {
    event.preventDefault();
    setErrorForm(null);
    setGuardando(true);

    // Omitir la clave y mandarla en null no es lo mismo para el servidor (ver client.js).
    const input = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      leaderUserId: form.leaderUserId ? Number(form.leaderUserId) : null,
    };
    if (form.parentAreaId === "raiz") input.parentAreaId = null;
    else if (form.parentAreaId) input.parentAreaId = Number(form.parentAreaId);

    try {
      await api.createArea(input);
      setForm(FORMULARIO_VACIO);
      setRecarga(recarga + 1);
    } catch (err) {
      setErrorForm(err.message);
    } finally {
      setGuardando(false);
    }
  }

  function handleEditar(area) {
    setError(null);
    setEdicion({
      id: area.id,
      name: area.name,
      description: area.description ?? "",
      parentAreaId: area.parentAreaId === null ? "raiz" : String(area.parentAreaId),
      parentOriginal: area.parentAreaId,
    });
  }

  function handleEdicionChange(event) {
    const { name, value } = event.target;
    setEdicion({ ...edicion, [name]: value });
  }

  async function handleGuardar(event) {
    event.preventDefault();
    setError(null);

    const padreNuevo = edicion.parentAreaId === "raiz" ? null : Number(edicion.parentAreaId);

    try {
      await api.updateArea(edicion.id, {
        name: edicion.name.trim(),
        description: edicion.description.trim() || null,
      });

      if (padreNuevo !== edicion.parentOriginal) {
        if (padreNuevo === null) await api.clearAreaParent(edicion.id);
        else await api.setAreaParent(edicion.id, padreNuevo);
      }

      setEdicion(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setRecarga(recarga + 1);
    }
  }

  async function handleBorrar(area) {
    const seguro = window.confirm(
      `¿Eliminar el área ${area.name}? Las áreas que cuelgan de ella pasan a ser raíces.`,
    );
    if (!seguro) return;

    setError(null);

    try {
      await api.deleteArea(area.id);
      setRecarga(recarga + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  function handleDesplegar(area) {
    setError(null);
    setNuevoMiembro({ userId: "", isAreaLeader: false });
    setAbierta(abierta === area.id ? null : area.id);
  }

  function handleNuevoMiembroChange(event) {
    const { name, type, value, checked } = event.target;
    setNuevoMiembro({ ...nuevoMiembro, [name]: type === "checkbox" ? checked : value });
  }

  async function handleAgregarMiembro(event, area) {
    event.preventDefault();
    setError(null);

    try {
      await api.setAreaMember(area.id, Number(nuevoMiembro.userId), nuevoMiembro.isAreaLeader);
      setNuevoMiembro({ userId: "", isAreaLeader: false });
      setRecarga(recarga + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  // Nombra o quita como responsable; la persona sigue en el área.
  async function handleResponsable(area, persona, isAreaLeader) {
    setError(null);

    try {
      await api.setAreaMember(area.id, persona.id, isAreaLeader);
      setRecarga(recarga + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleQuitarMiembro(area, persona) {
    const seguro = window.confirm(
      `¿Quitar a ${persona.fullName} (${persona.email}) del área ${area.name}?`,
    );
    if (!seguro) return;

    setError(null);

    try {
      await api.removeAreaMember(area.id, persona.id);
      setRecarga(recarga + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  // Al editar, el área no puede colgar de sí misma ni de una de sus hijas.
  const enEdicion = edicion ? areas.find((area) => area.id === edicion.id) : null;
  const excluidas = enEdicion ? descendientes(enEdicion) : new Set();

  return (
    <section className="areas-panel">
      <header className="areas-header">
        <h1 className="areas-title">Áreas</h1>

        <p className="areas-count">
          {areas.length} {areas.length === 1 ? "área" : "áreas"}
        </p>
      </header>

      {/* FORMULARIO DE ALTA */}
      <form className="area-form" onSubmit={handleCrear}>
        <h2 className="area-form-title">Registrar un área</h2>

        <div className="area-form-field">
          <label className="area-form-label" htmlFor="area-name">
            Nombre
          </label>

          <input
            className="area-form-input"
            id="area-name"
            name="name"
            type="text"
            required
            maxLength={200}
            value={form.name}
            onChange={handleChange}
          />
        </div>

        <div className="area-form-field">
          <label className="area-form-label" htmlFor="area-description">
            Descripción (opcional)
          </label>

          <textarea
            className="area-form-textarea"
            id="area-description"
            name="description"
            rows={3}
            value={form.description}
            onChange={handleChange}
          />
        </div>

        <div className="area-form-field">
          <label className="area-form-label" htmlFor="area-parent">
            Área superior
          </label>

          <select
            className="area-form-select"
            id="area-parent"
            name="parentAreaId"
            value={form.parentAreaId}
            onChange={handleChange}
          >
            <option value="">Coordinación (predeterminada)</option>
            <option value="raiz">Ninguna: es una raíz del organigrama</option>

            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </div>

        <div className="area-form-field">
          <label className="area-form-label" htmlFor="area-leader">
            Responsable del área (opcional)
          </label>

          <select
            className="area-form-select"
            id="area-leader"
            name="leaderUserId"
            value={form.leaderUserId}
            onChange={handleChange}
          >
            <option value="">Sin responsable por ahora</option>

            {personas.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {persona.fullName} — {persona.email}
              </option>
            ))}
          </select>
          <p className="area-form-hint">
            La persona queda asignada al área como responsable. Después se pueden nombrar
            más desde el panel de integrantes de cada área.
          </p>
        </div>

        <p className="area-form-error" role="alert">
          {errorForm}
        </p>

        <button className="area-form-submit" type="submit" disabled={guardando}>
          {guardando ? "Registrando..." : "Registrar área"}
        </button>
      </form>

      <p className="areas-error" role="alert">
        {error}
      </p>

      {/* TABLA */}
      <table className="areas-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Descripción</th>
            <th>Área superior</th>
            <th>Responsables</th>
            <th>Integrantes</th>
            <th>Acciones</th>
          </tr>
        </thead>

        <tbody>
          {areas.map((area) =>
            edicion && edicion.id === area.id ? (
              // La fila en edición: los mismos campos que el formulario de alta, menos el
              // responsable, que se administra desde el panel de integrantes.
              <tr className="areas-row editing" key={area.id}>
                <td className="areas-cell-name">
                  <input
                    className="areas-edit-input"
                    name="name"
                    type="text"
                    required
                    maxLength={200}
                    form={`area-edit-${area.id}`}
                    value={edicion.name}
                    onChange={handleEdicionChange}
                  />
                </td>

                <td className="areas-cell-description">
                  <input
                    className="areas-edit-input"
                    name="description"
                    type="text"
                    form={`area-edit-${area.id}`}
                    value={edicion.description}
                    onChange={handleEdicionChange}
                  />
                </td>

                <td className="areas-cell-parent">
                  <select
                    className="areas-edit-select"
                    name="parentAreaId"
                    form={`area-edit-${area.id}`}
                    value={edicion.parentAreaId}
                    onChange={handleEdicionChange}
                  >
                    <option value="raiz">Ninguna (raíz)</option>

                    {areas
                      .filter((opcion) => !excluidas.has(opcion.id))
                      .map((opcion) => (
                        <option key={opcion.id} value={opcion.id}>
                          {opcion.name}
                        </option>
                      ))}
                  </select>
                </td>

                <td className="areas-cell-leaders">
                  {area.leaders.map((persona) => persona.fullName).join(", ") || "—"}
                </td>

                <td className="areas-cell-members">{area.memberCount}</td>

                <td className="areas-cell-actions">
                  {/* El <form> vive aquí y los inputs de las otras celdas lo referencian con
                      `form=`: un <form> no puede envolver varios <td>. */}
                  <form id={`area-edit-${area.id}`} onSubmit={handleGuardar}>
                    <button className="areas-action" type="submit">
                      Guardar
                    </button>

                    <button
                      className="areas-action"
                      type="button"
                      onClick={() => setEdicion(null)}
                    >
                      Cancelar
                    </button>
                  </form>
                </td>
              </tr>
            ) : (
              // Un Fragment porque el panel de integrantes es una segunda <tr> de la misma
              // área, y un <tbody> solo admite filas como hijas.
              <Fragment key={area.id}>
                <tr
                  className={`areas-row ${abierta === area.id ? "open" : ""}`}
                  data-depth={area.depth}
                >
                  <td className="areas-cell-name">{area.name}</td>

                  <td className="areas-cell-description">{area.description ?? "—"}</td>

                  <td className="areas-cell-parent">{area.parentName ?? "—"}</td>

                  <td className="areas-cell-leaders">
                    {area.leaders.map((persona) => persona.fullName).join(", ") || "—"}
                  </td>

                  <td className="areas-cell-members">
                    <button
                      className="areas-members-toggle"
                      type="button"
                      aria-expanded={abierta === area.id}
                      onClick={() => handleDesplegar(area)}
                    >
                      {area.memberCount} {abierta === area.id ? "▴" : "▾"}
                    </button>
                  </td>

                  <td className="areas-cell-actions">
                    <button
                      className="areas-action"
                      type="button"
                      disabled={edicion !== null}
                      onClick={() => handleEditar(area)}
                    >
                      Editar
                    </button>

                    {/* El servidor rechaza borrar un área con gente; se deshabilita aquí para
                        no prometer algo que va a fallar. Primero hay que quitarlos desde el
                        panel de integrantes. */}
                    <button
                      className="areas-action areas-action-danger"
                      type="button"
                      disabled={edicion !== null || area.memberCount > 0}
                      title={
                        area.memberCount > 0
                          ? "Quita a sus integrantes antes de eliminarla."
                          : undefined
                      }
                      onClick={() => handleBorrar(area)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>

                {/* PANEL DE INTEGRANTES */}
                {abierta === area.id && (
                  <tr className="areas-members-row">
                    <td className="areas-members-panel" colSpan={6}>
                      <h3 className="areas-members-title">Integrantes de {area.name}</h3>

                      {area.members.length === 0 && (
                        <p className="areas-members-empty">
                          Nadie está asignado a esta área.
                        </p>
                      )}

                      <ul className="areas-members-list">
                        {area.members.map((persona) => (
                          <li
                            className={`areas-member ${persona.isAreaLeader ? "leader" : ""}`}
                            key={persona.id}
                          >
                            <span className="areas-member-name">{persona.fullName}</span>

                            <span className="areas-member-email">{persona.email}</span>

                            <span className="areas-member-role">
                              {ROLES_EN_ESPANOL[persona.role] ?? persona.role}
                            </span>

                            {persona.isAreaLeader && (
                              <span className="areas-member-badge">Responsable</span>
                            )}

                            <span className="areas-member-actions">
                              <button
                                className="areas-action"
                                type="button"
                                onClick={() =>
                                  handleResponsable(area, persona, !persona.isAreaLeader)
                                }
                              >
                                {persona.isAreaLeader
                                  ? "Quitar como responsable"
                                  : "Hacer responsable"}
                              </button>

                              <button
                                className="areas-action areas-action-danger"
                                type="button"
                                onClick={() => handleQuitarMiembro(area, persona)}
                              >
                                Quitar del área
                              </button>
                            </span>
                          </li>
                        ))}
                      </ul>

                      {/* AGREGAR INTEGRANTE */}
                      <form
                        className="areas-member-form"
                        onSubmit={(event) => handleAgregarMiembro(event, area)}
                      >
                        <label className="areas-member-form-label" htmlFor="area-member-user">
                          Agregar a
                        </label>

                        <select
                          className="areas-member-form-select"
                          id="area-member-user"
                          name="userId"
                          required
                          value={nuevoMiembro.userId}
                          onChange={handleNuevoMiembroChange}
                        >
                          <option value="">Elige a una persona</option>

                          {/* Quienes ya están en el área no se ofrecen: para cambiarles el
                              cargo están los botones de arriba. */}
                          {personas
                            .filter(
                              (persona) =>
                                !area.members.some((miembro) => miembro.id === persona.id),
                            )
                            .map((persona) => (
                              <option key={persona.id} value={persona.id}>
                                {persona.fullName} — {persona.email}
                              </option>
                            ))}
                        </select>

                        <input
                          className="areas-member-form-check"
                          id="area-member-leader"
                          name="isAreaLeader"
                          type="checkbox"
                          checked={nuevoMiembro.isAreaLeader}
                          onChange={handleNuevoMiembroChange}
                        />

                        <label className="areas-member-form-label" htmlFor="area-member-leader">
                          Como responsable
                        </label>

                        <button className="areas-member-form-submit" type="submit">
                          Agregar
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

      {cargando && <p className="areas-loading">Cargando...</p>}

      {!cargando && areas.length === 0 && (
        <p className="areas-empty">Todavía no hay áreas registradas.</p>
      )}
    </section>
  );
}

export default Areas;
