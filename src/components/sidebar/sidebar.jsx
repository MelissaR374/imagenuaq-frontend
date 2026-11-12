import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import * as api from "../../api/client.js";
import { API_URL } from "../../config.js";
import "./sidebar.css";
import { menuSections, itemVisible, leerOrden, ordenar } from "./menu.js";
import { MdLogout, MdMenu } from "react-icons/md";

/**
 * `foto` es el object URL de la foto de perfil, o null para mostrar las iniciales. Qué elementos
 * se ven lo decide `itemVisible` con el `role` y los `permisos` de la sesión.
 */
function Sidebar({ usuario, foto = null, role = "admin", permisos = [], activeItem = "Proyectos", onNavigate, onLogout, refrescoNotificaciones = 0}) {
  
  const [isClosed, setIsClosed] = useState(false);
  const [sinLeer, setSinLeer] = useState(0);
  const [orden, setOrden] = useState(leerOrden);
  const [arrastrando, setArrastrando] = useState(null);

  /** Mueve la pestaña en `desde` a `hacia` dentro de `visibles` (una sección) y guarda el orden. */
  function mover(visibles, desde, hacia) {
    if (desde < 0 || hacia < 0 || hacia >= visibles.length || desde === hacia) return;
    const etiquetas = visibles.map((item) => item.label);
    const [movida] = etiquetas.splice(desde, 1);
    etiquetas.splice(hacia, 0, movida);
    const nuevo = [...orden.filter((label) => !etiquetas.includes(label)), ...etiquetas];
    setOrden(nuevo);
    try {
      localStorage.setItem("menuOrden", JSON.stringify(nuevo));
    } catch {
      return;
    }
  }

  useEffect(() => {
    let cancelado = false;

    async function actualizarContador() {
      try {
        const respuesta = await api.countUnreadNotifications();

        if (!cancelado) {
          setSinLeer(respuesta.unreadCount ?? 0);
        }
      } catch (error) {
        console.error("No se pudo consultar el contador:", error);
      }
    }

    actualizarContador();

    return () => {
      cancelado = true;
    };
  }, [usuario.id, refrescoNotificaciones]);

  useEffect(() => {
    const token = api.getToken();
    if (!token) return;

    let activo = true;

    const socketUrl = new URL(
      API_URL,
      window.location.origin
    ).origin;

    const socket = io(socketUrl, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
    });

    async function actualizarContador() {
      try {
        const respuesta = await api.countUnreadNotifications();

        if (activo) {
          setSinLeer(respuesta.unreadCount ?? 0);
        }
      } catch (error) {
        console.error("No se pudo actualizar el contador:", error);
      }
    }

    socket.on("notification:new", actualizarContador);
    socket.on("connect", actualizarContador);

    return () => {
      activo = false;
      socket.disconnect();
    };
  }, [usuario.id]);

  return (
    <aside className={`sidebar ${isClosed ? "closed" : ""}`}>
      <div className="sidebar-brand">
        <div className="brand-icon">
          <span></span>
        </div>

        <span className="brand-name">IMAGEN UAQ</span>
        <button className = "sidebar-toggle"
        onClick = {() => setIsClosed(!isClosed)}>
          {isClosed ? <MdMenu /> : <MdMenu />}
        </button>
      </div>
      

      <nav className="sidebar-menu">
        {menuSections.map((section, sectionIndex) => {
          const visibleItems = ordenar(
            section.items.filter((item) => itemVisible(item, role, permisos)),
            orden,
          );
          const etiquetas = visibleItems.map((item) => item.label);

          if (visibleItems.length === 0) {
            return null;
          }

          return (
            <div className="sidebar-section" key={sectionIndex}>
              {section.title && (
                <p className="sidebar-section-title">{section.title}</p>
              )}

              <div className="sidebar-section-items">
                {visibleItems.map((item, indice) => {
                  const Icon = item.icon;

                  const isActive = activeItem === item.label;

                  return (
                    <button
                      key={item.label}
                      className={`sidebar-item ${isActive ? "active" : ""} ${arrastrando === item.label ? "dragging" : ""}`}
                      title="Arrastra para reordenar (o Alt + ↑/↓)"
                      draggable
                      onDragStart={() => setArrastrando(item.label)}
                      onDragEnd={() => setArrastrando(null)}
                      onDragOver={(e) => {
                        if (etiquetas.includes(arrastrando)) e.preventDefault();
                      }}
                      onDrop={() => mover(visibleItems, etiquetas.indexOf(arrastrando), indice)}
                      onKeyDown={(e) => {
                        if (!e.altKey) return;
                        if (e.key === "ArrowUp") mover(visibleItems, indice, indice - 1);
                        if (e.key === "ArrowDown") mover(visibleItems, indice, indice + 1);
                      }}
                      onClick={() => onNavigate && onNavigate(item.label)}
                    >
                      <Icon className="sidebar-item-icon" />

                      <span className="sidebar-item-label">{item.label}</span>

                      {item.label === "Notificaciones" && sinLeer > 0 && (
                        <span
                          className="notification-badge"
                          aria-label={`${sinLeer} notificaciones sin leer`}
                        >
                          {sinLeer > 99 ? "99+" : sinLeer}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className={`sidebar-user ${activeItem === "Mi perfil" ? "active" : ""}`}>
        <button
          className="user-profile"
          type="button"
          title="Mi perfil"
          onClick={() => onNavigate && onNavigate("Mi perfil")}
        >
          <div className="user-avatar">
            {foto ? (
              <img className="user-avatar-image" src={foto} alt="" />
            ) : (
              usuario.fullName ?.trim().split(" ").slice(0, 2).map((parte) => parte[0]).join("").toUpperCase()
            )}
          </div>

          <div className="user-info">
            <span className="user-name" title= {usuario.fullName} >{usuario.fullName}</span>

            <span className="user-role">{usuario.role}</span>
          </div>
        </button>

        <MdLogout className="logout-icon" onClick={onLogout}
        title="Cerrar Sesión"/>
      </div>
    </aside>
  );
}

export default Sidebar;
