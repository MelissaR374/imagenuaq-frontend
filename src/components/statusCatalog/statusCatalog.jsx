// The status catalogue (RF-EST-02). A status is what a request or a project is called while it
// moves, and coordination adds them without a deploy -- so this is a screen, not a settings block.
//
// There is one catalogue without an area, the global one every area starts from, and one per area
// with the statuses only that area needs. The tabs are those catalogues; an area's tab shows the
// global ones it inherits as quiet chips above its own, because the area's list would otherwise
// read as the whole of what its pickers offer.
//
// Nothing is deleted. A request or a project points at these rows, so a status leaves by going
// inactive: it stops being offered and what was filed under it keeps reading as it was filed.
// Neither the code nor the area is editable once saved, for the same reason.
//
// The order is the order the pickers show, so it is moved with the arrows rather than typed as a
// number, and the whole catalogue saves together: the draft marks what changed and one
// "Guardar cambios" commits it.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import Help from "../shared/help.jsx";
import "./statusCatalog.css";

const LABEL_MAX = 200;
const CODE_MAX = 50;

/** The code the server accepts: lowercase, no accents, underscores for spaces. */
function slug(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, CODE_MAX);
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

/** What still carries a status: what makes deactivating it a decision and not a guess. */
function usageText(status) {
  if (status.isNew === true) return "Nuevo";

  const parts = [];
  if (status.projectCount > 0) {
    parts.push(plural(status.projectCount, "proyecto", "proyectos"));
  }
  if (status.requestCount > 0) {
    parts.push(plural(status.requestCount, "solicitud", "solicitudes"));
  }
  if (parts.length === 0) return "Sin uso todavía";
  return `Lo tienen ${parts.join(" y ")}`;
}

/** Whether a row differs from what the server has, which is what the amber mark says. */
function hasChanged(status, saved) {
  const original = saved.find((one) => one.id === status.id);
  if (original === undefined) return true;
  return (
    original.label !== status.label ||
    original.isTerminal !== status.isTerminal ||
    original.isActive !== status.isActive
  );
}

