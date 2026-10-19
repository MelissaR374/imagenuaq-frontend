// Roles and permissions (RF-USR-05). The role says what a person can do; their areas say over
// which records, and the two are independent -- which is why reading and writing are separate
// permissions and are drawn as separate rows.
//
// Every grant is in one grid: permissions by module down the side, roles across the top. A role is
// then read as a column and a permission as a row, instead of opening one role at a time and
// comparing from memory.
//
// Nothing is written while it is being decided: the grid holds a draft, what changed is marked in
// amber, and "Guardar cambios" commits it -- one call per role whose grants moved.
import { Fragment, useEffect, useState } from "react";

import * as api from "../../api/client.js";
import Help from "../shared/help.jsx";
import { tabsFor } from "../sidebar/menu.js";
import "./roles.css";

const ROLE_NAME_MAX = 50;
const USERS_MAX = 200;

/** The four seeded roles read in Spanish; any role added later reads by its own name. */
const ROLE_NAMES = {
  admin: "Coordinación",
  area_lead: "Responsable de área",
  worker: "Integrante",
  finance: "Finanzas",
};

/** The module a permission belongs to, taken from its code: `project.read` is of Proyectos. */
const GROUP_NAMES = {
  request: "Solicitudes",
  project: "Proyectos",
  workflow: "Flujos",
  status: "Estatus",
  task: "Tareas",
  schema: "Formatos",
  spreadsheet: "Excel",
  area: "Áreas y usuarios",
  finance: "Finanzas",
  absence: "Ausencias",
  availability: "Disponibilidad",
};

const labelOf = (role) => ROLE_NAMES[role.name] ?? role.name;
const groupOf = (permission) => permission.code.split(".")[0];
const actionOf = (permission) => permission.code.split(".").pop();

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Coordinación holds every permission: it is the role the others are configured from, and if it
 * lost one nobody could give it back. Its column is read-only, which is what the lock says.
 */
function isLocked(role) {
  return role.name === "admin";
}

function PermissionCell({ role, permission, draft, saved, onToggle }) {
  const on = draft.includes(permission.code);
  const was = saved.includes(permission.code);
  const locked = isLocked(role);
  const blind =
    actionOf(permission) === "write" &&
    on &&
    !draft.includes(`${groupOf(permission)}.read`);

  return (
    <td
      className={`roles-cell ${on !== was ? "is-changed" : ""} ${blind ? "is-blind" : ""} ${
        locked ? "is-locked" : ""
      }`}
      title={
        locked
          ? "Coordinación tiene todos los permisos: es el rol desde el que se configuran los demás."
          : blind
            ? "Puede editar, pero no ver la lista: le falta el permiso de ver."
            : undefined
      }
    >
      <input
        type="checkbox"
        aria-label={`${labelOf(role)}: ${permission.label}`}
        checked={on}
        disabled={locked}
        onChange={() => onToggle(permission.code)}
      />
    </td>
  );
}

