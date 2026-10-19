// «Cronograma» (RF-CAL-01, RF-CAL-06): how busy each area is over the next weeks, and with what. An
// area's row is a heat strip of its open stages against the people present each day, so an absence
// shows as a heavier day; opened, it lists its people with their stages as bars and their absences,
// plus the stages nobody has yet. It reads the same stages and absences as «Calendario», for
// coordination every area and for anyone else their own.
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { MdPrint } from "react-icons/md";

import * as api from "../../api/client.js";
import { addDays, daysApart, isoDay, parseDay } from "../calendar/calendarText.js";
import { DEFAULT_WEEKS, LEVELS, WEEKDAY_INITIALS, WEEK_OPTIONS, areaLevel, stackLanes } from "./timelineText.js";
import "./timeline.css";

const MONTH_FORMAT = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" });
const DAY_FORMAT = new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short" });
const RANGE_FORMAT = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long" });

/** The key of the row for the stages nobody has yet, which cannot collide with a user id. */
const NOBODY = "nobody";

/** The Monday of the week `date` falls in, as YYYY-MM-DD. */
function mondayOf(date) {
  return isoDay(new Date(date.getFullYear(), date.getMonth(), date.getDate() - ((date.getDay() + 6) % 7)));
}

/** A YYYY-MM-DD as a date at noon, so formatting never slips to the day before. */
function noon(day) {
  return new Date(`${day}T12:00`);
}

/** The first and last local day an event covers; an all-day end is the next midnight. */
function eventSpan(event) {
  const end = new Date(event.endsAt);
  return {
    firstDay: isoDay(new Date(event.startsAt)),
    lastDay: isoDay(event.allDay ? new Date(end.getTime() - 1) : end),
  };
}

/**
 * @param {{ isAdmin: boolean, onOpenProject?: ((projectId: number) => void) | null }} props
 */
