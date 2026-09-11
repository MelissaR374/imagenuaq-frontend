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
import * as api from "./api/client.js";
import "./App.css";

// El menú usa nombres de rol en español y el servidor los manda en inglés.
const ROLES = {
  admin: "admin",
  area_lead: "lider",
  finance: "finanzas",
  worker: "trabajador",
};

function App() {
  // Quién entró; null mientras nadie lo haya hecho.
  const [usuario, setUsuario] = useState(null);
  const [pestana, setPestana] = useState(null);

  //MODO OSCURO Y CLARO
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

  // Si no hay token guardado no hay nada que verificar y se entra directo al login.
  const [verificando, setVerificando] = useState(() => Boolean(api.getToken()));

  useEffect(() => {
    if (!api.getToken()) return;

    api
      .session()
      .then((data) => setUsuario(data.user))
      .catch(() => api.clearToken())
      .finally(() => setVerificando(false));
  }, []);

  function cerrarSesion() {
    api.clearToken();
    setUsuario(null);
    setPestana(null);
  }

  if (verificando) return <p className="app-booting">Cargando...</p>;
  if (!usuario) return <Login onEntrar={setUsuario} />;

  // Pestaña de inicio según el rol, hasta que la persona elija otra.
  const activa =
    pestana ?? (usuario.role === "admin" ? "Empleados" : "Notificaciones");

  function cambiarTema() {
    setModoOscuro((actual) => !actual);
  }

  return (
    <div className={`app-container ${modoOscuro ? "dark-mode" : "light-mode"}`}>
      <Sidebar
        usuario={usuario}
        role={ROLES[usuario.role] ?? "trabajador"}
        activeItem={activa}
        onNavigate={setPestana}
        onLogout={cerrarSesion}
      />

      <main className="main-content">
        <header className="main-header">
          <span className="main-user">{usuario.fullName}</span>

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

        {/* Por ahora solo "Empleados" y "Áreas y usuarios" tienen pantalla, y las dos son
            de administración; las demás muestran su nombre. */}
        {activa === "Empleados" && usuario.role === "admin" ? (
          <Users admin={usuario} />
        ) : activa === "Áreas y usuarios" && usuario.role === "admin" ? (
          <Areas />
        ) : (
          <h1>{activa}</h1>
        )}
      </main>
    </div>
  );
}

export default App;
