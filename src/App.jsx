// Decide si se ve la entrada, un enlace público o la aplicación, y qué pestaña está abierta.
// La sesión se recupera con GET /api/auth/me y no del token, que parece válido siete días aunque la
// cuenta ya no exista. El interruptor del encabezado cambia entre Coordinación y Fotografía.
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { MdLightMode, MdDarkMode, MdBusiness, MdPhotoCamera } from "react-icons/md";

import Login from "./components/login/login.jsx";
import Sidebar from "./components/sidebar/sidebar.jsx";
import { canSee, descripciones, isPhotoTab, menuSections, modesFor, photoSections } from "./components/sidebar/menu.js";
import Users from "./components/users/users.jsx";
import Areas from "./components/areas/areas.jsx";
import Roles from "./components/roles/roles.jsx";
import Spreadsheets from "./components/spreadsheets/spreadsheets.jsx";
import Schemas from "./components/schemas/schemas.jsx";
import Inbox from "./components/requests/inbox.jsx";
import Projects from "./components/projects/projects.jsx";
import Profile from "./components/profile/profile.jsx";
import Notifications from "./components/notifications/notifications.jsx";
import FlowDesigner from "./components/FlowDesigner/FlowDesigner.jsx";
import StatusCatalog from "./components/statusCatalog/statusCatalog.jsx";
import Documents from "./components/documents/documents.jsx";
import Retention from "./components/documents/retention.jsx";
import SharedFolder from "./components/documents/sharedFolder.jsx";
import PublicForm from "./components/publicForm/publicForm.jsx";
import MyTasks from "./components/tasks/myTasks.jsx";
import Unassigned from "./components/tasks/unassigned.jsx";
import Team from "./components/tasks/team.jsx";
import Overview from "./components/tasks/overview.jsx";
import Calendar from "./components/calendar/calendar.jsx";
import VehicleBookings from "./components/vehicles/vehicleBookings.jsx";
import Timeline from "./components/timeline/timeline.jsx";
import OrgChart from "./components/orgChart/orgChart.jsx";
import Billing from "./components/billing/billing.jsx";
import FinanceQuotes from "./components/finance/financeQuotes.jsx";
import FinanceProviders from "./components/finance/financeProviders.jsx";
import ContractTypes from "./components/contractTypes/contractTypes.jsx";
import Absences from "./components/absences/absences.jsx";
import AbsenceTypes from "./components/absences/absenceTypes.jsx";
import PrintOrders from "./components/print/printOrders.jsx";
import Pantones from "./components/print/pantones.jsx";
import PhotoGroups from "./components/photos/photoGroups.jsx";
import PhotoScan from "./components/photos/photoScan.jsx";
import PhotoPackages from "./components/photos/photoPackages.jsx";
import PhotoRetention from "./components/photos/photoRetention.jsx";
import PublicPhoto from "./components/publicPhoto/publicPhoto.jsx";

import * as api from "./api/client.js";
import { FORM_PARAM, MICROSOFT_PARAM, PHOTO_PARAM, SHARED_PARAM } from "./config.js";
import "./App.css";

/** El token de un enlace de solo lectura, si la página se abrió con uno. */
const TOKEN_COMPARTIDO = new URLSearchParams(window.location.search).get(SHARED_PARAM);

/** El token de un formulario público, si la página se abrió con uno. */
const TOKEN_FORMULARIO = new URLSearchParams(window.location.search).get(FORM_PARAM);

/** El código de un folio de fotografía ("" si la liga no trae uno), o null si no es el portal. */
const CODIGO_FOTO = new URLSearchParams(window.location.search).get(PHOTO_PARAM);

/** La última pestaña abierta en este navegador, para volver a ella al recargar. */
function leerPestana() {
  try {
    return localStorage.getItem("pestana");
  } catch {
    return null;
  }
}

/** Los subsistemas del interruptor del encabezado, en su orden. Uno nuevo es una entrada más. */
const MODOS = [
  { clave: "coordinacion", nombre: "Coordinación", icono: MdBusiness },
  { clave: "fotografia", nombre: "Fotografía", icono: MdPhotoCamera },
];

/** El último modo abierto en este navegador: "coordinacion" o "fotografia". */
function leerModo() {
  try {
    return localStorage.getItem("modo") === "fotografia" ? "fotografia" : "coordinacion";
  } catch {
    return "coordinacion";
  }
}

/** El menú usa nombres de rol en español y el servidor los manda en inglés. */
const ROLES = {
  admin: "admin",
  area_lead: "lider",
  finance: "finanzas",
  worker: "trabajador",
};