function Roles() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [people, setPeople] = useState([]);
  const [saved, setSaved] = useState({});
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState(null);

  const [draft, setDraft] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [mode, setMode] = useState(null);
  const [creating, setCreating] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .listUsers({ limit: USERS_MAX })
      .then((page) => setPeople(page.users))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    let cancelled = false;

    Promise.all([api.listRoles(), api.listPermissions()])
      .then(async ([roleData, permissionData]) => {
        const lists = await Promise.all(
          roleData.roles.map((role) => api.getRolePermissions(role.id)),
        );
        if (cancelled) return;

        const byRole = {};
        roleData.roles.forEach((role, index) => {
          byRole[role.id] = lists[index].permissions.map((one) => one.code);
        });

        setRoles(roleData.roles);
        setPermissions(permissionData.permissions);
        setSaved(byRole);
        setDraft({
          roles: roleData.roles.map((role) => ({ ...role })),
          grants: { ...byRole },
        });
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reload]);

  function holdersOf(role) {
    return people.filter((person) => person.role === role.name);
  }

  function toggle(role, code) {
    const list = draft.grants[role.id] ?? [];
    setDraft({
      ...draft,
      grants: {
        ...draft.grants,
        [role.id]: list.includes(code)
          ? list.filter((one) => one !== code)
          : [...list, code],
      },
    });
  }

  /** What is still unsaved: the count the footer shows and the people it will affect. */
  function countChanges() {
    if (draft === null) return { changes: 0, affected: 0 };
    let changes = 0;
    const touched = [];

    for (const role of draft.roles) {
      const original = roles.find((one) => one.id === role.id);
      if (!original) {
        changes += 1;
        continue;
      }
      if (original.name !== role.name) changes += 1;
      if ((original.description ?? "") !== (role.description ?? "")) changes += 1;

      const before = saved[role.id] ?? [];
      const now = draft.grants[role.id] ?? [];
      const moved = permissions.filter(
        (one) => before.includes(one.code) !== now.includes(one.code),
      ).length;
      if (moved > 0) {
        changes += moved;
        touched.push(original);
      }
    }

    for (const role of roles) {
      if (!draft.roles.some((one) => one.id === role.id)) changes += 1;
    }

    const affected = touched.reduce((sum, role) => sum + holdersOf(role).length, 0);
    return { changes, affected };
  }

  /**
   * Commits the draft, role by role: what was renamed, what was deleted, and the grants of every
   * role whose column moved. A new role is created first, so its grants have an id to go to.
   */
  async function handleSave() {
    setError(null);
    setSaving(true);

    try {
      for (const role of roles) {
        if (!draft.roles.some((one) => one.id === role.id)) {
          await api.deleteRole(role.id);
        }
      }

      for (const role of draft.roles) {
        const original = roles.find((one) => one.id === role.id);

        if (!original) {
          const made = await api.createRole({
            name: role.name.trim(),
            description: role.description?.trim() || null,
          });
          await api.setRolePermissions(made.role.id, draft.grants[role.id] ?? []);
          continue;
        }

        if (
          original.name !== role.name.trim() ||
          (original.description ?? "") !== (role.description ?? "").trim()
        ) {
          await api.updateRole(role.id, {
            name: role.name.trim(),
            description: role.description?.trim() || null,
          });
        }

        const before = saved[role.id] ?? [];
        const now = draft.grants[role.id] ?? [];
        const moved = permissions.some(
          (one) => before.includes(one.code) !== now.includes(one.code),
        );
        if (moved) await api.setRolePermissions(role.id, now);
      }

      setOpenId(null);
      setMode(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setReload(reload + 1);
    }
  }

  function addRole() {
    const name = creating.name.trim();
    if (name === "") return;

    const id = `new:${Date.now()}`;
    setDraft({
      ...draft,
      roles: [...draft.roles, { id, name, description: creating.description.trim() || null }],
      grants: { ...draft.grants, [id]: [...(draft.grants[creating.from] ?? [])] },
    });
    setCreating(null);
    setOpenId(id);
  }

  if (draft === null) {
    return (
      <section className="roles">
        {error !== null ? (
          <p className="roles-error" role="alert">
            {error}
          </p>
        ) : (
          <p className="roles-empty">{loading ? "Cargando…" : "No se pudieron leer los roles."}</p>
        )}
      </section>
    );
  }

  const { changes, affected } = countChanges();
  const open = draft.roles.find((role) => role.id === openId) ?? null;
  const groups = [...new Set(permissions.map(groupOf))];
  const withoutGrants = draft.roles.filter(
    (role) => (draft.grants[role.id] ?? []).length === 0 && holdersOf(role).length > 0,
  );

  return (
    <section className="roles">
      {error !== null && (
        <p className="roles-error" role="alert">
          {error}
        </p>
      )}

      <p className="roles-rule">
        El rol dice qué puede hacer una persona; sus áreas dicen sobre qué registros. Un permiso
        cambia en cuanto se guarda, sin volver a iniciar sesión.
      </p>

      {withoutGrants.length > 0 && (
        <p className="roles-rule is-warning">
          {withoutGrants.map(labelOf).join(" y ")} no{" "}
          {withoutGrants.length === 1 ? "tiene" : "tienen"} ningún permiso:{" "}
          {plural(
            withoutGrants.reduce((sum, role) => sum + holdersOf(role).length, 0),
            "persona no puede",
            "personas no pueden",
          )}{" "}
          abrir nada fuera de su perfil.
        </p>
      )}

      {creating !== null && (
        <section className="roles-panel">
          <div className="roles-panel-head">
            <span className="roles-eyebrow">ROL NUEVO</span>
            <button
              className="roles-close"
              type="button"
              aria-label="Cancelar"
              onClick={() => setCreating(null)}
            >
              ✕
            </button>
          </div>

          <div className="roles-fields">
            <label className="roles-field">
              <span className="roles-label">
                Nombre
                <Help text="Como se guarda y como se lee en Empleados y en esta tabla." />
              </span>
              <input
                type="text"
                maxLength={ROLE_NAME_MAX}
                placeholder="Ej: practicante"
                value={creating.name}
                onChange={(event) => setCreating({ ...creating, name: event.target.value })}
              />
            </label>

            <label className="roles-field is-wide">
              <span className="roles-label">Descripción</span>
              <input
                type="text"
                placeholder="Ej: Apoya en las etapas de su área, sin dar visto bueno."
                value={creating.description}
                onChange={(event) => setCreating({ ...creating, description: event.target.value })}
              />
            </label>

            <label className="roles-field">
              <span className="roles-label">
                Permisos
                <Help text="Después se ajustan en la tabla, columna por columna." />
              </span>
              <select
                value={creating.from}
                onChange={(event) => setCreating({ ...creating, from: event.target.value })}
              >
                <option value="">Empezar sin permisos</option>
                {draft.roles
                  .filter((role) => !isLocked(role))
                  .map((role) => (
                    <option key={role.id} value={role.id}>
                      Copiar los de {labelOf(role)}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <footer className="roles-panel-foot">
            <span />
            <span className="roles-right">
              <button className="roles-btn" type="button" onClick={() => setCreating(null)}>
                Cancelar
              </button>
              <button
                className="roles-btn"
                type="button"
                disabled={creating.name.trim() === ""}
                onClick={addRole}
              >
                Agregar a la tabla
              </button>
            </span>
          </footer>
        </section>
      )}

      {open !== null && (
        <section className="roles-panel">
          <div className="roles-panel-head">
            <span className="roles-eyebrow">
              ROL · {plural(holdersOf(open).length, "PERSONA", "PERSONAS")}
            </span>
            <button
              className="roles-close"
              type="button"
              aria-label="Cerrar"
              onClick={() => {
                setOpenId(null);
                setMode(null);
              }}
            >
              ✕
            </button>
          </div>

          {isLocked(open) ? (
            <>
              <h3 className="roles-panel-title">{labelOf(open)}</h3>
              <p className="roles-note">
                {open.description ?? "El rol que administra el sistema."} No se renombra ni se
                elimina, y conserva todos los permisos: es el rol desde el que se configuran los
                demás, y sin él nadie podría devolverlos.
              </p>
            </>
          ) : (
            <div className="roles-fields">
              <label className="roles-field">
                <span className="roles-label">
                  Nombre
                  <Help text="Al renombrarlo, quienes lo tienen deben volver a iniciar sesión: su sesión guarda el nombre anterior." />
                </span>
                <input
                  type="text"
                  maxLength={ROLE_NAME_MAX}
                  value={open.name}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      roles: draft.roles.map((role) =>
                        role.id === open.id ? { ...role, name: event.target.value } : role,
                      ),
                    })
                  }
                />
              </label>

              <label className="roles-field is-wide">
                <span className="roles-label">Descripción</span>
                <input
                  type="text"
                  value={open.description ?? ""}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      roles: draft.roles.map((role) =>
                        role.id === open.id ? { ...role, description: event.target.value } : role,
                      ),
                    })
                  }
                />
              </label>
            </div>
          )}

          <div className="roles-holders">
            <span className="roles-eyebrow">Lo tienen</span>
            {holdersOf(open).length > 0 ? (
              holdersOf(open).map((person) => (
                <span className="roles-chip" key={person.id}>
                  {person.fullName}
                </span>
              ))
            ) : (
              <span className="roles-muted">Nadie todavía.</span>
            )}
            <span className="roles-muted">El rol de cada persona se cambia en Empleados.</span>
          </div>

          <footer className="roles-panel-foot">
            {isLocked(open) ? (
              <span />
            ) : mode === "delete" ? (
              <p className="roles-confirm">
                ¿Eliminar el rol {labelOf(open)}? Sus permisos se van con él.
              </p>
            ) : (
              <span className="roles-del">
                <button
                  className="roles-quiet is-danger"
                  type="button"
                  disabled={holdersOf(open).length > 0}
                  onClick={() => setMode("delete")}
                >
                  Eliminar rol
                </button>
                {holdersOf(open).length > 0 && (
                  <span className="roles-muted">
                    Lo{" "}
                    {holdersOf(open).length === 1
                      ? "tiene 1 persona"
                      : `tienen ${holdersOf(open).length} personas`}
                    : cámbiales el rol en Empleados antes de eliminarlo.
                  </span>
                )}
              </span>
            )}

            <span className="roles-right">
              {mode === "delete" ? (
                <>
                  <button className="roles-btn" type="button" onClick={() => setMode(null)}>
                    Cancelar
                  </button>
                  <button
                    className="roles-btn is-danger"
                    type="button"
                    onClick={() => {
                      const grants = { ...draft.grants };
                      delete grants[open.id];
                      setDraft({
                        ...draft,
                        roles: draft.roles.filter((role) => role.id !== open.id),
                        grants,
                      });
                      setOpenId(null);
                      setMode(null);
                    }}
                  >
                    Eliminar rol
                  </button>
                </>
              ) : (
                <button
                  className="roles-btn"
                  type="button"
                  onClick={() => {
                    setOpenId(null);
                    setMode(null);
                  }}
                >
                  Listo
                </button>
              )}
            </span>
          </footer>
        </section>
      )}

      <div className="roles-wrap" role="region" aria-label="Permisos por rol" tabIndex={0}>
        <table className="roles-grid">
          <thead>
            <tr>
              <th className="roles-perm-head">Permiso</th>

              {draft.roles.map((role) => (
                <th
                  className={`roles-role-head ${openId === role.id ? "is-open" : ""}`}
                  key={role.id}
                >
                  <button
                    type="button"
                    aria-expanded={openId === role.id}
                    onClick={() => {
                      setOpenId(openId === role.id ? null : role.id);
                      setMode(null);
                      setCreating(null);
                    }}
                  >
                    <strong>{labelOf(role)}</strong>
                    <span>
                      {roles.some((one) => one.id === role.id)
                        ? plural(holdersOf(role).length, "persona", "personas")
                        : "Nuevo"}
                    </span>
                  </button>
                </th>
              ))}

              <th className="roles-add-head">
                <button
                  type="button"
                  disabled={creating !== null}
                  onClick={() => {
                    setOpenId(null);
                    setCreating({ name: "", description: "", from: "" });
                  }}
                >
                  + Rol nuevo
                </button>
              </th>
            </tr>
          </thead>

          <tbody>
            {groups.map((group) => (
              <Fragment key={group}>
                <tr className="roles-group">
                  <th colSpan={draft.roles.length + 2}>{GROUP_NAMES[group] ?? group}</th>
                </tr>

                {permissions
                  .filter((permission) => groupOf(permission) === group)
                  .map((permission) => (
                    <tr key={permission.id}>
                      <th className="roles-perm">
                        <span className="roles-perm-name">
                          {permission.label}
                          {permission.description !== null && (
                            <Help text={permission.description} />
                          )}
                        </span>
                        {tabsFor(permission.code).length > 0 && (
                          <span className="roles-perm-tabs">
                            Da acceso a{" "}
                            {tabsFor(permission.code)
                              .map((tab) => `«${tab}»`)
                              .join(" y ")}
                          </span>
                        )}
                      </th>

                      {draft.roles.map((role) => (
                        <PermissionCell
                          key={role.id}
                          role={role}
                          permission={permission}
                          draft={draft.grants[role.id] ?? []}
                          saved={saved[role.id] ?? []}
                          onToggle={(code) => toggle(role, code)}
                        />
                      ))}

                      <td className="roles-add-cell" />
                    </tr>
                  ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="roles-foot">
        <span className="roles-impact">
          {changes === 0
            ? "Sin cambios."
            : affected > 0
              ? `Al guardar cambia lo que pueden hacer ${plural(
                  affected,
                  "persona",
                  "personas",
                )}, desde su siguiente acción.`
              : "Al guardar, el catálogo de roles queda así."}
        </span>

        <span className="roles-right">
          <span className="roles-dirty">
            {changes > 0 && `${changes} ${changes === 1 ? "cambio" : "cambios"} sin guardar`}
          </span>
          {changes > 0 && (
            <button
              className="roles-btn"
              type="button"
              onClick={() => {
                setDraft({ roles: roles.map((role) => ({ ...role })), grants: { ...saved } });
                setOpenId(null);
                setMode(null);
              }}
            >
              Descartar
            </button>
          )}
          <button
            className="roles-btn is-primary"
            type="button"
            disabled={changes === 0 || saving}
            onClick={handleSave}
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </span>
      </footer>
    </section>
  );
}

export default Roles;
