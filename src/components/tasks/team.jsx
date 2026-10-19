// «Equipo»: each member of an area with their open stages, in any area, and the days they are away this
// week; a row opens in place to list the stages (RF-TSK-06, RF-TSK-07, RF-RPT-02). Who is away is
// shown; why is never sent.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import Help from "../shared/help.jsx";
import AreaTabs from "./areaTabs.jsx";
import MemberRow from "./memberRow.jsx";
import { thisWeek } from "./taskText.js";
import "./tasks.css";

/**
 * @param {{ openAreaId?: number | null, onOpenProject?: ((projectId: number) => void) | null }} props
 */
function Team({ openAreaId = null, onOpenProject = null }) {
  const [overview, setOverview] = useState(null);
  const [areaId, setAreaId] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getTaskOverview(thisWeek())
      .then((data) => {
        if (cancelled) return;
        setOverview(data);
        const first = data.areas.find((area) => area.id === openAreaId) ?? data.areas[0];
        if (first) setAreaId(String(first.id));
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [openAreaId]);

  if (overview === null) {
    return error === null ? <p className="tasks-note">Cargando…</p> : <p className="tasks-error">{error}</p>;
  }
  if (overview.areas.length === 0) {
    return <p className="tasks-empty">No eres responsable de ningún área.</p>;
  }

  const area = overview.areas.find((one) => String(one.id) === areaId) ?? overview.areas[0];
  const members = [...area.members].sort((a, b) => b.openStages - a.openStages);

  return (
    <div className="tasks">
      <AreaTabs areas={overview.areas} value={areaId} onChange={setAreaId} />

      {members.length === 0 ? (
        <p className="tasks-empty">El área no tiene integrantes.</p>
      ) : (
        <div className="tasks-members-wrap">
          <div className="tasks-members-head">
            <span>Persona</span>
            <span>
              Carga
              <Help text="Un punto por etapa abierta, en cualquier área: verde activa, gris pendiente, ámbar en espera." />
            </span>
            <span>
              Esta semana
              <Help text="Los días resaltados son días en que la persona tiene una ausencia registrada y aprobada. El motivo no se muestra." />
            </span>
          </div>
          <ul className="tasks-members">
            {members.map((member) => (
              <MemberRow member={member} from={overview.from} onOpenProject={onOpenProject} key={member.userId} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default Team;
