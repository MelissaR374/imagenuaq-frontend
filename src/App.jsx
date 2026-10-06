// Decide si se ve la pantalla de entrada o la aplicación, y qué pestaña está abierta.
//
// La sesión se recupera preguntándole al servidor con GET /api/auth/me, no leyendo el
// token: el token sigue pareciendo válido durante siete días aunque la cuenta ya no exista.
import { useEffect, useState } from "react";
import { MdLightMode, MdDarkMode } from "react-icons/md";

import Login from "./components/login/login.jsx";
import Sidebar from "./components/sidebar/sidebar.jsx";
import Users from "./components/users/users.jsx";
import Areas from "./components/areas/areas.jsx";
import Roles from "./components/roles/roles.jsx";
import Spreadsheets from "./components/spreadsheets/spreadsheets.jsx";
import Schemas from "./components/schemas/schemas.jsx";
import ImportConfig from "./components/spreadsheets/importConfig.jsx";
import Inbox from "./components/requests/inbox.jsx";
import Projects from "./components/projects/projects.jsx";
import Profile from "./components/profile/profile.jsx";
import Notifications from "./components/notifications/notifications.jsx";
import FlowDesigner from "./components/FlowDesigner/FlowDesigner.jsx";
import StatusCatalog from "./components/projects/statusCatalog.jsx";

import * as api from "./api/client.js";
import { MICROSOFT_PARAM } from "./config.js";
import "./App.css";

/**
 * Lo que es cada vista, en una frase declarativa: el encabezado nombra la pantalla y la
 * sitúa en el proceso, sin instrucciones ni controles.
 */
const DESCRIPCIONES = {
  Notificaciones: "Lo que pasó en tus solicitudes, proyectos y etapas.",
  "Mi perfil": "Tus datos de cuenta y tu foto.",
  Empleados: "Las personas registradas y el rol de cada una.",
  "Áreas y usuarios":
    "El organigrama de la coordinación y quién está en cada área.",
  "Roles y permisos": "Lo que puede hacer cada rol.",
  "Formatos de solicitud":
    "Los formatos con que se capturan las solicitudes y sus versiones.",
  "Libros de Excel": "Los libros de Excel registrados y la conexión con Microsoft.",
  "Importar de Excel":
    "El mapeo de cada libro de Excel y la importación de sus filas.",
  "Bandeja de solicitudes":
    "Solicitudes recibidas que todavía no son proyecto.",
  Proyectos: "Los proyectos y el avance de sus etapas.",
  "Catálogo de estatus":
    "Los estatus con que se muestran solicitudes y proyectos, globales y por área.",
  "Diseñador de flujos":
    "Las plantillas de flujo: sus fases y las etapas de cada una.",
};

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
  const [usuario, setUsuario] = useState(null);
  const [pestana, setPestana] = useState(() =>
    new URLSearchParams(window.location.search).has(MICROSOFT_PARAM)
      ? "Libros de Excel"
      : null,
  );

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

  const activa =
    pestana ?? (usuario.role === "admin" ? "Empleados" : "Notificaciones");

  function cambiarTema() {
    setModoOscuro((actual) => !actual);
  }

  return (
    <div className={`app-container ${modoOscuro ? "dark-mode" : "light-mode"}`}>
      <Sidebar
        usuario={usuario}
        foto={foto}
        role={ROLES[usuario.role] ?? "trabajador"}
        activeItem={activa}
        onNavigate={setPestana}
        onLogout={cerrarSesion}
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

        {activa === "Notificaciones" ? (
          <Notifications />
        ) : activa === "Mi perfil" ? (
          <Profile
            usuario={usuario}
            foto={foto}
            onActualizar={actualizarUsuario}
            onFoto={cambiarFoto}
          />
        ) : activa === "Empleados" && usuario.role === "admin" ? (
          <Users admin={usuario} />
        ) : activa === "Áreas y usuarios" && usuario.role === "admin" ? (
          <Areas />
        ) : activa === "Roles y permisos" && usuario.role === "admin" ? (
          <Roles />
        ) : activa === "Formatos de solicitud" && usuario.role === "admin" ? (
          <Schemas />
        ) : activa === "Libros de Excel" && usuario.role === "admin" ? (
          <Spreadsheets />
        ) : activa === "Importar de Excel" && usuario.role === "admin" ? (
          <ImportConfig />
        ) : activa === "Bandeja de solicitudes" && usuario.role === "admin" ? (
          <Inbox />
        ) : activa === "Proyectos" && usuario.role === "admin" ? (
          <Projects usuario={usuario} />
        ) : activa === "Catálogo de estatus" && usuario.role === "admin" ? (
          <StatusCatalog />
        ) : activa === "Diseñador de flujos" && usuario.role === "admin" ? (
          <FlowDesigner />
        ) : null}
      </main>
    </div>
  );
}

export default App;
