// «Calendario» (RF-CAL-02, RF-CAL-03, RF-CAL-05): a month of what happens, on the person's own work,
// their areas', or, for coordination, everyone's, drawn by FullCalendar so an event of several days is
// one bar. Stages and absences are drawn as the server keeps them; notes are post-its anyone sticks on
// a day; global events and closure windows are written by whoever holds `calendar.write`, by form or by
// dragging them to another day.
import { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";

import * as api from "../../api/client.js";
import Closures from "./closures.jsx";
import EventContent from "./eventContent.jsx";
import GlobalEventForm from "./globalEventForm.jsx";
import NoteForm from "./noteForm.jsx";
import { LAYERS, addDays, daysApart, isoDay } from "./calendarText.js";
import "./calendar.css";

/** How many bars a day shows before folding the rest into "+n más", unless the viewer shows all. */
const DAY_LIMIT = 6;

/** Where the "show everything" choice is remembered, per browser. */
const SHOW_ALL_KEY = "imagenuaq.calendar.showAll";

/** The order bars stack in within a day: the frame of the day first, people's work last. */
const KIND_ORDER = { closure: 0, global: 1, other: 1, due: 2, note: 3, absence: 4, stage: 5 };

/** One server event as a FullCalendar event; all-day ends are already the next midnight. */
function toCalendarEvent(event, canWrite) {
  const kind = event.kind === "other" ? "global" : event.kind;
  let range = { start: event.startsAt, end: event.endsAt, allDay: false };
  if (event.kind === "due") range = { start: event.day, allDay: true };
  else if (event.allDay) range = { start: isoDay(new Date(event.startsAt)), end: isoDay(new Date(event.endsAt)), allDay: true };
  return {
    id: `${event.kind}-${event.id}-${event.userId ?? ""}-${event.startsAt}`,
    ...range,
    title: event.title,
    editable: kind === "note" ? event.editable : canWrite && event.editable,
    classNames: [
      "calendar-ev",
      `is-${kind}`,
      event.type === "festivo" ? "is-festivo" : null,
      event.inClosure ? "is-in-closure" : null,
      event.stageStatus === "waiting_external" ? "is-waiting" : null,
    ].filter(Boolean),
    extendedProps: { order: KIND_ORDER[event.kind], item: { kind, event } },
  };
}

/**
 * @param {{ isAdmin: boolean, canWrite: boolean,
 *   onOpenProject?: ((projectId: number) => void) | null }} props
 */
function Calendar({ isAdmin, canWrite, onOpenProject = null }) {
  const [range, setRange] = useState(null);
  const [scope, setScope] = useState(isAdmin ? "all" : "area");
  const [areaId, setAreaId] = useState("");
  const [userId, setUserId] = useState("");
  const [hidden, setHidden] = useState([]);
  const [showAll, setShowAll] = useState(() => {
    try {
      return localStorage.getItem(SHOW_ALL_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [data, setData] = useState(null);
  const [people, setPeople] = useState(new Map());
  const [areas, setAreas] = useState({ mine: [], all: [] });
  const [error, setError] = useState(null);
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState(null);
  const [noteDraft, setNoteDraft] = useState(null);
  const [showClosures, setShowClosures] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getProfile(), isAdmin ? api.listAreas() : Promise.resolve(null)])
      .then(([profile, every]) => {
        if (cancelled) return;
        const mine = profile.user.areas ?? [];
        setAreas({ mine, all: every === null ? mine : every.areas });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (range === null) return undefined;
    let cancelled = false;
    api
      .getCalendar({ from: range.from, to: range.to, scope, areaId, userId })
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
        setPeople((current) => {
          const next = new Map(current);
          for (const event of result.events) {
            if (event.userId !== null && event.userName) next.set(String(event.userId), event.userName);
          }
          return next;
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [range, scope, areaId, userId, reload]);

  function toggleLayer(kind) {
    setHidden(hidden.includes(kind) ? hidden.filter((layer) => layer !== kind) : [...hidden, kind]);
  }

  /** Folds or unfolds every day; without browser storage the choice lasts until the page reloads. */
  function toggleShowAll() {
    setShowAll(!showAll);
    try {
      localStorage.setItem(SHOW_ALL_KEY, showAll ? "0" : "1");
    } catch {
      return;
    }
  }

  function chooseScope(next) {
    setScope(next);
    setUserId("");
  }

  function closeForms() {
    setEditing(null);
    setNoteDraft(null);
    setFormError(null);
  }

  /** Runs a write and reloads; a form's own save also closes the form. */
  async function write(action, fromForm = false) {
    setBusy(true);
    setFormError(null);
    try {
      await action();
      if (fromForm) closeForms();
      setReload(reload + 1);
      return true;
    } catch (err) {
      if (fromForm) setFormError(err.message);
      else setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function drop(info) {
    const { item } = info.event.extendedProps;
    const offset = daysApart(isoDay(info.oldEvent.start), isoDay(info.event.start));
    let action;
    if (item.kind === "closure") {
      const { closure } = item;
      action = () =>
        api.updateClosure(closure.id, { startsOn: addDays(closure.startsOn, offset), endsOn: addDays(closure.endsOn, offset) });
    } else if (item.kind === "note") {
      action = () => api.updateNote(item.event.id, { day: isoDay(info.event.start) });
    } else {
      const shift = (value) => {
        const date = new Date(value);
        date.setDate(date.getDate() + offset);
        return date.toISOString();
      };
      action = () =>
        api.updateCalendarEvent(item.event.id, {
          startsAt: shift(item.event.seriesStartsAt),
          endsAt: shift(item.event.seriesEndsAt),
        });
    }
    if (!(await write(action))) info.revert();
  }

  function open(info) {
    info.jsEvent.preventDefault();
    const { item } = info.event.extendedProps;
    if (item.kind === "stage" || item.kind === "due") {
      if (onOpenProject !== null) onOpenProject(item.event.projectId);
    } else if (item.kind === "closure") {
      if (canWrite) setShowClosures(true);
    } else if (item.kind === "note") {
      if (item.event.editable) {
        setNoteDraft({
          id: item.event.id,
          day: isoDay(new Date(item.event.startsAt)),
          text: item.event.title,
          scope: item.event.noteScope,
          areaId: item.event.areaId,
        });
      }
    } else if (item.event.editable && canWrite) {
      setEditing({ event: item.event });
    }
  }

  const events = [];
  if (data !== null) {
    for (const event of data.events) {
      const shown = toCalendarEvent(event, canWrite);
      if (!hidden.includes(shown.extendedProps.item.kind)) events.push(shown);
    }
    if (!hidden.includes("closure")) {
      for (const closure of data.closures) {
        const end = addDays(closure.endsOn, 1);
        events.push({
          id: `closure-band-${closure.id}`,
          start: closure.startsOn,
          end,
          allDay: true,
          display: "background",
          classNames: ["calendar-closure-band"],
        });
        events.push({
          id: `closure-${closure.id}`,
          start: closure.startsOn,
          end,
          allDay: true,
          title: closure.name,
          editable: canWrite,
          classNames: ["calendar-ev", "is-closure"],
          extendedProps: { order: KIND_ORDER.closure, item: { kind: "closure", closure } },
        });
      }
    }
  }

  const scopes = [
    { value: "mine", label: "Mío" },
    isAdmin ? { value: "all", label: "Todas las áreas" } : { value: "area", label: "Mis áreas" },
  ];
  const peopleOptions = [...people].sort((a, b) => a[1].localeCompare(b[1]));
  const formOpen = editing !== null || noteDraft !== null;

  return (
    <div className="calendar">
      <div className="calendar-toolbar">
        <div className="calendar-scope" role="tablist">
          {scopes.map((option) => (
            <button
              className={scope === option.value ? "calendar-tab is-active" : "calendar-tab"}
              type="button"
              role="tab"
              aria-selected={scope === option.value}
              onClick={() => chooseScope(option.value)}
              key={option.value}
            >
              {option.label}
            </button>
          ))}
        </div>

        {scope === "mine" ? null : (
          <div className="calendar-filters">
            <select aria-label="Área" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              <option value="">Todas las áreas</option>
              {areas.all.map((area) => (
                <option value={area.id} key={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
            <select aria-label="Persona" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Todas las personas</option>
              {peopleOptions.map(([id, name]) => (
                <option value={id} key={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        )}

        {canWrite ? (
          <div className="calendar-admin">
            <button className="calendar-btn" type="button" onClick={() => setShowClosures(!showClosures)}>
              Ventanas de cierre
            </button>
            <button className="calendar-btn is-primary" type="button" onClick={() => setEditing({ event: null })}>
              Nuevo evento
            </button>
          </div>
        ) : null}
      </div>

      <div className="calendar-legend" role="group" aria-label="Mostrar">
        {LAYERS.map((layer) => (
          <button
            className={hidden.includes(layer.kind) ? `calendar-key is-${layer.kind} is-off` : `calendar-key is-${layer.kind}`}
            type="button"
            aria-pressed={!hidden.includes(layer.kind)}
            onClick={() => toggleLayer(layer.kind)}
            key={layer.kind}
          >
            <span className="calendar-key-mark" aria-hidden="true" />
            {layer.label}
          </button>
        ))}
        <label className="calendar-switch">
          <input type="checkbox" checked={showAll} onChange={toggleShowAll} />
          No agrupar
        </label>
        <span className="calendar-hint">Haz clic en un día para pegar una nota.</span>
      </div>

      {showClosures && canWrite ? (
        <Closures onChanged={() => setReload(reload + 1)} onClose={() => setShowClosures(false)} />
      ) : null}

      {error === null ? null : <p className="calendar-error">{error}</p>}

      <div className="calendar-month">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale={esLocale}
          firstDay={1}
          height="auto"
          fixedWeekCount={false}
          dayMaxEvents={showAll ? false : DAY_LIMIT}
          headerToolbar={{ left: "today", center: "title", right: "prev,next" }}
          eventOrder="order,start,title"
          eventDurationEditable={false}
          eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          events={events}
          datesSet={(info) => {
            const from = isoDay(info.start);
            const to = addDays(isoDay(info.end), -1);
            setRange((current) => (current?.from === from && current?.to === to ? current : { from, to }));
          }}
          dateClick={(info) => setNoteDraft({ day: info.dateStr })}
          eventClick={open}
          eventDrop={drop}
          eventContent={(arg) =>
            arg.event.extendedProps.item ? <EventContent item={arg.event.extendedProps.item} timeText={arg.timeText} /> : null
          }
        />
      </div>

      {formOpen ? (
        <div className="calendar-overlay" role="presentation" onClick={closeForms}>
          <div className="calendar-dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            {noteDraft !== null ? (
              <NoteForm
                note={noteDraft}
                areas={isAdmin ? areas.all : areas.mine}
                isAdmin={isAdmin}
                busy={busy}
                error={formError}
                onSave={(body) =>
                  write(
                    () => (noteDraft.id === undefined ? api.createNote(body) : api.updateNote(noteDraft.id, body)),
                    true,
                  )
                }
                onDelete={noteDraft.id === undefined ? null : () => write(() => api.deleteNote(noteDraft.id), true)}
                onCancel={closeForms}
                key={noteDraft.id ?? noteDraft.day}
              />
            ) : (
              <GlobalEventForm
                event={editing.event}
                busy={busy}
                error={formError}
                onSave={(body) =>
                  write(
                    () =>
                      editing.event === null ? api.createCalendarEvent(body) : api.updateCalendarEvent(editing.event.id, body),
                    true,
                  )
                }
                onDelete={editing.event === null ? null : () => write(() => api.deleteCalendarEvent(editing.event.id), true)}
                onCancel={closeForms}
                key={editing.event?.id ?? "new"}
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default Calendar;