/**
 * El cambio de foto como actualizador de estado: libera el object URL anterior y crea el
 * del Blob nuevo, o deja null para quitarla.
 */
function reemplazarFoto(blob) {
  return (anterior) => {
    if (anterior) URL.revokeObjectURL(anterior);
    return blob ? URL.createObjectURL(blob) : null;
  };
}

/**
 * Los enlaces que no piden sesión. ?shared= abre una carpeta de solo lectura y ?form= un
 * formulario público. ?photo= abre el portal de un folio de fotografía.
 */
function App() {
  if (TOKEN_COMPARTIDO) return <SharedFolder token={TOKEN_COMPARTIDO} />;
  if (TOKEN_FORMULARIO) return <PublicForm token={TOKEN_FORMULARIO} />;
  if (CODIGO_FOTO !== null) return <PublicPhoto initialCode={CODIGO_FOTO} />;
  return <Aplicacion />;
}

function Aplicacion() {
  const [usuario, setUsuario] = useState(null);
  const [permisos, setPermisos] = useState([]);
  const [permisosListos, setPermisosListos] = useState(false);

  const [refrescoNotificaciones, setRefrescoNotificaciones] = useState(0);

  function actualizarContadorNotificaciones() {
    setRefrescoNotificaciones((actual) => actual + 1);
  }

  const [pestana, setPestana] = useState(() =>
    new URLSearchParams(window.location.search).has(MICROSOFT_PARAM)
      ? "Libros de Excel"
      : leerPestana(),
  );

  useEffect(() => {
    if (!pestana) return;
    try {
      localStorage.setItem("pestana", pestana);
    } catch {
      return;
    }
  }, [pestana]);
  const [modo, setModo] = useState(leerModo);

  useEffect(() => {
    try {
      localStorage.setItem("modo", modo);
    } catch {
      return;
    }
  }, [modo]);

  const [proyectoPorAbrir, setProyectoPorAbrir] = useState(null);
  
  const [pestanaProyectoPorAbrir, setPestanaProyectoPorAbrir] =
  useState("stages");
  
  const [areaPorAbrir, setAreaPorAbrir] = useState(null);

  const [etapaPorAbrir, setEtapaPorAbrir] = useState(null);

  const [modoOscuro, setModoOscuro] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      return savedTheme === "dark";
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  useEffect(() => {
    const root = window.document.documentElement;
    if (modoOscuro) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [modoOscuro]);

  const [foto, setFoto] = useState(null);

  const [verificando, setVerificando] = useState(() => Boolean(api.getToken()));
  const [sinConexion, setSinConexion] = useState(false);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!api.getToken()) return;

    api
      .session()
      .then((data) => setUsuario(data.user))
      .catch((err) => {
        if (err.status === 0 || err.status >= 500) setSinConexion(true);
        else api.clearToken();
      })
      .finally(() => setVerificando(false));
  }, [intento]);

  /** Vuelve a pedir la sesión; sin servidor el token se conserva, porque sigue siendo bueno. */
  function reintentar() {
    setSinConexion(false);
    setVerificando(true);
    setIntento(intento + 1);
  }

  const usuarioId = usuario?.id ?? null;

  useEffect(() => {
    if (usuarioId === null) return;

    let cancelado = false;

    api
      .session()
      .then((data) => {
        if (!cancelado) setPermisos(data.permissions ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelado) setPermisosListos(true);
      });

    api
      .getPicture(usuarioId)
      .then((blob) => {
        if (!cancelado) setFoto(reemplazarFoto(blob));
      })
      .catch(() => {});

    return () => {
      cancelado = true;
    };
  }, [usuarioId]);

  function cambiarFoto(blob) {
    setFoto(reemplazarFoto(blob));
  }

  function actualizarUsuario(datos) {
    setUsuario({ ...usuario, fullName: datos.fullName, email: datos.email });
  }

  function cerrarSesion() {
    api.clearToken();
    cambiarFoto(null);
    setUsuario(null);
    setPermisos([]);
    setPermisosListos(false);
    setPestana(null);
    try {
      localStorage.removeItem("pestana");
    } catch {
      return;
    }
  }

  if (verificando) return <p className="app-booting">Cargando...</p>;
  if (sinConexion) {
    return (
      <div className="app-booting" role="alert">
        <p>No se pudo conectar con el servidor.</p>
        <button type="button" onClick={reintentar}>
          Reintentar
        </button>
      </div>
    );
  }
  if (!usuario) return <Login onEntrar={setUsuario} />;

  const rol = ROLES[usuario.role] ?? "trabajador";
  const modos = modesFor(rol, permisos);
  const enFotos = permisosListos ? modos.photo && (modo === "fotografia" || !modos.coordination) : modo === "fotografia";
  const delModo = pestana === "Mi perfil" || isPhotoTab(pestana) === enFotos;
  const activa =
    pestana && delModo && descripciones[pestana] && (!permisosListos || canSee(pestana, rol, permisos))
      ? pestana
      : enFotos
        ? "Grupos"
        : !permisosListos || canSee("Mis tareas", rol, permisos)
          ? "Mis tareas"
          : "Notificaciones";

  /** Cambia entre Coordinación y Fotografía, abriendo la primera pestaña del modo. */
  function cambiarModo(nuevo) {
    setModo(nuevo);
    setPestana(nuevo === "fotografia" ? "Grupos" : null);
  }

  const puedeAbrirProyectos = canSee("Proyectos", rol, permisos);

  /** Lleva a «Proyectos» con ese proyecto ya abierto, desde una tarea o una etapa, y elige `etapaId` si viene. */
  function abrirProyecto(id, initialTab = "stages", etapaId = null) {
    setProyectoPorAbrir(id);
    setPestanaProyectoPorAbrir(initialTab);
    setEtapaPorAbrir(etapaId);
    setPestana("Proyectos");
  }

  /** Lleva a «Por asignar» o a «Equipo» con esa área ya elegida, desde el panorama. */
  function abrirEnArea(nombre, areaId) {
    setAreaPorAbrir(areaId);
    setPestana(nombre);
  }

  /** Cambia el tema con un fundido de toda la página, para que nada cambie de golpe. */
  function cambiarTema() {
    const cambiar = () => flushSync(() => setModoOscuro((actual) => !actual));
    if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) cambiar();
    else document.startViewTransition(cambiar);
  }

  return (
    <div className={`app-container ${modoOscuro ? "dark-mode" : "light-mode"}`}>
      <Sidebar
        usuario={usuario}
        foto={foto}
        role={rol}
        permisos={permisos}
        activeItem={activa}
        onNavigate={(nombre) => {
          setProyectoPorAbrir(null);
          setAreaPorAbrir(null);
          setEtapaPorAbrir(null);
          setPestana(nombre);
        }}
        onLogout={cerrarSesion}
        refrescoNotificaciones={refrescoNotificaciones}
        secciones={enFotos ? photoSections : menuSections}
      />

      <main className="main-content">
        <header className="main-header">
          <div className="main-header-text">
            <h1 className="main-title">{activa}</h1>
            {descripciones[activa] ? (
              <p className="main-description">{descripciones[activa]}</p>
            ) : null}
          </div>

          <div className="header-actions">
            {modos.photo && modos.coordination ? (
              <div className="mode-switch" role="group" aria-label="Sistema">
                {MODOS.map((opcion) => {
                  const Icono = opcion.icono;
                  const activo = opcion.clave === (enFotos ? "fotografia" : "coordinacion");
                  return (
                    <button
                      key={opcion.clave}
                      className={`mode-switch-btn ${activo ? "active" : ""}`}
                      type="button"
                      aria-pressed={activo}
                      onClick={() => cambiarModo(opcion.clave)}
                    >
                      <Icono className="mode-switch-icon" aria-hidden="true" />
                      <span>{opcion.nombre}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            <button
              className="theme-toggle"
              type="button"
              onClick={cambiarTema}
              aria-label={
                modoOscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"
              }
            >
              <span className="theme-icon">
                {modoOscuro ? <MdDarkMode /> : <MdLightMode />}
              </span>
            </button>
          </div>
        </header>

        {!permisosListos || !canSee(activa, rol, permisos) ? null : activa === "Organigrama" ? (
          <OrgChart />
        ) : activa === "Notificaciones" ? (
          <Notifications
            onUnreadChange={actualizarContadorNotificaciones}
            onOpenProject={puedeAbrirProyectos ? abrirProyecto : null}
            onOpenTab={setPestana}
          />
        ) : activa === "Mi perfil" ? (
          <Profile
            usuario={usuario}
            foto={foto}
            onActualizar={actualizarUsuario}
            onFoto={cambiarFoto}
          />
        ) : activa === "Empleados" ? (
          <Users admin={usuario} canChangeRole={permisos.includes("user.role")} />
        ) : activa === "Áreas y usuarios" ? (
          <Areas />
        ) : activa === "Roles y permisos" ? (
          <Roles />
        ) : activa === "Tipos de contrato" ? (
          <ContractTypes />
        ) : activa === "Tipos de ausencia" ? (
          <AbsenceTypes />
        ) : activa === "Ausencias" ? (
          <Absences
            canDetail={usuario.role === "admin" || permisos.includes("absence.read_detail")}
            canApprove={usuario.role === "admin" || permisos.includes("absence.approve")}
            canWrite={usuario.role === "admin" || permisos.includes("absence.write")}
            canRequestOthers={usuario.role === "admin" || permisos.includes("absence.request_others")}
            userId={usuario.id}
          />
        ) : activa === "Órdenes de impresión" ? (
          <PrintOrders
            canWrite={usuario.role === "admin" || permisos.includes("print.write")}
            canCreate={usuario.role === "admin" || permisos.includes("print.create")}
          />
        ) : activa === "Pantones y máquinas" ? (
          <Pantones />
        ) : activa === "Formatos de solicitud" ? (
          <Schemas />
        ) : activa === "Libros de Excel" ? (
          <Spreadsheets onGo={setPestana} canWrite={permisos.includes("spreadsheet.write")} />
        ) : activa === "Bandeja de solicitudes" ? (
          <Inbox
            canWrite={permisos.includes("request.write")}
            canConvert={permisos.includes("request.write") && permisos.includes("project.write")}
          />
        ) : activa === "Proyectos" ? (
          <Projects user={usuario} permissions={permisos} openId={proyectoPorAbrir} initialTab={pestanaProyectoPorAbrir} openStageId={etapaPorAbrir}/>
        ) : activa === "Catálogo de estatus" ? (
          <StatusCatalog />
        ) : activa === "Diseñador de flujos" ? (
          <FlowDesigner />
        ) : activa === "Archivos" ? (
          <Documents canShare={permisos.includes("document.share")} />
        ) : activa === "Retención de archivos" ? (
          <Retention />
        ) : activa === "Mis tareas" ? (
          <MyTasks
            canReview={permisos.includes("task.write")}
            onOpenProject={puedeAbrirProyectos ? abrirProyecto : null}
          />
        ) : activa === "Por asignar" ? (
          <Unassigned
            openAreaId={areaPorAbrir}
            onOpenProject={puedeAbrirProyectos ? abrirProyecto : null}
            onOpenTeam={(areaId) => abrirEnArea("Equipo", areaId)}
          />
        ) : activa === "Equipo" ? (
          <Team openAreaId={areaPorAbrir} onOpenProject={puedeAbrirProyectos ? abrirProyecto : null} />
        ) : activa === "Panorama de áreas" ? (
          <Overview
            onOpenInbox={(areaId) => abrirEnArea("Por asignar", areaId)}
            onOpenProject={puedeAbrirProyectos ? abrirProyecto : null}
          />
        ) : activa === "Cronograma" ? (
          <Timeline isAdmin={usuario.role === "admin"} onOpenProject={puedeAbrirProyectos ? abrirProyecto : null} />
        ) : activa === "Facturación" ? (
          <Billing 
            onOpenRecord={(record) => {
              if(!puedeAbrirProyectos) return;
              if(record.projectId == null) return;
              abrirProyecto(record.projectId, "billing");
            }}
            onOpenProject={puedeAbrirProyectos ? abrirProyecto : null}
          />
        ) : activa === "Cotizaciones" ? (
          <FinanceQuotes onOpenProject={puedeAbrirProyectos ? abrirProyecto : null} />
        ) : activa === "Proveedores" ? (
          <FinanceProviders
            canCreate={permisos.includes("finance.write") || permisos.includes("project.write")}
            canManage={permisos.includes("finance.write")}
          />
        ) : activa === "Vehículos" ? (
          <VehicleBookings
            isAdmin={usuario.role === "admin"}
            userId={usuario.id}
            canBook={usuario.role === "admin" || permisos.includes("vehicle.book")}
            canManage={usuario.role === "admin" || permisos.includes("vehicle.manage")}
          />
        ) : activa === "Grupos" ? (
          <PhotoGroups canManage={permisos.includes("photo.manage")} />
        ) : activa === "Escanear folio" ? (
          <PhotoScan canManage={permisos.includes("photo.manage")} />
        ) : activa === "Catálogo de precios" ? (
          <PhotoPackages />
        ) : activa === "Conservación de fotos" ? (
          <PhotoRetention />
        ) : activa === "Calendario" ? (
          <Calendar
            isAdmin={usuario.role === "admin"}
            canWrite={permisos.includes("calendar.write")}
            onOpenProject={puedeAbrirProyectos ? abrirProyecto : null}
          />
        ) : null}
      </main>
    </div>
  );
}

export default App;
