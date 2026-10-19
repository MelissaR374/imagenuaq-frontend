// The areas a person hands work out in, as tabs carrying how much each still has to assign, so the
// pile-up shows before any area is opened.

/**
 * @param {{ areas: { id: number, name: string, unassigned: number, late: number }[],
 *   value: string, onChange: (areaId: string) => void }} props
 */
function AreaTabs({ areas, value, onChange }) {
  return (
    <div className="tasks-tabs" role="tablist">
      {areas.map((area) => (
        <button
          className={String(area.id) === value ? "tasks-tab is-active" : "tasks-tab"}
          type="button"
          role="tab"
          aria-selected={String(area.id) === value}
          onClick={() => onChange(String(area.id))}
          key={area.id}
        >
          {area.name}
          {area.unassigned > 0 ? (
            <span className={area.late > 0 ? "tasks-count is-late" : "tasks-count"}>{area.unassigned}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export default AreaTabs;
