// Areas and the people in them (RF-USR-09). An area is a place in the organigram, so the list is
// drawn as the organigram: depth is indentation, and a child is read under its parent.
//
// Who answers for an area is the fact the screen is built around -- an area without anybody
// responsible is the thing that silently stops work -- so it has its own column and is counted in
// the line above the table.
//
// An area opens in place, with its data beside its people, and everything is saved together: the
// changes are marked while they are drafted and committed in one "Guardar cambios", instead of
// each toggle writing to the server on its own.
import { Fragment, useEffect, useState } from "react";

import * as api from "../../api/client.js";
import Help from "../shared/help.jsx";
import { initials } from "../shared/format.js";
import "./areas.css";

const USERS_MAX = 200;

/** The server names the roles in English; the same names users.jsx shows. */
const ROLE_NAMES = {
  admin: "Coordinación",
  area_lead: "Responsable de área",
  worker: "Integrante",
  finance: "Finanzas",
};

const EMPTY_NEW = { name: "", parentAreaId: "", leaderUserId: "", description: "" };

/** "1 área" / "3 áreas": the count and its word, so a sentence reads. */
function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * The org chart as one list in reading order -- roots first, each child under its parent -- with
 * the depth that draws the indentation and the path that names it when the search flattens it.
 */
function flatten(nodes, parents = [], out = []) {
  for (const node of nodes) {
    out.push({ ...node, depth: parents.length, path: [...parents, node.name] });
    flatten(node.children, [...parents, node.name], out);
  }
  return out;
}

/**
 * The area and everything hanging from it: an area cannot depend on itself or on one of its own
 * descendants, so these are left out of the "Depende de" list.
 */
function descendants(area) {
  const ids = new Set([area.id]);
  for (const child of area.children) {
    for (const id of descendants(child)) ids.add(id);
  }
  return ids;
}

/** The draft an open area starts from: what the server has, before anybody touches it. */
function draftOf(area) {
  return {
    name: area.name,
    description: area.description ?? "",
    parentAreaId: area.parentAreaId === null ? "" : String(area.parentAreaId),
    members: area.members.map((person) => ({
      id: person.id,
      fullName: person.fullName,
      email: person.email,
      role: person.role,
      lead: person.isAreaLeader,
    })),
  };
}

/** How many things the draft changes, which is what the footer says and the save button needs. */
function countChanges(area, draft) {
  let n = 0;
  if (draft.name.trim() !== area.name) n += 1;
  if (draft.description.trim() !== (area.description ?? "")) n += 1;
  if (draft.parentAreaId !== (area.parentAreaId === null ? "" : String(area.parentAreaId))) n += 1;
  for (const person of area.members) {
    const drafted = draft.members.find((member) => member.id === person.id);
    if (!drafted || drafted.lead !== person.isAreaLeader) n += 1;
  }
  for (const member of draft.members) {
    if (!area.members.some((person) => person.id === member.id)) n += 1;
  }
  return n;
}

function Avatar({ person, lead }) {
  return (
    <span className={`areas-av ${lead ? "is-lead" : ""}`} title={person.fullName}>
      {initials(person.fullName)}
    </span>
  );
}

function MemberRow({ area, member, removing, onLead, onAskRemove, onRemove, onCancelRemove }) {
  const original = area.members.find((person) => person.id === member.id);
  const changed = !original || original.isAreaLeader !== member.lead;
  const mismatch = member.lead && member.role === "worker";

  return (
    <li className={`areas-member ${changed ? "is-changed" : ""}`}>
      <Avatar person={member} lead={member.lead} />

      <span className="areas-who">
        <strong>{member.fullName}</strong>
        <span className="areas-muted">
          {member.email} · rol {ROLE_NAMES[member.role] ?? member.role}
        </span>
      </span>

      {removing ? (
        <span className="areas-inline-confirm">
          ¿Quitarla del área? Deja de ver su trabajo.
          <button className="areas-btn" type="button" onClick={onCancelRemove}>
            Cancelar
          </button>
          <button className="areas-btn is-danger" type="button" onClick={onRemove}>
            Quitar
          </button>
        </span>
      ) : (
        <>
          <span className="areas-lead" role="radiogroup" aria-label={`Papel de ${member.fullName}`}>
            <button
              type="button"
              role="radio"
              aria-checked={!member.lead}
              onClick={() => onLead(false)}
            >
              Integrante
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={member.lead}
              onClick={() => onLead(true)}
            >
              Responsable
            </button>
          </span>

          <button
            className="areas-rm"
            type="button"
            title="Quitar del área"
            aria-label={`Quitar a ${member.fullName} del área`}
            onClick={onAskRemove}
          >
            ✕
          </button>
        </>
      )}

      {mismatch && (
        <span className="areas-warn">
          Responsable aquí, pero su rol es Integrante: no tiene los permisos de un responsable. El
          rol se cambia en Empleados.
        </span>
      )}
    </li>
  );
}

