// A file browser after Google Drive (RF-ARC-01, RF-ARC-02): a project's folder in its detail, or,
// from the «Archivos» tab, a top level listing every root, where a project's folder carries the
// project's key as its name. What the caller may do comes back with the folder as `access`
// (owner, write or read); the server still decides, and its refusal is shown as sent.
//
// A click selects, Ctrl or Shift adds to the selection, a double click or Enter opens. The right
// button or ⋮ opens the menu of what is selected; on empty space, the menu of the folder itself.
// Files dropped from the desktop are uploaded and items dragged onto a folder are moved there.
// The search bar looks through every file beneath `root` by name and lists the matches under
// it; choosing one opens its folder with the file in view.
//
// A project's folder is named by its key; the project's title shows beneath it, and once the
// project is closed or archived, the date the retention sweep removes its files. A folder with
// working share links carries a link symbol, and «Enlaces compartidos» lists every one of them.
// The items' events are handled once, on their container, which finds the item by `data-key`.
import { useEffect, useRef, useState } from "react";
import {
  MdAdd,
  MdArrowDropDown,
  MdChevronRight,
  MdClose,
  MdCreateNewFolder,
  MdDelete,
  MdDownload,
  MdDriveFileMove,
  MdEdit,
  MdGridView,
  MdLink,
  MdMoreVert,
  MdOpenInNew,
  MdPersonAdd,
  MdSearch,
  MdUploadFile,
  MdViewList,
  MdVisibility,
} from "react-icons/md";

import * as api from "../../api/client.js";
import { saveBlob } from "../shared/download.js";
import { fileSize, shortDate } from "../shared/format.js";
import FileIcon from "../shared/fileIcon.jsx";
import FilePreview from "./filePreview.jsx";
import LinksDialog from "./linksDialog.jsx";
import MoveDialog from "./moveDialog.jsx";
import ShareDialog from "./shareDialog.jsx";
import Thumbnail from "./thumbnail.jsx";
import "./folderBrowser.css";

/** The drag payload of items moved inside the browser, so they are not taken for dropped files. */
const DRAG_TYPE = "application/x-imuaq-items";

/** MIME types the preview can show: images in an `<img>`, PDFs in an `<iframe>`. */
const PREVIEWABLE = /^(image\/|application\/pdf$)/;

/** How long typing must pause before the search asks the server. */
const SEARCH_DELAY_MS = 250;

/** Room kept for the menu so it never opens past the window's right or bottom edge. */
const MENU_ROOM = { width: 240, height: 320 };

/**
 * @param {{ root: { id: number | null, name: string }, canShare?: boolean }} props `canShare`,
 *   whether the viewer holds `document.share`, offers «Enlaces compartidos». A null `root.id` starts at the
 *   list of every root. Remount it with `key={root.id}` to browse another root.
 */
