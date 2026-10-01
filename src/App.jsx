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

import * as api from "./api/client.js";
import { MICROSOFT_PARAM } from "./config.js";
import "./App.css";

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
      ? "Formatos de solicitud"
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
          <button
            className="main-user"
            type="button"
            onClick={() => setPestana("Mi perfil")}
          >
            {usuario.fullName}
          </button>

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

            <button
              className="main-logout"
              type="button"
              onClick={cerrarSesion}
            >
              Cerrar sesión
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
          <Spreadsheets />
        ) : activa === "Esquemas de datos" && usuario.role === "admin" ? (
          <Schemas />
        ) : activa === "Configuración de formatos de solicitud" && usuario.role === "admin" ? (
          <ImportConfig />
        ) : activa === "Bandeja de solicitudes" && usuario.role === "admin" ? (
          <Inbox />
        ) : activa === "Proyectos" && usuario.role === "admin" ? (
          <Projects usuario={usuario} />
        ) : activa === "Diseñador de flujos" && usuario.role === "admin" ? (
          <FlowDesigner />
        ) : (
          <h1>{activa}</h1>
        )}
      </main>
    </div>
  );
}

export default App;