function Areas() {
  const [areas, setAreas] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [mode, setMode] = useState(null);
  const [adding, setAdding] = useState("");
  const [saving, setSaving] = useState(false);

  const [creating, setCreating] = useState(null);
  const [createError, setCreateError] = useState(null);

  useEffect(() => {
    api
      .listUsers({ limit: USERS_MAX })
      .then((page) => setPeople(page.users))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    let cancelled = false;

    api
      .getOrgChart()
      .then((data) => {
        if (cancelled) return;
        setAreas(flatten(data.roots));
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

  function openArea(area) {
    if (openId === area.id) {
      closeArea();
      return;
    }
    setCreating(null);
    setMode(null);
    setAdding("");
    setOpenId(area.id);
    setDraft(draftOf(area));
  }

  function closeArea() {
    setOpenId(null);
    setDraft(null);
    setMode(null);
    setAdding("");
  }

  function startCreating() {
    closeArea();
    setCreateError(null);
    setCreating(EMPTY_NEW);
  }

  async function handleCreate(event) {
    event.preventDefault();
    setCreateError(null);
    setSaving(true);

    const input = {
      name: creating.name.trim(),
      description: creating.description.trim() || null,
      leaderUserId: creating.leaderUserId ? Number(creating.leaderUserId) : null,
    };
    if (creating.parentAreaId === "") input.parentAreaId = null;
    else input.parentAreaId = Number(creating.parentAreaId);

    try {
      await api.createArea(input);
      setCreating(null);
      setNotice(`Se registró el área ${input.name}.`);
      setReload(reload + 1);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setSaving(false);
    }
  }

  /**
   * Commits the draft: the area's own data first, then its parent, then one call per person whose
   * membership changed. Reloading afterwards is what makes the counts and the tree agree again.
   */
  async function handleSave(area) {
    setError(null);
    setSaving(true);

    const parent = draft.parentAreaId === "" ? null : Number(draft.parentAreaId);

    try {
      if (
        draft.name.trim() !== area.name ||
        draft.description.trim() !== (area.description ?? "")
      ) {
        await api.updateArea(area.id, {
          name: draft.name.trim(),
          description: draft.description.trim() || null,
        });
      }

      if (parent !== area.parentAreaId) {
        if (parent === null) await api.clearAreaParent(area.id);
        else await api.setAreaParent(area.id, parent);
      }

      for (const member of draft.members) {
        const original = area.members.find((person) => person.id === member.id);
        if (!original || original.isAreaLeader !== member.lead) {
          await api.setAreaMember(area.id, member.id, member.lead);
        }
      }

      for (const person of area.members) {
        if (!draft.members.some((member) => member.id === person.id)) {
          await api.removeAreaMember(area.id, person.id);
        }
      }

      closeArea();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setReload(reload + 1);
    }
  }

  async function handleDelete(area) {
    setError(null);
    setSaving(true);

    try {
      await api.deleteArea(area.id);
      setNotice(`Se eliminó el área ${area.name}.`);
      closeArea();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setReload(reload + 1);
    }
  }

  const term = query.trim().toLowerCase();
  const matches = (area) =>
    term === "" ||
    area.name.toLowerCase().includes(term) ||
    area.members.some((person) => person.fullName.toLowerCase().includes(term));
  const rows = areas.filter(matches);

  const open = areas.find((area) => area.id === openId) ?? null;
  const changes = open && draft ? countChanges(open, draft) : 0;
  const withoutLead = areas.filter((area) => area.leaders.length === 0).length;
  const unplaced = people.filter(
    (person) => !areas.some((area) => area.members.some((member) => member.id === person.id)),
  );

  function parentOptions(excluded) {
    return areas
      .filter((area) => !excluded.has(area.id))
      .map((area) => (
        <option key={area.id} value={area.id}>
          {" ".repeat(area.depth * 3)}
          {area.name}
        </option>
      ));
  }

  return (
    <section className="areas">
      {notice !== null && (
        <p className="areas-notice" role="status">
          {notice}
          <button className="areas-quiet" type="button" onClick={() => setNotice(null)}>
            Cerrar
          </button>
        </p>
      )}

      {error !== null && (
        <p className="areas-error" role="alert">
          {error}
        </p>
      )}

      <div className="areas-bar">
        <span className="areas-count">
          {plural(areas.length, "área", "áreas")} · {plural(people.length, "persona", "personas")}
          {withoutLead > 0 && (
            <>
              {" · "}
              <b className="areas-flag">
                {plural(withoutLead, "área sin responsable", "áreas sin responsable")}
              </b>
            </>
          )}
        </span>

        <button
          className="areas-btn is-primary"
          type="button"
          disabled={creating !== null}
          onClick={startCreating}
        >
          Nueva área
        </button>
      </div>

      <p className="areas-rule">
        Cada área depende de otra. Quien es responsable de un área ve el trabajo de ella y de las
        que dependen de ella.
      </p>

      <div className="areas-filters">
        <label className="areas-search">
          <input
            type="search"
            placeholder="Área o persona"
            aria-label="Buscar un área o una persona"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      <div className="areas-table-wrap">
        <table className="areas-table">
          <thead>
            <tr>
              <th>Área</th>
              <th>Responsable</th>
              <th>Integrantes</th>
            </tr>
          </thead>

          <tbody>
            {creating !== null && (
              <tr className="areas-expanded">
                <td colSpan={3}>
                  <form className="areas-open" onSubmit={handleCreate}>
                    <div className="areas-open-head">
                      <span className="areas-eyebrow">NUEVA ÁREA</span>
                      <button
                        className="areas-close"
                        type="button"
                        aria-label="Cancelar"
                        onClick={() => setCreating(null)}
                      >
                        ✕
                      </button>
                    </div>

                    <div className="areas-fields">
                      <label className="areas-field">
                        <span className="areas-label">Nombre</span>
                        <input
                          type="text"
                          required
                          maxLength={200}
                          placeholder="Ej: Fotografía"
                          value={creating.name}
                          onChange={(event) =>
                            setCreating({ ...creating, name: event.target.value })
                          }
                        />
                      </label>

                      <label className="areas-field">
                        <span className="areas-label">
                          Depende de
                          <Help text="«Ninguna» la deja fuera del organigrama: nadie arriba ve su trabajo." />
                        </span>
                        <select
                          value={creating.parentAreaId}
                          onChange={(event) =>
                            setCreating({ ...creating, parentAreaId: event.target.value })
                          }
                        >
                          <option value="">Ninguna: queda fuera del organigrama</option>
                          {parentOptions(new Set())}
                        </select>
                      </label>

                      <label className="areas-field">
                        <span className="areas-label">
                          Responsable
                          <Help text="Queda como integrante y responsable. Después se agregan más personas desde el área." />
                        </span>
                        <select
                          value={creating.leaderUserId}
                          onChange={(event) =>
                            setCreating({ ...creating, leaderUserId: event.target.value })
                          }
                        >
                          <option value="">Sin responsable por ahora</option>
                          {people.map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.fullName} · {ROLE_NAMES[person.role] ?? person.role}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="areas-field is-wide">
                        <span className="areas-label">
                          Descripción
                          <Help text="Qué hace el área, en una o dos líneas. Se lee al asignarle trabajo." />
                        </span>
                        <textarea
                          rows={2}
                          placeholder="Ej: Sesiones de fotografía de producto y de eventos."
                          value={creating.description}
                          onChange={(event) =>
                            setCreating({ ...creating, description: event.target.value })
                          }
                        />
                      </label>
                    </div>

                    {createError !== null && <p className="areas-bad">{createError}</p>}

                    <footer className="areas-open-foot">
                      <span />
                      <span className="areas-right">
                        <button
                          className="areas-btn"
                          type="button"
                          onClick={() => setCreating(null)}
                        >
                          Cancelar
                        </button>
                        <button className="areas-btn is-primary" type="submit" disabled={saving}>
                          {saving ? "Creando…" : "Crear área"}
                        </button>
                      </span>
                    </footer>
                  </form>
                </td>
              </tr>
            )}

            {rows.map((area) => (
              <Fragment key={area.id}>
                <tr
                  className={`areas-row ${area.leaders.length === 0 ? "is-pending" : ""} ${
                    openId === area.id ? "is-open" : ""
                  }`}
                  tabIndex={0}
                  aria-expanded={openId === area.id}
                  onClick={() => openArea(area)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") openArea(area);
                  }}
                >
                  <td className="areas-cell-main">
                    <div
                      className={`areas-node ${area.depth > 0 && term === "" ? "is-nested" : ""}`}
                      style={{ "--depth": term === "" ? area.depth : 0 }}
                    >
                      {term !== "" && area.depth > 0 && (
                        <span className="areas-path">
                          {area.path.slice(0, -1).join(" › ").toUpperCase()}
                        </span>
                      )}
                      <span className="areas-row-name">{area.name}</span>
                      {area.description !== null && (
                        <span className="areas-desc">{area.description}</span>
                      )}
                      {area.children.length > 0 && (
                        <span className="areas-kids">
                          {plural(area.children.length, "subárea", "subáreas")}
                        </span>
                      )}
                    </div>
                  </td>

                  <td>
                    {area.leaders.length > 0 ? (
                      area.leaders.map((person) => person.fullName).join(", ")
                    ) : (
                      <span className="areas-flag">Sin responsable</span>
                    )}
                  </td>

                  <td>
                    <span className="areas-stack">
                      {area.members.slice(0, 4).map((person) => (
                        <Avatar key={person.id} person={person} lead={person.isAreaLeader} />
                      ))}
                    </span>
                    <span className="areas-member-count">
                      {area.members.length === 0 ? "Nadie" : area.members.length}
                    </span>
                  </td>
                </tr>

                {openId === area.id && draft !== null && (
                  <tr className="areas-expanded">
                    <td colSpan={3}>
                      <div className="areas-open">
                        <div className="areas-open-head">
                          <span className="areas-eyebrow">
                            {area.path.join(" › ").toUpperCase()} ·{" "}
                            {plural(area.members.length, "INTEGRANTE", "INTEGRANTES")}
                          </span>
                          <button
                            className="areas-close"
                            type="button"
                            aria-label="Contraer"
                            onClick={closeArea}
                          >
                            ✕
                          </button>
                        </div>

                        <div className="areas-grid">
                          <section className="areas-sec">
                            <h3>Área</h3>

                            <div className="areas-fields is-one">
                              <label className="areas-field is-wide">
                                <span className="areas-label">Nombre</span>
                                <input
                                  type="text"
                                  maxLength={200}
                                  value={draft.name}
                                  onChange={(event) =>
                                    setDraft({ ...draft, name: event.target.value })
                                  }
                                />
                              </label>

                              <label className="areas-field is-wide">
                                <span className="areas-label">
                                  Descripción
                                  <Help text="Qué hace el área, en una o dos líneas. Se lee al asignarle trabajo." />
                                </span>
                                <textarea
                                  rows={2}
                                  value={draft.description}
                                  onChange={(event) =>
                                    setDraft({ ...draft, description: event.target.value })
                                  }
                                />
                              </label>

                              <label className="areas-field is-wide">
                                <span className="areas-label">
                                  Depende de
                                  <Help text="Quien es responsable del área superior ve también el trabajo de esta. No se ofrecen esta área ni las que dependen de ella." />
                                </span>
                                <select
                                  value={draft.parentAreaId}
                                  onChange={(event) =>
                                    setDraft({ ...draft, parentAreaId: event.target.value })
                                  }
                                >
                                  <option value="">Ninguna: queda fuera del organigrama</option>
                                  {parentOptions(descendants(area))}
                                </select>
                              </label>
                            </div>

                            {area.children.length > 0 && (
                              <p className="areas-note">
                                De ella dependen{" "}
                                {area.children.map((child) => child.name).join(", ")}.
                              </p>
                            )}
                          </section>

                          <section className="areas-sec">
                            <h3>
                              Integrantes <span className="areas-sub">{draft.members.length}</span>
                            </h3>

                            {draft.members.length > 0 ? (
                              <ul className="areas-members">
                                {draft.members.map((member) => (
                                  <MemberRow
                                    key={member.id}
                                    area={area}
                                    member={member}
                                    removing={mode === `rm:${member.id}`}
                                    onLead={(lead) =>
                                      setDraft({
                                        ...draft,
                                        members: draft.members.map((other) =>
                                          other.id === member.id ? { ...other, lead } : other,
                                        ),
                                      })
                                    }
                                    onAskRemove={() => {
                                      if (area.members.some((person) => person.id === member.id)) {
                                        setMode(`rm:${member.id}`);
                                      } else {
                                        setDraft({
                                          ...draft,
                                          members: draft.members.filter(
                                            (other) => other.id !== member.id,
                                          ),
                                        });
                                      }
                                    }}
                                    onCancelRemove={() => setMode(null)}
                                    onRemove={() => {
                                      setDraft({
                                        ...draft,
                                        members: draft.members.filter(
                                          (other) => other.id !== member.id,
                                        ),
                                      });
                                      setMode(null);
                                    }}
                                  />
                                ))}
                              </ul>
                            ) : (
                              <p className="areas-note">Nadie está en esta área todavía.</p>
                            )}

                            <div className="areas-add">
                              <select
                                aria-label="Agregar a una persona"
                                value={adding}
                                onChange={(event) => setAdding(event.target.value)}
                              >
                                <option value="">Agregar a una persona…</option>
                                {people
                                  .filter(
                                    (person) =>
                                      !draft.members.some((member) => member.id === person.id),
                                  )
                                  .map((person) => (
                                    <option key={person.id} value={person.id}>
                                      {person.fullName} · {ROLE_NAMES[person.role] ?? person.role}
                                    </option>
                                  ))}
                              </select>

                              <button
                                className="areas-btn"
                                type="button"
                                disabled={adding === ""}
                                onClick={() => {
                                  const person = people.find(
                                    (one) => one.id === Number(adding),
                                  );
                                  setDraft({
                                    ...draft,
                                    members: [...draft.members, { ...person, lead: false }],
                                  });
                                  setAdding("");
                                }}
                              >
                                Agregar
                              </button>
                            </div>

                            <p className="areas-muted areas-hint">
                              Las personas se dan de alta, y se les cambia el rol, en Empleados.
                            </p>
                          </section>
                        </div>

                        <footer className="areas-open-foot">
                          {mode === "delete" ? (
                            <>
                              <p className="areas-confirm">
                                ¿Eliminar «{area.name}»?
                                {area.children.length > 0 &&
                                  ` ${area.children.map((child) => child.name).join(" y ")} ${
                                    area.children.length === 1 ? "queda" : "quedan"
                                  } fuera del organigrama, sin área superior.`}
                              </p>
                              <span className="areas-right">
                                <button
                                  className="areas-btn"
                                  type="button"
                                  onClick={() => setMode(null)}
                                >
                                  Cancelar
                                </button>
                                <button
                                  className="areas-btn is-danger"
                                  type="button"
                                  disabled={saving}
                                  onClick={() => handleDelete(area)}
                                >
                                  Eliminar área
                                </button>
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="areas-del">
                                <button
                                  className="areas-quiet is-danger"
                                  type="button"
                                  disabled={draft.members.length > 0}
                                  onClick={() => setMode("delete")}
                                >
                                  Eliminar área
                                </button>
                                {draft.members.length > 0 && (
                                  <span className="areas-muted">
                                    Para eliminarla, primero quita a{" "}
                                    {draft.members.length === 1
                                      ? "su integrante"
                                      : `sus ${draft.members.length} integrantes`}
                                    .
                                  </span>
                                )}
                              </span>

                              <span className="areas-right">
                                <span className="areas-dirty">
                                  {changes > 0 &&
                                    `${changes} ${changes === 1 ? "cambio" : "cambios"} sin guardar`}
                                </span>
                                {changes > 0 && (
                                  <button
                                    className="areas-btn"
                                    type="button"
                                    onClick={() => setDraft(draftOf(area))}
                                  >
                                    Descartar
                                  </button>
                                )}
                                <button
                                  className="areas-btn is-primary"
                                  type="button"
                                  disabled={changes === 0 || saving || draft.name.trim() === ""}
                                  onClick={() => handleSave(area)}
                                >
                                  {saving ? "Guardando…" : "Guardar cambios"}
                                </button>
                              </span>
                            </>
                          )}
                        </footer>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>

        {loading && <p className="areas-empty">Cargando…</p>}

        {!loading && rows.length === 0 && creating === null && (
          <p className="areas-empty">
            {areas.length === 0
              ? "Todavía no hay áreas registradas."
              : "Ningún área ni persona coincide con la búsqueda."}
          </p>
        )}
      </div>

      {unplaced.length > 0 && term === "" && (
        <p className="areas-unplaced">
          <span className="areas-eyebrow">Sin área</span>{" "}
          {unplaced.map((person) => person.fullName).join(", ")}.
          <Help text="Sin área, una persona no recibe etapas ni ve el trabajo de ninguna. Finanzas es la excepción: consulta todas sin pertenecer a una." />
        </p>
      )}
    </section>
  );
}

export default Areas;