function FolderBrowser({ root, canShare = false }) {
  const [path, setPath] = useState([root]);
  const [folder, setFolder] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [view, setView] = useState("grid");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [reveal, setReveal] = useState(null);
  const [hideEmpty, setHideEmpty] = useState(false);
  const [showLinks, setShowLinks] = useState(false);
  const [selected, setSelected] = useState([]);
  const [anchor, setAnchor] = useState(null);
  const [menu, setMenu] = useState(null);
  const [naming, setNaming] = useState(null);
  const [sharing, setSharing] = useState(null);
  const [moving, setMoving] = useState(null);
  const [previewIndex, setPreviewIndex] = useState(null);
  const [uploads, setUploads] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const uploadInput = useRef(null);
  const body = useRef(null);

  const current = path[path.length - 1];
  const atTop = current.id === null;

  useEffect(() => {
    let cancelled = false;
    const load =
      current.id === null
        ? api.listTopFolders().then((data) => ({ access: "read", folders: data.folders, files: [] }))
        : api.getFolder(current.id).then((data) => data.folder);
    load
      .then((data) => {
        if (!cancelled) setFolder(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [current.id, reload]);

  const needle = query.trim();

  useEffect(() => {
    if (needle === "") return;
    let cancelled = false;
    const timer = setTimeout(() => {
      api
        .searchFiles(needle, root.id)
        .then((data) => {
          if (!cancelled) setResults({ text: needle, files: data.files, folders: data.folders });
        })
        .catch((err) => {
          if (!cancelled) setResults({ text: needle, error: err.message });
        });
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [needle, root.id]);

  useEffect(() => {
    if (folder === null || reveal === null) return;
    const element = body.current?.querySelector(`[data-key="${reveal}"]`);
    element?.scrollIntoView({ block: "center" });
    element?.focus();
  }, [folder, reveal]);

  const canWrite = folder !== null && folder.access !== "read";
  const allFolders = folder?.folders ?? [];
  const folders = allFolders
    .filter((item) => !(hideEmpty && item.empty))
    .map((item) => ({ key: `d${item.id}`, kind: "folder", item }));
  const files = (folder?.files ?? []).map((item) => ({ key: `f${item.id}`, kind: "file", item }));
  const entries = [...folders, ...files];
  const chosen = entries.filter((entry) => selected.includes(entry.key));
  const one = chosen.length === 1 ? chosen[0] : null;
  const allFiles = chosen.length > 0 && chosen.every((entry) => entry.kind === "file");
  const previewable = files
    .map((entry) => entry.item)
    .filter((file) => PREVIEWABLE.test(file.mime ?? ""));

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setReload((n) => n + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function navigate(next) {
    setPath(next);
    setFolder(null);
    setError(null);
    setSelected([]);
    setAnchor(null);
    setReveal(null);
  }

  function goToFolder(hit) {
    navigate(root.id === null ? [root, ...hit.path] : hit.path);
    setQuery("");
    setSearching(false);
  }

  function openLinked(linkPath) {
    setShowLinks(false);
    navigate(root.id === null ? [root, ...linkPath] : linkPath);
  }

  function goToHit(hit) {
    navigate(root.id === null ? [root, ...hit.path] : hit.path);
    setSelected([`f${hit.id}`]);
    setAnchor(`f${hit.id}`);
    setReveal(`f${hit.id}`);
    setQuery("");
    setSearching(false);
  }

  function searchKey(event) {
    if (event.key === "Escape") {
      setQuery("");
      event.currentTarget.blur();
    }
  }

  async function download(file) {
    setError(null);
    try {
      saveBlob(await api.downloadFile(file.id), file.name);
    } catch (err) {
      setError(err.message);
    }
  }

  function openEntry(entry) {
    if (entry.kind === "folder") {
      navigate([...path, { id: entry.item.id, name: entry.item.name }]);
      return;
    }
    const index = previewable.findIndex((file) => file.id === entry.item.id);
    if (index === -1) download(entry.item);
    else setPreviewIndex(index);
  }

  function openMenu(kind, x, y) {
    setMenu({
      kind,
      x: Math.max(0, Math.min(x, window.innerWidth - MENU_ROOM.width)),
      y: Math.max(0, Math.min(y, window.innerHeight - MENU_ROOM.height)),
    });
  }

  function openMenuBelow(kind, event) {
    const box = event.currentTarget.getBoundingClientRect();
    openMenu(kind, box.left, box.bottom + 4);
  }

  function entryAt(event) {
    const element = event.target.closest("[data-key]");
    if (element === null) return null;
    return entries.find((entry) => entry.key === element.dataset.key) ?? null;
  }

  function selectOnly(entry) {
    setSelected([entry.key]);
    setAnchor(entry.key);
  }

  function click(event) {
    const entry = entryAt(event);
    if (entry === null) {
      setSelected([]);
      return;
    }
    const more = event.target.closest("[data-more]");
    if (more !== null) {
      if (!selected.includes(entry.key)) selectOnly(entry);
      const box = more.getBoundingClientRect();
      openMenu("items", box.left, box.bottom);
      return;
    }
    if (event.shiftKey && anchor !== null) {
      const from = entries.findIndex((item) => item.key === anchor);
      const to = entries.findIndex((item) => item.key === entry.key);
      if (from !== -1) {
        const [low, high] = from < to ? [from, to] : [to, from];
        setSelected(entries.slice(low, high + 1).map((item) => item.key));
        return;
      }
    }
    if (event.ctrlKey || event.metaKey) {
      setSelected(
        selected.includes(entry.key)
          ? selected.filter((key) => key !== entry.key)
          : [...selected, entry.key],
      );
      setAnchor(entry.key);
      return;
    }
    selectOnly(entry);
  }

  function doubleClick(event) {
    const entry = entryAt(event);
    if (entry !== null && event.target.closest("[data-more]") === null) openEntry(entry);
  }

  function contextMenu(event) {
    const entry = entryAt(event);
    if (entry === null && atTop) return;
    event.preventDefault();
    if (entry === null) {
      setSelected([]);
      openMenu("here", event.clientX, event.clientY);
      return;
    }
    if (!selected.includes(entry.key)) selectOnly(entry);
    openMenu("items", event.clientX, event.clientY);
  }

  function keyDown(event) {
    if (event.key === "Escape") {
      setSelected([]);
    } else if (event.key === "Delete" && canWrite && chosen.length > 0) {
      remove();
    } else if (event.key === "Enter" && event.target.closest("[data-more]") === null) {
      const entry = entryAt(event);
      if (entry !== null) openEntry(entry);
    }
  }

  function dragStart(event) {
    const entry = entryAt(event);
    if (entry === null) return;
    let keys = selected;
    if (!selected.includes(entry.key)) {
      keys = [entry.key];
      selectOnly(entry);
    }
    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(keys));
    event.dataTransfer.effectAllowed = "move";
  }

  function dragOver(event) {
    if (!canWrite) return;
    const entry = entryAt(event);
    const target = entry?.kind === "folder" ? entry.key : "here";
    if (target === "here" && !event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    setDropTarget(target);
  }

  function drop(event) {
    if (!canWrite) return;
    event.preventDefault();
    setDropTarget(null);
    const entry = entryAt(event);
    dropInto(event, entry?.kind === "folder" ? entry.item.id : current.id);
  }

  function stepOver(event, index) {
    if (!canWrite || path[index].id === null || index === path.length - 1) return;
    event.preventDefault();
    setDropTarget(`p${index}`);
  }

  function stepDrop(event, index) {
    if (!canWrite || path[index].id === null) return;
    event.preventDefault();
    setDropTarget(null);
    dropInto(event, path[index].id);
  }

  function dropInto(event, folderId) {
    const dropped = [...event.dataTransfer.files];
    if (dropped.length > 0) {
      uploadTo(folderId, dropped);
      return;
    }
    const raw = event.dataTransfer.getData(DRAG_TYPE);
    if (raw === "" || folderId === current.id) return;
    const keys = JSON.parse(raw);
    moveTo(
      entries.filter((entry) => keys.includes(entry.key)),
      folderId,
    );
  }

  function uploadTo(folderId, list) {
    setUploads({ done: 0, total: list.length });
    run(async () => {
      for (const [index, file] of list.entries()) {
        await api.uploadFile(folderId, file);
        setUploads({ done: index + 1, total: list.length });
      }
    });
  }

  function pickFiles() {
    uploadInput.current.click();
  }

  function upload(event) {
    const list = [...event.target.files];
    event.target.value = "";
    if (list.length > 0) uploadTo(current.id, list);
  }

  function moveTo(list, folderId) {
    const moved = list.filter((entry) => !(entry.kind === "folder" && entry.item.id === folderId));
    if (moved.length === 0) return;
    setSelected([]);
    run(async () => {
      for (const entry of moved) {
        if (entry.kind === "file") await api.updateFile(entry.item.id, { folderId });
        else await api.updateFolder(entry.item.id, { parentId: folderId });
      }
    });
  }

  function remove() {
    const what = one === null ? `${chosen.length} elementos` : `«${one.item.name}»`;
    const inside = chosen.some((entry) => entry.kind === "folder")
      ? " Las carpetas se eliminan con todo lo que tienen dentro."
      : "";
    if (!window.confirm(`¿Eliminar ${what}?${inside}`)) return;
    const doomed = chosen;
    setSelected([]);
    run(async () => {
      for (const entry of doomed) {
        if (entry.kind === "file") await api.deleteFile(entry.item.id);
        else await api.deleteFolder(entry.item.id);
      }
    });
  }

  async function downloadChosen() {
    setError(null);
    try {
      for (const entry of chosen) saveBlob(await api.downloadFile(entry.item.id), entry.item.name);
    } catch (err) {
      setError(err.message);
    }
  }

  function saveName(event) {
    event.preventDefault();
    const name = naming.value.trim();
    const { entry } = naming;
    setNaming(null);
    if (name === "" || name === entry?.item.name) return;
    run(async () => {
      if (entry === null) await api.createFolder(current.id, name);
      else if (entry.kind === "folder") await api.updateFolder(entry.item.id, { name });
      else await api.updateFile(entry.item.id, { name });
    });
  }

  function itemClass(entry) {
    const states = [
      selected.includes(entry.key) ? "is-selected" : "",
      dropTarget === entry.key ? "is-drop" : "",
    ];
    return `drive-item ${states.join(" ")}`;
  }

  function moreButton(entry) {
    return (
      <button
        className="drive-more"
        type="button"
        data-more
        aria-label={`Más acciones para ${entry.item.name}`}
        title="Más acciones"
      >
        <MdMoreVert />
      </button>
    );
  }

  function endedBadge(project) {
    if (!project?.filesExpireAt) return null;
    return (
      <span className="drive-badge">
        {project.closedAt ? "Cerrado" : "Archivado"} · se borra el {shortDate(project.filesExpireAt)}
      </span>
    );
  }

  function itemName(entry) {
    const project = entry.item.project;
    return (
      <span className="drive-item-text">
        <span className="drive-item-title">
          <span className="drive-name">{entry.item.name}</span>
          {entry.item.links > 0 ? (
            <MdLink
              className="drive-link-icon"
              title={entry.item.links === 1 ? "1 enlace vigente" : `${entry.item.links} enlaces vigentes`}
            />
          ) : null}
        </span>
        {project ? <span className="drive-item-sub">{project.title}</span> : null}
        {endedBadge(project)}
      </span>
    );
  }

  function itemIcon(entry) {
    return entry.kind === "folder" ? (
      <FileIcon folder />
    ) : (
      <FileIcon name={entry.item.name} mime={entry.item.mime} />
    );
  }

  function menuItem(Icon, label, action) {
    return (
      <li key={label} role="none">
        <button className="drive-menu-item" type="button" role="menuitem" onClick={action}>
          <Icon className="drive-menu-icon" />
          {label}
        </button>
      </li>
    );
  }

  function toolButton(Icon, label, action) {
    return (
      <button
        className="drive-icon-btn"
        type="button"
        onClick={action}
        aria-label={label}
        title={label}
      >
        <Icon />
      </button>
    );
  }

  const shareChosen = () => setSharing({ id: one.item.id, name: one.item.name });
  const moveChosen = () => setMoving(chosen);
  const renameChosen = () =>
    setNaming({ title: "Cambiar nombre", value: one.item.name, entry: one });

  const itemsMenu = [
    one?.kind === "folder" && menuItem(MdOpenInNew, "Abrir", () => openEntry(one)),
    one?.kind === "file" && PREVIEWABLE.test(one.item.mime ?? "")
      ? menuItem(MdVisibility, "Vista previa", () => openEntry(one))
      : null,
    allFiles && menuItem(MdDownload, "Descargar", downloadChosen),
    one !== null && canWrite && menuItem(MdEdit, "Cambiar nombre", renameChosen),
    one?.kind === "folder" && menuItem(MdPersonAdd, "Compartir", shareChosen),
    canWrite && menuItem(MdDriveFileMove, "Mover", moveChosen),
    canWrite && menuItem(MdDelete, "Eliminar", remove),
  ];

  const hereMenu = [
    canWrite &&
      menuItem(MdCreateNewFolder, "Nueva carpeta", () =>
        setNaming({ title: "Nueva carpeta", value: "Carpeta sin título", entry: null }),
      ),
    canWrite && menuItem(MdUploadFile, "Subir archivos", pickFiles),
    menu?.kind === "here" &&
      !atTop &&
      menuItem(MdPersonAdd, "Compartir esta carpeta", () =>
        setSharing({ id: current.id, name: current.name }),
      ),
  ];

  return (
    <div className="drive">
      <div className="drive-top">
        <button
          className="drive-new"
          type="button"
          onClick={(event) => openMenuBelow("new", event)}
          disabled={!canWrite}
        >
          <MdAdd className="drive-new-icon" />
          Nuevo
        </button>

        <div
          className="drive-search-box"
          onFocus={() => setSearching(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setSearching(false);
          }}
        >
          <label className="drive-search">
            <MdSearch className="drive-search-icon" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={searchKey}
              placeholder={root.id === null ? "Buscar archivos" : `Buscar en «${root.name}»`}
              aria-label="Buscar archivos por nombre"
            />
          </label>

          {searching && needle !== "" ? (
            <div className="drive-results">
              {results === null || results.text !== needle ? (
                <p className="drive-note">Buscando…</p>
              ) : results.error !== undefined ? (
                <p className="drive-error">{results.error}</p>
              ) : results.files.length === 0 && results.folders.length === 0 ? (
                <p className="drive-note">Ningún archivo coincide.</p>
              ) : (
                <ul className="drive-results-list">
                  {results.folders.map((hit) => (
                    <li key={`d${hit.id}`}>
                      <button className="drive-result" type="button" onClick={() => goToFolder(hit)}>
                        <FileIcon folder />
                        <span className="drive-result-text">
                          <span className="drive-name">{hit.name}</span>
                          <span className="drive-result-path">{hit.project?.title}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                  {results.files.map((hit) => (
                    <li key={hit.id}>
                      <button className="drive-result" type="button" onClick={() => goToHit(hit)}>
                        <FileIcon name={hit.name} mime={hit.mime} />
                        <span className="drive-result-text">
                          <span className="drive-name">{hit.name}</span>
                          <span className="drive-result-path">
                            {hit.path.map((step) => step.name).join(" › ")}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>

        <input
          ref={uploadInput}
          className="drive-hidden"
          type="file"
          multiple
          onChange={upload}
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>

      <div className="drive-bar">
        <nav className="drive-path" aria-label="Ruta de la carpeta">
          {path.map((step, index) => (
            <span className="drive-path-part" key={`${index}-${step.id}`}>
              {index > 0 ? <MdChevronRight className="drive-path-sep" /> : null}
              {index === path.length - 1 ? (
                <button
                  className="drive-path-step is-current"
                  type="button"
                  aria-current="page"
                  onClick={(event) => {
                    if (!atTop) openMenuBelow("here", event);
                  }}
                >
                  {step.name}
                  {atTop ? null : <MdArrowDropDown />}
                </button>
              ) : (
                <button
                  className={`drive-path-step ${dropTarget === `p${index}` ? "is-drop" : ""}`}
                  type="button"
                  onClick={() => navigate(path.slice(0, index + 1))}
                  onDragOver={(event) => stepOver(event, index)}
                  onDragLeave={() => setDropTarget(null)}
                  onDrop={(event) => stepDrop(event, index)}
                >
                  {step.name}
                </button>
              )}
            </span>
          ))}
        </nav>

        <button
          className={`drive-chip ${hideEmpty ? "is-on" : ""}`}
          type="button"
          onClick={() => setHideEmpty(!hideEmpty)}
          aria-pressed={hideEmpty}
        >
          Ocultar carpetas vacías
        </button>

        {canShare ? (
          <button className="drive-chip" type="button" onClick={() => setShowLinks(true)}>
            <MdLink className="drive-chip-icon" />
            Enlaces compartidos
          </button>
        ) : null}

        <div className="drive-view" role="group" aria-label="Vista">
          <button
            className={`drive-icon-btn ${view === "list" ? "is-on" : ""}`}
            type="button"
            onClick={() => setView("list")}
            aria-pressed={view === "list"}
            aria-label="Vista de lista"
            title="Vista de lista"
          >
            <MdViewList />
          </button>
          <button
            className={`drive-icon-btn ${view === "grid" ? "is-on" : ""}`}
            type="button"
            onClick={() => setView("grid")}
            aria-pressed={view === "grid"}
            aria-label="Vista de cuadrícula"
            title="Vista de cuadrícula"
          >
            <MdGridView />
          </button>
        </div>
      </div>

      {chosen.length === 0 ? (
        <div className="drive-selection is-empty" />
      ) : (
        <div className="drive-selection" role="toolbar" aria-label="Acciones de la selección">
          {toolButton(MdClose, "Quitar selección", () => setSelected([]))}
          <span className="drive-selection-count">
            {chosen.length === 1 ? "1 seleccionado" : `${chosen.length} seleccionados`}
          </span>
          {one?.kind === "folder" ? toolButton(MdPersonAdd, "Compartir", shareChosen) : null}
          {allFiles ? toolButton(MdDownload, "Descargar", downloadChosen) : null}
          {canWrite ? toolButton(MdDriveFileMove, "Mover", moveChosen) : null}
          {canWrite ? toolButton(MdDelete, "Eliminar", remove) : null}
          {one !== null && canWrite ? toolButton(MdEdit, "Cambiar nombre", renameChosen) : null}
        </div>
      )}

      {error !== null ? <p className="drive-error">{error}</p> : null}

      {folder?.project?.filesExpireAt ? (
        <p className="drive-notice">
          El proyecto «{folder.project.title}» se{" "}
          {folder.project.closedAt ? "cerró" : "archivó"} el{" "}
          {shortDate(folder.project.closedAt ?? folder.project.archivedAt)}. Sus archivos se
          eliminarán el {shortDate(folder.project.filesExpireAt)}.
        </p>
      ) : null}

      <div
        ref={body}
        className={`drive-body ${dropTarget === "here" ? "is-drop" : ""}`}
        onClick={click}
        onDoubleClick={doubleClick}
        onContextMenu={contextMenu}
        onKeyDown={keyDown}
        onDragStart={dragStart}
        onDragOver={dragOver}
        onDragLeave={() => setDropTarget(null)}
        onDrop={drop}
        onDragEnd={() => setDropTarget(null)}
      >
        {folder === null ? (
          error === null ? (
            <p className="drive-note">Cargando…</p>
          ) : null
        ) : entries.length === 0 ? (
          <p className="drive-empty">
            {allFolders.length > 0
              ? "Solo hay carpetas vacías."
              : canWrite
                ? "Carpeta vacía. Arrastra archivos aquí o usa «Nuevo»."
                : "Carpeta vacía."}
          </p>
        ) : view === "grid" ? (
          <>
            {folders.length === 0 ? null : (
              <section className="drive-section">
                <h3 className="drive-section-title">Carpetas</h3>
                <ul className="drive-folders" role="listbox" aria-multiselectable="true">
                  {folders.map((entry) => (
                    <li
                      className={itemClass(entry)}
                      key={entry.key}
                      data-key={entry.key}
                      role="option"
                      tabIndex={0}
                      draggable={canWrite}
                      aria-selected={selected.includes(entry.key)}
                    >
                      {itemIcon(entry)}
                      {itemName(entry)}
                      {moreButton(entry)}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {files.length === 0 ? null : (
              <section className="drive-section">
                <h3 className="drive-section-title">Archivos</h3>
                <ul className="drive-files" role="listbox" aria-multiselectable="true">
                  {files.map((entry) => (
                    <li
                      className={`${itemClass(entry)} drive-card`}
                      key={entry.key}
                      data-key={entry.key}
                      role="option"
                      tabIndex={0}
                      draggable={canWrite}
                      aria-selected={selected.includes(entry.key)}
                    >
                      <Thumbnail file={entry.item} />
                      <span className="drive-card-foot">
                        {itemIcon(entry)}
                        <span className="drive-name">{entry.item.name}</span>
                        {moreButton(entry)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : (
          <table className="drive-table" role="grid" aria-multiselectable="true">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Fecha</th>
                <th>Tamaño</th>
                <th>
                  <span className="drive-hidden">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  className={itemClass(entry)}
                  key={entry.key}
                  data-key={entry.key}
                  tabIndex={0}
                  draggable={canWrite}
                  aria-selected={selected.includes(entry.key)}
                >
                  <td>
                    <span className="drive-cell-name">
                      {itemIcon(entry)}
                      {itemName(entry)}
                    </span>
                  </td>
                  <td>{shortDate(entry.item.createdAt)}</td>
                  <td>{entry.kind === "file" ? fileSize(entry.item.size) : "—"}</td>
                  <td className="drive-cell-more">{moreButton(entry)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {dropTarget === "here" ? (
          <p className="drive-drop-hint">Suelta los archivos para subirlos a «{current.name}»</p>
        ) : null}
      </div>

      {menu === null ? null : (
        <div
          className="drive-menu-backdrop"
          onClick={() => setMenu(null)}
          onContextMenu={(event) => {
            event.preventDefault();
            setMenu(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setMenu(null);
          }}
        >
          <ul className="drive-menu" role="menu" style={{ left: menu.x, top: menu.y }}>
            {menu.kind === "items" ? itemsMenu : hereMenu}
          </ul>
        </div>
      )}

      {naming === null ? null : (
        <dialog
          className="drive-dialog"
          ref={(element) => {
            if (element && !element.open) element.showModal();
          }}
          onClose={() => setNaming(null)}
        >
          <form onSubmit={saveName}>
            <h3 className="drive-dialog-title">{naming.title}</h3>
            <input
              className="drive-dialog-input"
              value={naming.value}
              onChange={(event) => setNaming({ ...naming, value: event.target.value })}
              onFocus={(event) => event.target.select()}
              maxLength={255}
              aria-label="Nombre"
              autoFocus
            />
            <div className="drive-dialog-actions">
              <button className="drive-text-btn" type="button" onClick={() => setNaming(null)}>
                Cancelar
              </button>
              <button className="drive-text-btn is-primary" type="submit">
                {naming.entry === null ? "Crear" : "Aceptar"}
              </button>
            </div>
          </form>
        </dialog>
      )}

      {sharing === null ? null : (
        <ShareDialog
          target={sharing}
          onChange={() => setReload((n) => n + 1)}
          onClose={() => setSharing(null)}
        />
      )}

      {showLinks ? (
        <LinksDialog
          onOpen={openLinked}
          onManage={(target) => {
            setShowLinks(false);
            setSharing(target);
          }}
          onChange={() => setReload((n) => n + 1)}
          onClose={() => setShowLinks(false)}
        />
      ) : null}

      {moving === null ? null : (
        <MoveDialog
          start={path}
          count={moving.length}
          excluded={moving.filter((entry) => entry.kind === "folder").map((entry) => entry.item.id)}
          onMove={(folderId) => {
            moveTo(moving, folderId);
            setMoving(null);
          }}
          onClose={() => setMoving(null)}
        />
      )}

      {previewIndex === null ? null : (
        <FilePreview
          files={previewable}
          index={previewIndex}
          onIndex={setPreviewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      )}

      {uploads === null ? null : (
        <div className="drive-toast" role="status">
          <span>
            {busy && uploads.done < uploads.total
              ? `Subiendo ${uploads.done + 1} de ${uploads.total}…`
              : `${uploads.done} de ${uploads.total} subidas completadas`}
          </span>
          {toolButton(MdClose, "Cerrar", () => setUploads(null))}
        </div>
      )}
    </div>
  );
}

export default FolderBrowser;