function Timeline({ isAdmin, onOpenProject = null }) {
  const [start, setStart] = useState(() => mondayOf(new Date()));
  const [weeks, setWeeks] = useState(DEFAULT_WEEKS);
  const [areas, setAreas] = useState(null);
  const [members, setMembers] = useState(new Map());
  const [data, setData] = useState(null);
  const [open, setOpen] = useState([]);
  const [error, setError] = useState(null);

  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
  const step = Math.ceil(weeks / 2) * 7;
  const from = days[0];
  const to = days[days.length - 1];
  const today = isoDay(new Date());

  useEffect(() => {
    let cancelled = false;
    (isAdmin ? api.listAreas().then((result) => result.areas) : api.getProfile().then((result) => result.user.areas ?? []))
      .then(async (list) => {
        const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
        const rosters = await Promise.all(sorted.map((area) => api.listAreaMembers(area.id)));
        if (cancelled) return;
        setAreas(sorted);
        setMembers(new Map(sorted.map((area, i) => [String(area.id), rosters[i].members])));
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    let cancelled = false;
    api
      .getCalendar({ from, to, scope: isAdmin ? "all" : "area" })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, isAdmin]);

  /** Opens every area before printing, so the page carries each person's bars, then restores the view. */
  function print() {
    const before = open;
    flushSync(() => setOpen((areas ?? []).map((area) => String(area.id))));
    window.print();
    setOpen(before);
  }

  function toggle(areaId) {
    setOpen(open.includes(areaId) ? open.filter((id) => id !== areaId) : [...open, areaId]);
  }

  const stagesByArea = new Map();
  const awayByPerson = new Map();
  if (data !== null) {
    for (const event of data.events) {
      const { firstDay, lastDay } = eventSpan(event);
      if (lastDay < from || firstDay > to) continue;
      const bar = {
        event,
        first: Math.max(0, daysApart(from, firstDay)),
        last: Math.min(days.length - 1, daysApart(from, lastDay)),
      };
      if (event.kind === "stage") {
        const key = String(event.areaId);
        if (!stagesByArea.has(key)) stagesByArea.set(key, []);
        stagesByArea.get(key).push(bar);
      } else if (event.kind === "absence" && event.userId !== null) {
        const key = String(event.userId);
        if (!awayByPerson.has(key)) awayByPerson.set(key, []);
        awayByPerson.get(key).push(bar);
      }
    }
  }

  const isAway = (personId, index) => (awayByPerson.get(personId) ?? []).some((bar) => bar.first <= index && index <= bar.last);

  const months = [];
  for (const day of days) {
    const label = MONTH_FORMAT.format(noon(day));
    if (months.length > 0 && months[months.length - 1].label === label) months[months.length - 1].span += 1;
    else months.push({ label, span: 1 });
  }

  function dayClass(base, day) {
    const weekday = noon(day).getDay();
    return [base, weekday === 0 || weekday === 6 ? "is-weekend" : null, day === today ? "is-today" : null]
      .filter(Boolean)
      .join(" ");
  }

  /** One person's (or nobody's) row: the name, then their stages and absences as stacked bars. */
  function personRow(key, name, note, stageBars, awayBars) {
    const { bars, lanes } = stackLanes([
      ...awayBars.map((bar) => ({ ...bar, kind: "absence" })),
      ...stageBars.map((bar) => ({ ...bar, kind: "stage" })),
    ]);
    return (
      <div className="timeline-row" key={key}>
        <div className="timeline-name is-person">
          <span className="timeline-label">{name}</span>
          {note === null ? null : <span className="timeline-size">{note}</span>}
        </div>
        <div className="timeline-lanes" style={{ "--timeline-lanes": lanes }}>
          {days.map((day, index) => (
            <div className={dayClass("timeline-bg", day)} style={{ gridColumn: index + 1 }} key={day} />
          ))}
          {bars.map((bar) => {
            const { event } = bar;
            const place = { gridColumn: `${bar.first + 1} / ${bar.last + 2}`, gridRow: bar.lane + 1 };
            if (bar.kind === "absence") {
              return (
                <div className="timeline-bar is-absence" style={place} title={`${name} · fuera`} key={`a-${event.id}-${bar.first}`}>
                  <span className="timeline-bar-title">Fuera</span>
                </div>
              );
            }
            const stageName = event.title.replace(`${event.projectKey} · `, "");
            const hint = `${event.projectKey} ${event.projectTitle} · ${stageName}`;
            const className = [
              "timeline-bar",
              "is-stage",
              event.stageStatus === "done" ? "is-done" : null,
              event.stageStatus === "waiting_external" ? "is-waiting" : null,
              event.inClosure ? "is-in-closure" : null,
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                className={className}
                style={place}
                type="button"
                title={hint}
                disabled={onOpenProject === null}
                onClick={() => onOpenProject(event.projectId)}
                key={`s-${event.id}`}
              >
                <span className="timeline-bar-title">{stageName}</span>
                {bar.last - bar.first >= 3 ? <span className="timeline-bar-key">{event.projectKey}</span> : null}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="timeline">
      <ul className="timeline-legend print-hide">
        {LEVELS.map((item) => (
          <li className={`timeline-key is-${item.level}`} key={item.level}>
            <span className="timeline-key-mark" aria-hidden="true" />
            {item.label}
          </li>
        ))}
        <li className="timeline-key is-stage">
          <span className="timeline-key-mark" aria-hidden="true" />
          Etapa
        </li>
        <li className="timeline-key is-away">
          <span className="timeline-key-mark" aria-hidden="true" />
          Fuera
        </li>
        <li className="timeline-hint">El color de cada área compara sus etapas con la gente presente ese día.</li>
      </ul>

      <section className="timeline-card">
        <header className="timeline-toolbar">
          <div className="timeline-range print-hide">
            <button className="timeline-btn" type="button" onClick={() => setStart(mondayOf(new Date()))}>
              Hoy
            </button>
            <label className="timeline-field">
              <span>Desde la semana del</span>
              <input
                type="date"
                value={start}
                required
                onChange={(e) => {
                  if (e.target.value !== "") setStart(mondayOf(parseDay(e.target.value)));
                }}
              />
            </label>
            <label className="timeline-field">
              <span>Mostrar</span>
              <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
                {WEEK_OPTIONS.map((option) => (
                  <option value={option} key={option}>
                    {option} semanas
                  </option>
                ))}
              </select>
            </label>
          </div>
          <h3 className="timeline-title">
            {RANGE_FORMAT.format(noon(from))} – {RANGE_FORMAT.format(noon(to))}
          </h3>
          <div className="timeline-arrows print-hide">
            <button className="timeline-btn" type="button" title="Imprimir" onClick={print}>
              <MdPrint aria-hidden="true" /> Imprimir
            </button>
            <button
              className="timeline-btn is-arrow"
              type="button"
              aria-label="Semanas anteriores"
              onClick={() => setStart(addDays(start, -step))}
            >
              ‹
            </button>
            <button
              className="timeline-btn is-arrow"
              type="button"
              aria-label="Semanas siguientes"
              onClick={() => setStart(addDays(start, step))}
            >
              ›
            </button>
          </div>
        </header>

        {error !== null ? <p className="timeline-error">{error}</p> : null}
        {areas === null || data === null ? (
          error === null ? <p className="timeline-note">Cargando…</p> : null
        ) : (
          <div className="timeline-scroll">
            <div className="timeline-grid" style={{ "--timeline-days": days.length }} role="table">
              <div className="timeline-corner" role="columnheader">
                Área
              </div>
              {months.map((month) => (
                <div className="timeline-month" style={{ gridColumn: `span ${month.span}` }} role="columnheader" key={month.label}>
                  {month.label}
                </div>
              ))}

              <div className="timeline-corner is-days" aria-hidden="true" />
              {days.map((day) => (
                <div className={dayClass("timeline-day", day)} role="columnheader" title={DAY_FORMAT.format(noon(day))} key={day}>
                  <span className="timeline-weekday">{WEEKDAY_INITIALS[noon(day).getDay()]}</span>
                  <span className="timeline-daynum">{noon(day).getDate()}</span>
                </div>
              ))}

              {areas.map((area) => {
                const key = String(area.id);
                const people = members.get(key) ?? [];
                const bars = stagesByArea.get(key) ?? [];
                const isOpen = open.includes(key);
                const unassigned = bars.filter((bar) => bar.event.userId === null);
                return (
                  <div className="timeline-group" role="rowgroup" key={key}>
                    <button
                      className={isOpen ? "timeline-name is-area is-open" : "timeline-name is-area"}
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => toggle(key)}
                    >
                      <span className="timeline-caret" aria-hidden="true">
                        ▸
                      </span>
                      <span className="timeline-label">{area.name}</span>
                      <span className="timeline-size">{people.length} pers.</span>
                    </button>
                    {days.map((day, index) => {
                      const stages = bars.filter((bar) => bar.first <= index && index <= bar.last).length;
                      const present = people.filter((person) => !isAway(String(person.id), index)).length;
                      return (
                        <div
                          className={dayClass(`timeline-heat is-${areaLevel(stages, present)}`, day)}
                          title={`${DAY_FORMAT.format(noon(day))} · ${stages} etapas · ${present} de ${people.length} presentes`}
                          key={day}
                        >
                          {stages === 0 ? null : stages}
                        </div>
                      );
                    })}

                    {isOpen ? (
                      <>
                        {people.map((person) => {
                          const personKey = String(person.id);
                          return personRow(
                            `${key}-${personKey}`,
                            person.fullName,
                            person.isAreaLeader ? "Líder" : null,
                            bars.filter((bar) => String(bar.event.userId) === personKey),
                            awayByPerson.get(personKey) ?? [],
                          );
                        })}
                        {unassigned.length === 0
                          ? null
                          : personRow(`${key}-${NOBODY}`, "Sin responsable", null, unassigned, [])}
                        {people.length === 0 && unassigned.length === 0 ? (
                          <div className="timeline-row">
                            <div className="timeline-name is-person">
                              <span className="timeline-label is-empty">Sin integrantes</span>
                            </div>
                            <div className="timeline-lanes" style={{ "--timeline-lanes": 1 }} />
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default Timeline;
