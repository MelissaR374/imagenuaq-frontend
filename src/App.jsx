// Decide si se ve la pantalla de entrada o la aplicación, y qué pestaña está abierta.
//
// La sesión se recupera preguntándole al servidor con GET /api/auth/me, no leyendo el
// token: el token sigue pareciendo válido durante siete días aunque la cuenta ya no exista.
// Un enlace de solo lectura (?shared=) muestra su carpeta sin pedir sesión.
import { useEffect, useState } from "react";
import { MdLightMode, MdDarkMode } from "react-icons/md";

import Login from "./components/login/login.jsx";
import Sidebar from "./components/sidebar/sidebar.jsx";
import { canSee } from "./components/sidebar/menu.js";
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
import MyTasks from "./components/tasks/myTasks.jsx";
import Unassigned from "./components/tasks/unassigned.jsx";
import Team from "./components/tasks/team.jsx";
import Overview from "./components/tasks/overview.jsx";
import Calendar from "./components/calendar/calendar.jsx";
import Timeline from "./components/timeline/timeline.jsx";
import OrgChart from "./components/orgChart/orgChart.jsx";
import Billing from "./components/billing/billing.jsx";
import FinanceQuotes from "./components/finance/financeQuotes.jsx";
import FinanceInvoices from "./components/finance/financeInvoices.jsx";
import ContractTypes from "./components/contractTypes/contractTypes.jsx";
import Absences from "./components/absences/absences.jsx";
import AbsenceTypes from "./components/absences/absenceTypes.jsx";


import * as api from "./api/client.js";
import { MICROSOFT_PARAM, SHARED_PARAM } from "./config.js";
import "./App.css";

/**
 * Lo que es cada vista, en una frase declarativa: el encabezado nombra la pantalla y la
 * sitúa en el proceso, sin instrucciones ni controles.
 */
const DESCRIPCIONES = {
  Organigrama: "Las áreas de la coordinación y quién está en cada una.",
  Notificaciones: "Lo que pasó en tus solicitudes, proyectos y etapas.",
  "Mi perfil": "Tus datos de cuenta y tu foto.",
  Empleados: "Las personas registradas y el rol de cada una.",
  "Áreas y usuarios":
    "El organigrama de la coordinación y quién está en cada área.",
  "Roles y permisos": "Lo que puede hacer cada rol.",
  "Tipos de contrato": "Configura los tipos de contrato y los beneficios que se asignan a los empleados.",
  Ausencias: "Las ausencias del personal: permisos, incapacidades y días institucionales, con su estado de aprobación.",
  "Tipos de ausencia": "El catálogo de tipos de ausencia y sus reglas: si consumen saldo, si requieren documento.",
  "Formatos de solicitud":
    "Los formatos de captura de datos para generar un proyecto.",
  "Libros de Excel":
    "Tus libros de Excel: conéctalos, indica qué columna es cada dato e importa las filas nuevas.",
  "Bandeja de solicitudes":
    "Solicitudes recibidas que todavía no son proyecto.",
  Proyectos: "Los proyectos y el avance de sus etapas.",
  "Catálogo de estatus":
    "Los estatus con que se muestran solicitudes y proyectos, globales y por área.",
  "Diseñador de flujos":
    "Plantillas para definir como se va a tratar un proyecto, para agilizar la asignación de tareas",
  Archivos: "Todas las carpetas de cada proyecto.",
  "Retención de archivos": "Cuánto tiempo se conservan los archivos.",
  "Mis tareas": "Las etapas de desarrollo de un proyecto a tu cargo",
  "Por asignar": "Las etapas de tu área que todavía no tienen responsable",
  Equipo: "Las etapas abiertas de cada persona del área y quién falta esta semana.",
  "Panorama de áreas": "Lo que cada área tiene por asignar y la carga de su gente esta semana.",
  Calendario: "Las etapas, ausencias y fechas institucionales del mes, y las ventanas de cierre de semestre.",
  Cronograma: "Qué tan ocupada está cada área día por día, contando a quién le falta gente.",
  Facturación: "Consulta los proyectos y da seguimiento a los documentos importantes",
  Facturas: "Las facturas de todos los proyectos y su estado de trámite.",
  Cotizaciones: "Las cotizaciones pendientes de revisión y su decisión.",
};

/** El token de un enlace de solo lectura, si la página se abrió con uno. */
const TOKEN_COMPARTIDO = new URLSearchParams(window.location.search).get(SHARED_PARAM);

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

