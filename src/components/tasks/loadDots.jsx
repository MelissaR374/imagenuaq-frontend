// A person's load as one dot per open stage, coloured by its state, so one stage always looks like
// one and work in progress reads apart from work still waiting its turn.
import { STAGE_STATUS_LABELS } from "./taskText.js";

/** Past this many the rest are a "+n", so a heavy load does not push the row apart. */
const MAX_DOTS = 10;

/**
 * @param {{ stages: { id: number, status: string }[] }} props
 */
function LoadDots({ stages }) {
  const shown = stages.slice(0, MAX_DOTS);
  const rest = stages.length - shown.length;
  return (
    <span className="tasks-dots" aria-label={`${stages.length} ${stages.length === 1 ? "etapa abierta" : "etapas abiertas"}`}>
      {shown.map((stage) => (
        <span
          className={`tasks-dot is-${stage.status}`}
          title={STAGE_STATUS_LABELS[stage.status]}
          key={stage.id}
        />
      ))}
      {rest > 0 ? <span className="tasks-dots-more">+{rest}</span> : null}
    </span>
  );
}

export default LoadDots;
