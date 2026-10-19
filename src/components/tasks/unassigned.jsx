// «Por asignar»: the open stages an area still has to hand out, one row each, given to someone from the
// row itself (RF-TSK-01, RF-TSK-06). The list ranks by urgency and never by arrival (RF-FLW-08); the
// lightest member who is not away is offered first.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import AreaTabs from "./areaTabs.jsx";
import DueNote from "./dueNote.jsx";
import { thisWeek } from "./taskText.js";
import "./tasks.css";

/**
 * @param {{ openAreaId?: number | null, onOpenProject?: ((projectId: number) => void) | null,
 *   onOpenTeam?: ((areaId: number) => void) | null }} props `openAreaId` opens on that area, as
 *   when «Panorama de áreas» sends someone here.
 */
function Unassigned({ openAreaId = null, onOpenProject = null, onOpenTeam = null }) {
  const [overview, setOverview] = useState(null);
  const [areaId, setAreaId] = useState("");
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getTaskOverview(thisWeek())
      .then((data) => {
        if (cancelled) return;
        setOverview(data);
        const wanted = data.areas.find((area) => area.id === openAreaId);
        const first = wanted ?? data.areas.find((area) => area.unassigned > 0) ?? data.areas[0];
        if (first) setAreaId(String(first.id));
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [openAreaId]);

  useEffect(() => {
    if (areaId === "") return;
    let cancelled = false;
    api
      .listUnassigned(areaId)
      .then((inbox) => {
        if (!cancelled) setItems(inbox.items);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [areaId]);

  function chooseArea(id) {
    setAreaId(id);
    setItems(null);
    setError(null);
  }

  async function assign(item, userId) {
    setBusy(true);
    setError(null);
    try {
      await api.assignStage(item.id, userId);
      const [inbox, data] = await Promise.all([api.listUnassigned(areaId), api.getTaskOverview(thisWeek())]);
      setItems(inbox.items);
      setOverview(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (overview === null) {
    return error === null ? <p className="tasks-note">Cargando…</p> : <p className="tasks-error">{error}</p>;
  }
  if (overview.areas.length === 0) {
    return <p className="tasks-empty">No eres responsable de ningún área.</p>;
  }

  const area = overview.areas.find((one) => String(one.id) === areaId) ?? overview.areas[0];

  return (
    <div className="tasks">
      <AreaTabs areas={overview.areas} value={areaId} onChange={chooseArea} />

      <TeamStrip members={area.members} onOpenTeam={onOpenTeam === null ? null : () => onOpenTeam(area.id)} />

      {error !== null ? <p className="tasks-error">{error}</p> : null}

      {items === null ? (
        error === null ? <p className="tasks-note">Cargando…</p> : null
      ) : items.length === 0 ? (
        <p className="tasks-empty">Todo lo del área tiene responsable.</p>
      ) : (
        <div className="tasks-table-wrap">
          <table className="tasks-table">
            <thead>
              <tr>
                <th>Etapa</th>
                <th>Proyecto</th>
                <th className="tasks-num">Urgencia</th>
                <th>Entrega</th>
                <th>Responsable</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <span className="tasks-row-title">{item.title}</span>
                    <span className="tasks-meta">{item.phaseName}</span>
                  </td>
                  <td>
                    {onOpenProject === null ? (
                      <span className="tasks-key">{item.projectKey}</span>
                    ) : (
                      <button className="tasks-key-link" type="button" onClick={() => onOpenProject(item.projectId)}>
                        {item.projectKey}
                      </button>
                    )}
                    <span className="tasks-meta">{item.projectTitle}</span>
                  </td>
                  <td className="tasks-num">{item.priority}</td>
                  <td>
                    <DueNote dueOn={item.dueOn} />
                  </td>
                  <td>
                    <AssignControl item={item} members={area.members} busy={busy} onAssign={assign} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** The area's people in one line, lightest first, with who is away this week. */
function TeamStrip({ members, onOpenTeam }) {
  if (members.length === 0) return <p className="tasks-empty">El área no tiene integrantes.</p>;

  return (
    <div className="tasks-strip">
      <span className="tasks-strip-label">Equipo</span>
      <ul className="tasks-strip-list">
        {members.map((member) => (
          <li className="tasks-strip-person" key={member.userId}>
            {member.name} <strong>{member.openStages}</strong>
            {member.awayDays > 0 ? (
              <span className="tasks-badge is-away">fuera {member.awayDays} d</span>
            ) : null}
          </li>
        ))}
      </ul>
      {onOpenTeam === null ? null : (
        <button className="tasks-quiet" type="button" onClick={onOpenTeam}>
          Ver equipo
        </button>
      )}
    </div>
  );
}

/** The suggested person as one button, and everyone else in the area behind a picker. */
function AssignControl({ item, members, busy, onAssign }) {
  if (members.length === 0) return <span className="tasks-none">Sin integrantes</span>;

  const suggested = members.find((member) => member.suggested);

  return (
    <span className="tasks-assign">
      {suggested ? (
        <button
          className="tasks-btn is-primary"
          type="button"
          disabled={busy}
          onClick={() => onAssign(item, suggested.userId)}
        >
          Asignar a {suggested.name.split(" ")[0]}
        </button>
      ) : null}
      <select
        className="tasks-assign-other"
        value=""
        disabled={busy}
        aria-label={`Asignar «${item.title}» a otra persona`}
        onChange={(event) => onAssign(item, Number(event.target.value))}
      >
        <option value="" disabled>
          {suggested ? "Otra persona…" : "Asignar a…"}
        </option>
        {members.map((member) => (
          <option value={member.userId} key={member.userId}>
            {member.name} · {member.openStages} {member.openStages === 1 ? "abierta" : "abiertas"}
            {member.awayDays > 0 ? ` · fuera ${member.awayDays} d` : ""}
          </option>
        ))}
      </select>
    </span>
  );
}

export default Unassigned;
