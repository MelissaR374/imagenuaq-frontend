// «Panorama de áreas»: every area the person hands work out in -- all of them for coordination -- at a
// glance: what each still has to assign and how loaded its people are this week (RF-TSK-06,
// RF-RPT-02). It draws the rows of «Equipo» and sends to «Por asignar» to act.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import MemberRow from "./memberRow.jsx";
import { thisWeek } from "./taskText.js";
import "./tasks.css";

/**
 * @param {{ onOpenInbox?: ((areaId: number) => void) | null,
 *   onOpenProject?: ((projectId: number) => void) | null }} props
 */
function Overview({ onOpenInbox = null, onOpenProject = null }) {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getTaskOverview(thisWeek())
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (overview === null) {
    return error === null ? <p className="tasks-note">Cargando…</p> : <p className="tasks-error">{error}</p>;
  }
  if (overview.areas.length === 0) {
    return <p className="tasks-empty">No eres responsable de ningún área.</p>;
  }

  const people = new Map(overview.areas.flatMap((area) => area.members).map((member) => [member.userId, member]));
  const totals = [
    { label: "Por asignar", value: overview.areas.reduce((sum, area) => sum + area.unassigned, 0) },
    { label: "Vencidas sin responsable", value: overview.areas.reduce((sum, area) => sum + area.late, 0), late: true },
    { label: "Etapas en curso", value: [...people.values()].reduce((sum, member) => sum + member.openStages, 0) },
    { label: "Personas fuera esta semana", value: [...people.values()].filter((member) => member.awayDays > 0).length },
  ];

  return (
    <div className="tasks">
      <dl className="tasks-totals">
        {totals.map((total) => (
          <div className={total.late && total.value > 0 ? "tasks-total is-late" : "tasks-total"} key={total.label}>
            <dt>{total.label}</dt>
            <dd>{total.value}</dd>
          </div>
        ))}
      </dl>

      <div className="tasks-areas">
        {overview.areas.map((area) => (
          <section className="tasks-area" key={area.id}>
            <header className="tasks-area-head">
              <h3>{area.name}</h3>
              {area.unassigned === 0 ? (
                <span className="tasks-none">Todo asignado</span>
              ) : (
                <button
                  className={area.late > 0 ? "tasks-count-link is-late" : "tasks-count-link"}
                  type="button"
                  disabled={onOpenInbox === null}
                  onClick={() => onOpenInbox(area.id)}
                >
                  {area.unassigned} por asignar
                  {area.late > 0 ? ` · ${area.late} vencidas` : ""}
                </button>
              )}
            </header>
            {area.members.length === 0 ? (
              <p className="tasks-member-empty">Sin integrantes.</p>
            ) : (
              <ul className="tasks-members">
                {[...area.members]
                  .sort((a, b) => b.openStages - a.openStages)
                  .map((member) => (
                    <MemberRow member={member} from={overview.from} onOpenProject={onOpenProject} key={member.userId} />
                  ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

export default Overview;
