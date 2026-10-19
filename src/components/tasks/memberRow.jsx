// One person of an area with their load: dots per open stage, the count, the week with the days they
// are away, and, opened in place, the stages themselves (RF-TSK-06, RF-TSK-07). «Equipo» and
// «Panorama de áreas» draw the same row.
import { useState } from "react";

import DueNote from "./dueNote.jsx";
import LoadDots from "./loadDots.jsx";
import WeekCells from "./weekCells.jsx";
import { STAGE_STATUS_LABELS } from "./taskText.js";

/**
 * @param {{ member: object, from: string, onOpenProject?: ((projectId: number) => void) | null }} props
 *   `member` as /api/tasks/workload sends it; `from` is the window's first day.
 */
function MemberRow({ member, from, onOpenProject = null }) {
  const [open, setOpen] = useState(false);

  return (
    <li className={open ? "tasks-member is-open" : "tasks-member"}>
      <button
        className="tasks-member-head"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="tasks-member-name">
          {member.name}
          {member.isAreaLeader ? <span className="tasks-badge">Líder</span> : null}
        </span>
        <span className="tasks-member-load">
          <LoadDots stages={member.stages} />
          <strong className="tasks-member-count">{member.openStages}</strong>
        </span>
        <WeekCells from={from} awayDates={member.awayDates} />
      </button>

      {open ? (
        member.stages.length === 0 ? (
          <p className="tasks-member-empty">Sin etapas abiertas.</p>
        ) : (
          <ul className="tasks-member-stages">
            {member.stages.map((stage) => (
              <li className="tasks-member-stage" key={stage.id}>
                {onOpenProject === null ? (
                  <span className="tasks-key">{stage.projectKey}</span>
                ) : (
                  <button className="tasks-key-link" type="button" onClick={() => onOpenProject(stage.projectId)}>
                    {stage.projectKey}
                  </button>
                )}
                <span className="tasks-member-stage-title">
                  {stage.title}
                  <span className="tasks-meta">
                    {stage.projectTitle} · {stage.areaName}
                  </span>
                </span>
                <span className={`tasks-badge is-${stage.status}`}>{STAGE_STATUS_LABELS[stage.status]}</span>
                <DueNote dueOn={stage.dueOn} />
              </li>
            ))}
          </ul>
        )
      ) : null}
    </li>
  );
}

export default MemberRow;