function App() {
  if (TOKEN_COMPARTIDO) return <SharedFolder token={TOKEN_COMPARTIDO} />;
  return <Aplicacion />;
}

function Aplicacion() {
  const [usuario, setUsuario] = useState(null);
  const [permisos, setPermisos] = useState([]);

  const [refrescoNotificaciones, setRefrescoNotificaciones] = useState(0);

  function actualizarContadorNotificaciones() {
    setRefrescoNotificaciones((actual) => actual + 1);
  }

  const [pestana, setPestana] = useState(() =>
    new URLSearchParams(window.location.search).has(MICROSOFT_PARAM)
      ? "Libros de Excel"
      : null,
  );
  const [proyectoPorAbrir, setProyectoPorAbrir] = useState(null);
  
  const [pestanaProyectoPorAbrir, setPestanaProyectoPorAbrir] =
  useState("stages");
  
  const [areaPorAbrir, setAreaPorAbrir] = useState(null);

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

  useEffect(() => {
    if (!api.getToken()) return;

    api
      .session()
      .then((data) => setUsuario(data.user))
      .catch(() => api.clearToken())
      .finally(() => setVerificando(false));
  }, []);

  const usuarioId = usuario?.id ?? null;

  useEffect(() => {
    if (usuarioId === null) return;

    let cancelado = false;

    api
      .session()
      .then((data) => {
        if (!cancelado) setPermisos(data.permissions ?? []);
      })
      .catch(() => {});

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
    setPestana(null);
  }

  if (verificando) return <p className="app-booting">Cargando...</p>;
  if (!usuario) return <Login onEntrar={setUsuario} />;

  const rol = ROLES[usuario.role] ?? "trabajador";
  const activa =
    pestana ?? (usuario.role === "admin" ? "Empleados" : "Notificaciones");

  const puedeAbrirProyectos = canSee("Proyectos", rol, permisos);

  /** Lleva a «Proyectos» con ese proyecto ya abierto, desde una tarea o una etapa. */
  function abrirProyecto(id, initialTab = "stages") {
    setProyectoPorAbrir(id);
    setPestanaProyectoPorAbrir(initialTab);
    setPestana("Proyectos");
  }

  /** Lleva a «Por asignar» o a «Equipo» con esa área ya elegida, desde el panorama. */
  function abrirEnArea(nombre, areaId) {
    setAreaPorAbrir(areaId);
    setPestana(nombre);
  }

  function cambiarTema() {
    setModoOscuro((actual) => !actual);
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
          setPestana(nombre);
        }}
        onLogout={cerrarSesion}
        refrescoNotificaciones={refrescoNotificaciones}
      />

      <main className="main-content">
        <header className="main-header">
          <div className="main-header-text">
            <h1 className="main-title">{activa}</h1>
            {DESCRIPCIONES[activa] ? (
              <p className="main-description">{DESCRIPCIONES[activa]}</p>
            ) : null}
          </div>

          <div className="header-actions">
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

        {!canSee(activa, rol, permisos) ? null : activa === "Organigrama" ? (
          <OrgChart />
        ) : activa === "Notificaciones" ? (
          <Notifications onUnreadChange={actualizarContadorNotificaciones} />
        ) : activa === "Mi perfil" ? (
          <Profile
            usuario={usuario}
            foto={foto}
            onActualizar={actualizarUsuario}
            onFoto={cambiarFoto}
          />
        ) : activa === "Empleados" ? (
          <Users admin={usuario} />
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
        ) : activa === "Formatos de solicitud" ? (
          <Schemas />
        ) : activa === "Libros de Excel" ? (
          <Spreadsheets onGo={setPestana} canWrite={permisos.includes("spreadsheet.write")} />
        ) : activa === "Bandeja de solicitudes" ? (
          <Inbox />
        ) : activa === "Proyectos" ? (
          <Projects user={usuario} permissions={permisos} openId={proyectoPorAbrir} initialTab={pestanaProyectoPorAbrir}/>
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
          />
        ) : activa === "Facturas" ? (
          <FinanceInvoices onOpenProject={puedeAbrirProyectos ? abrirProyecto : null} />
        ) : activa === "Cotizaciones" ? (
          <FinanceQuotes onOpenProject={puedeAbrirProyectos ? abrirProyecto : null} />
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
