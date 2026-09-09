// Decide si se ve la pantalla de entrada o la aplicación, y qué pestaña está abierta.
//
// La sesión se recupera preguntándole al servidor con GET /api/auth/me, no leyendo el
// token: el token sigue pareciendo válido durante siete días aunque la cuenta ya no exista.
import { useEffect, useState } from "react";

import Login from "./components/login/login.jsx";
import Sidebar from "./components/sidebar/sidebar.jsx";
import Users from "./components/users/users.jsx";
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
  const activa = pestana ?? (usuario.role === "admin" ? "Personal" : "Notificaciones");

  return (
    <div className="app-container">
      <Sidebar
        role={ROLES[usuario.role] ?? "trabajador"}
        activeItem={activa}
        onNavigate={setPestana}
      />

      <main className="main-content">
        <header className="main-header">
          <span className="main-user">{usuario.fullName}</span>

          <button className="main-logout" type="button" onClick={cerrarSesion}>
            Cerrar sesión
          </button>
        </header>

        {/* Por ahora solo "Personal" tiene pantalla; las demás muestran su nombre. */}
        {activa === "Personal" && usuario.role === "admin" ? (
          <Users admin={usuario} />
        ) : (
          <h1>{activa}</h1>
        )}
      </main>
    </div>
  );
}

export default App;