function StatusRow({
  status,
  saved,
  first,
  last,
  open,
  confirming,
  onOpen,
  onMove,
  onEdit,
  onDrop,
  onAskOff,
  onOff,
  onCancelOff,
}) {
  const changed = hasChanged(status, saved);
  const held = [
    status.projectCount > 0 ? plural(status.projectCount, "proyecto", "proyectos") : "",
    status.requestCount > 0 ? plural(status.requestCount, "solicitud", "solicitudes") : "",
  ]
    .filter((part) => part !== "")
    .join(" y ");

  return (
    <li
      className={`sc-row ${open ? "is-open" : ""} ${status.isActive ? "" : "is-off"} ${
        changed ? "is-changed" : ""
      }`}
    >
      <div className="sc-row-main">
        <span className="sc-move">
          <button type="button" aria-label="Subir" disabled={first} onClick={() => onMove(-1)}>
            ↑
          </button>
          <button type="button" aria-label="Bajar" disabled={last} onClick={() => onMove(1)}>
            ↓
          </button>
        </span>

        <button className="sc-row-open" type="button" aria-expanded={open} onClick={onOpen}>
          <span className="sc-row-name">
            <span className="sc-row-code">
              {(status.code === "" ? "sin código" : status.code).toUpperCase()}
            </span>
            <strong>{status.label === "" ? "Estatus sin nombre" : status.label}</strong>
          </span>

          <span className="sc-uses">{usageText(status)}</span>

          {status.isActive === false ? (
            <span className="sc-mark">Inactivo</span>
          ) : status.isTerminal ? (
            <span className="sc-mark is-terminal">Cierra el trabajo</span>
          ) : (
            <span className="sc-mark">En curso</span>
          )}
        </button>
      </div>

      {open && (
        <div className="sc-edit">
          <div className="sc-fields">
            <label className="sc-field">
              <span className="sc-label">
                Etiqueta
                <Help text="Lo que se lee en la bandeja, en el proyecto y en el tablero." />
              </span>
              <input
                type="text"
                maxLength={LABEL_MAX}
                placeholder="Ej: En prensa"
                value={status.label}
                onChange={(event) => onEdit({ label: event.target.value })}
              />
            </label>

            <label className="sc-field">
              <span className="sc-label">
                Código
                <Help
                  text={
                    status.isNew === true
                      ? "Sale de la etiqueta mientras no lo cambies. Una vez guardado ya no se edita: lo ya registrado se archivó con él."
                      : "No se edita: las solicitudes y los proyectos ya registrados se archivaron con este código."
                  }
                />
              </span>
              <input
                className="sc-code"
                type="text"
                maxLength={CODE_MAX}
                placeholder="Ej: en_prensa"
                readOnly={status.isNew !== true}
                value={status.code}
                onChange={(event) =>
                  onEdit({ code: slug(event.target.value), codeTouched: true })
                }
              />
            </label>

            <label className="sc-check">
              <input
                type="checkbox"
                checked={status.isTerminal}
                onChange={(event) => onEdit({ isTerminal: event.target.checked })}
              />
              <span>
                Significa que el trabajo terminó
                <Help text="Con un estatus así, el tablero deja de señalar el proyecto como pendiente." />
              </span>
            </label>
          </div>

          {confirming && (
            <p className="sc-confirm">
              ¿Desactivar «{status.label}»? Sale de los selectores.
              {held !== "" && ` ${held} lo conservan.`}
              <button className="sc-btn" type="button" onClick={onCancelOff}>
                Cancelar
              </button>
              <button className="sc-btn is-danger" type="button" onClick={onOff}>
                Desactivar
              </button>
            </p>
          )}

          <div className="sc-edit-actions">
            {status.isNew === true ? (
              <button className="sc-quiet is-danger" type="button" onClick={onDrop}>
                Quitar
              </button>
            ) : status.isActive === false ? (
              <button
                className="sc-btn"
                type="button"
                onClick={() => onEdit({ isActive: true })}
              >
                Reactivar
              </button>
            ) : confirming ? (
              <span />
            ) : (
              <button className="sc-quiet is-danger" type="button" onClick={onAskOff}>
                Desactivar
              </button>
            )}

            <button className="sc-btn" type="button" onClick={onOpen}>
              Listo
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function StatusCatalog() {
  const [areas, setAreas] = useState([]);
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState(null);

  const [catalog, setCatalog] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [confirmOff, setConfirmOff] = useState(false);
  const [savingNow, setSavingNow] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { areas: list } = await api.listAreas();
        const global = await api.listStatuses({ includeInactive: "true" });
        const own = await Promise.all(
          list.map((area) =>
            api.listStatuses({ areaId: area.id, includeInactive: "true" }),
          ),
        );
        if (cancelled) return;

        const byCatalog = { "": global.statuses };
        list.forEach((area, index) => {
          byCatalog[String(area.id)] = own[index].statuses.filter(
            (one) => one.isGlobal === false,
          );
        });

        setAreas(list);
        setSaved(byCatalog);
        setDraft(byCatalog);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const areaName = (key) => areas.find((area) => String(area.id) === key)?.name ?? "";

  function setRows(key, rows) {
    setDraft({ ...draft, [key]: rows });
  }

  /** One change per added, relabelled, re-flagged or (de)activated status, plus one per reorder. */
  function countChanges() {
    if (draft === null) return 0;
    let n = 0;

    for (const key of Object.keys(draft)) {
      const before = saved[key] ?? [];
      for (const status of draft[key]) {
        const original = before.find((one) => one.id === status.id);
        if (original === undefined) {
          n += 1;
          continue;
        }
        if (original.label !== status.label) n += 1;
        if (original.isTerminal !== status.isTerminal) n += 1;
        if (original.isActive !== status.isActive) n += 1;
      }

      const wasOrder = before.map((one) => one.id).join();
      const nowOrder = draft[key]
        .filter((one) => before.some((old) => old.id === one.id))
        .map((one) => one.id)
        .join();
      if (wasOrder !== nowOrder) n += 1;
    }

    return n;
  }

  /**
   * Commits the draft catalogue by catalogue: the new ones are created, the rest patched when
   * their label, their flag, their state or their place in the order moved. The order is sent as
   * `sortOrder`, in tens, so a later insertion has room between two rows.
   */
  async function handleSave() {
    setError(null);
    setSavingNow(true);

    try {
      for (const key of Object.keys(draft)) {
        const before = saved[key] ?? [];

        for (let index = 0; index < draft[key].length; index += 1) {
          const status = draft[key][index];
          const sortOrder = (index + 1) * 10;
          const original = before.find((one) => one.id === status.id);

          if (original === undefined) {
            await api.createStatus({
              areaId: key === "" ? null : Number(key),
              code: status.code,
              label: status.label.trim(),
              sortOrder,
              isTerminal: status.isTerminal,
            });
            continue;
          }

          const changes = {};
          if (original.label !== status.label) changes.label = status.label.trim();
          if (original.isTerminal !== status.isTerminal) changes.isTerminal = status.isTerminal;
          if (original.isActive !== status.isActive) changes.isActive = status.isActive;
          if (original.sortOrder !== sortOrder) changes.sortOrder = sortOrder;

          if (Object.keys(changes).length > 0) await api.updateStatus(status.id, changes);
        }
      }

      setOpenId(null);
      setConfirmOff(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingNow(false);
      setReload(reload + 1);
    }
  }

  if (draft === null) {
    return (
      <section className="sc">
        {error !== null ? (
          <p className="sc-error" role="alert">
            {error}
          </p>
        ) : (
          <p className="sc-empty">Cargando…</p>
        )}
      </section>
    );
  }

  const rows = draft[catalog] ?? [];
  const inactive = rows.filter((one) => one.isActive === false);
  const shown = rows.filter((one) => showInactive || one.isActive);
  const changes = countChanges();
  const where = catalog === "" ? "global" : `de ${areaName(catalog)}`;

  const tabs = [
    { key: "", label: "Global" },
    ...areas.map((area) => ({ key: String(area.id), label: area.name })),
  ];

  function move(status, step) {
    const list = [...rows];
    const from = list.findIndex((one) => one.id === status.id);
    const visible = shown.findIndex((one) => one.id === status.id);
    const neighbour = shown[visible + step];
    if (neighbour === undefined) return;

    const to = list.findIndex((one) => one.id === neighbour.id);
    [list[from], list[to]] = [list[to], list[from]];
    setRows(catalog, list);
  }

  function edit(status, changed) {
    setRows(
      catalog,
      rows.map((one) => {
        if (one.id !== status.id) return one;
        const next = { ...one, ...changed };
        if (
          changed.label !== undefined &&
          one.isNew === true &&
          one.codeTouched !== true
        ) {
          next.code = slug(changed.label);
        }
        return next;
      }),
    );
  }

  function add() {
    const id = `new:${Date.now()}`;
    setRows(catalog, [
      ...rows,
      {
        id,
        code: "",
        label: "",
        isTerminal: false,
        isActive: true,
        projectCount: 0,
        requestCount: 0,
        isNew: true,
      },
    ]);
    setOpenId(id);
    setConfirmOff(false);
  }

  return (
    <section className="sc">
      {error !== null && (
        <p className="sc-error" role="alert">
          {error}
        </p>
      )}

      <div className="sc-bar">
        <div className="sc-tabs" role="tablist" aria-label="Catálogo">
          {tabs.map((tab) => (
            <button
              className={`sc-tab ${catalog === tab.key ? "is-active" : ""}`}
              type="button"
              role="tab"
              aria-selected={catalog === tab.key}
              key={tab.key}
              onClick={() => {
                setCatalog(tab.key);
                setOpenId(null);
                setConfirmOff(false);
              }}
            >
              {tab.label}
              <span className="sc-tab-count">
                {(draft[tab.key] ?? []).filter((one) => one.isActive).length}
              </span>
            </button>
          ))}
        </div>

        {inactive.length > 0 && (
          <button
            className={`sc-chip-btn ${showInactive ? "is-on" : ""}`}
            type="button"
            aria-pressed={showInactive}
            onClick={() => setShowInactive(!showInactive)}
          >
            Ver inactivos ({inactive.length})
          </button>
        )}
      </div>

      <p className="sc-rule">
        {catalog === ""
          ? "Los estatus globales se ofrecen en todas las solicitudes y proyectos. Nada se borra: un estatus desactivado sale de los selectores y lo ya registrado con él no cambia."
          : `${areaName(catalog)} usa los estatus globales y, además, los suyos. Los suyos solo se ofrecen en las solicitudes y proyectos que pasan por el área.`}
      </p>

      {catalog !== "" && (
        <div className="sc-inherited">
          <span className="sc-eyebrow">Del catálogo global</span>
          <span className="sc-chips">
            {(draft[""] ?? [])
              .filter((one) => one.isActive)
              .map((one) => (
                <span className="sc-chip" key={one.id}>
                  {one.label}
                </span>
              ))}
          </span>
          <button className="sc-quiet" type="button" onClick={() => setCatalog("")}>
            Ver el global
          </button>
        </div>
      )}

      <div className="sc-body">
        <div className="sc-sec-head">
          <h3>
            {catalog === "" ? "Estatus globales" : `Estatus propios de ${areaName(catalog)}`}
          </h3>
          <span className="sc-sec-help">En este orden aparecen en los selectores.</span>
        </div>

        {shown.length > 0 ? (
          <ol className="sc-list">
            {shown.map((status, index) => (
              <StatusRow
                key={status.id}
                status={status}
                saved={saved[catalog] ?? []}
                first={index === 0}
                last={index === shown.length - 1}
                open={openId === status.id}
                confirming={openId === status.id && confirmOff}
                onOpen={() => {
                  setOpenId(openId === status.id ? null : status.id);
                  setConfirmOff(false);
                }}
                onMove={(step) => move(status, step)}
                onEdit={(changed) => edit(status, changed)}
                onDrop={() => {
                  setRows(
                    catalog,
                    rows.filter((one) => one.id !== status.id),
                  );
                  setOpenId(null);
                }}
                onAskOff={() => setConfirmOff(true)}
                onCancelOff={() => setConfirmOff(false)}
                onOff={() => {
                  edit(status, { isActive: false });
                  setConfirmOff(false);
                  if (!showInactive) setOpenId(null);
                }}
              />
            ))}
          </ol>
        ) : (
          <p className="sc-none">
            {catalog === ""
              ? "El catálogo global está vacío."
              : `${areaName(catalog)} no tiene estatus propios: usa solo los globales.`}
          </p>
        )}

        <div className="sc-add">
          <button className="sc-add-btn" type="button" onClick={add}>
            Agregar estatus {where}
          </button>
        </div>
      </div>

      <footer className="sc-foot">
        <span className="sc-impact">
          {changes === 0
            ? "Sin cambios."
            : "Al guardar, los selectores de solicitudes y proyectos muestran el catálogo así."}
        </span>

        <span className="sc-right">
          <span className="sc-dirty">
            {changes > 0 && `${changes} ${changes === 1 ? "cambio" : "cambios"} sin guardar`}
          </span>
          {changes > 0 && (
            <button
              className="sc-btn"
              type="button"
              onClick={() => {
                setDraft(saved);
                setOpenId(null);
                setConfirmOff(false);
              }}
            >
              Descartar
            </button>
          )}
          <button
            className="sc-btn is-primary"
            type="button"
            disabled={changes === 0 || savingNow}
            onClick={handleSave}
          >
            {savingNow ? "Guardando…" : "Guardar cambios"}
          </button>
        </span>
      </footer>
    </section>
  );
}

export default StatusCatalog;
