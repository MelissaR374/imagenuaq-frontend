/*
 * TIPOS DE NOTIFICACIÓN
 * Estos son los tipos que debe manejar el frontend.
 * La API debería mandar:
 * 
 *   "alerta"
 *   "birthday"
 *   "mensaje"
 *   "proyecto"
 *   "generico"
 *
 * Si llega null, undefined, vacío o un tipo desconocido,
 * se utiliza "generico".
*/
import { useEffect, useMemo, useState } from "react";
import {
  MdSearch,
  MdWarningAmber,
  MdMailOutline,
  MdFolderOpen,
  MdNotificationsNone,
  MdCake,
} from "react-icons/md";

import * as api from "../../api/client.js";
import "./notifications.css";
import { io } from "socket.io-client";
import { API_URL } from "../../config.js";

const TIPOS_NOTIFICACION = {
  alerta: {
    icono: MdWarningAmber,
    clase: "alerta",
    nombre: "Alertas",
  },

  mensaje: {
    icono: MdMailOutline,
    clase: "mensaje",
    nombre: "Mensajes",
  },

  proyecto: {
    icono: MdFolderOpen,
    clase: "proyecto",
    nombre: "Proyectos",
  },

  generico: {
    icono: MdNotificationsNone,
    clase: "generico",
    nombre: "Otros",
  },

  birthday: {
    icono: MdCake,
    clase: "birthday",
    nombre: "Birthdays",
  },
};

//Convierte las propiedades q manda Express al formato q utiliza nuestro componente de React. Así permite que conservemos el diseño existente.
function adaptarNotificacion(notification) {
  return {
    id: notification.id,
    tipo: notification.type ?? notification.category ?? "generico",
    titulo: notification.title,
    descripcion: notification.message,
    fecha: notification.createdAt,
    leida: notification.isRead ?? Boolean(notification.readAt),
  };
}

function obtenerTipoNotificacion(tipo) {
  if (tipo && TIPOS_NOTIFICACION[tipo]) {
    return tipo;
  }

  return "generico";
}

function obtenerGrupoFecha(fecha) {
  const ahora = new Date();
  const fechaNotificacion = new Date(fecha);

  const inicioHoy = new Date(
    ahora.getFullYear(),
    ahora.getMonth(),
    ahora.getDate(),
  );

  const inicioNotificacion = new Date(
    fechaNotificacion.getFullYear(),
    fechaNotificacion.getMonth(),
    fechaNotificacion.getDate(),
  );

  const diferenciaDias =
    Math.floor(
      (inicioHoy - inicioNotificacion) /
        (1000 * 60 * 60 * 24),
    );

  if (diferenciaDias === 0) {
    return "HOY";
  }

  if (diferenciaDias === 1) {
    return "AYER";
  }

  if (diferenciaDias >= 2 && diferenciaDias <= 7) {
    return "ESTA SEMANA";
  }

  return "ANTERIORES";
}

function obtenerTiempoRelativo(fecha){
  const ahora = new Date();
  const fechaNotificacion = new Date(fecha);

  const diferenciaMs = ahora - fechaNotificacion;

  const minutos = Math.floor(
    diferenciaMs / (1000 * 60),
  );

  const horas = Math.floor(minutos / 60);

  const dias = Math.floor(horas / 24);

  if (minutos < 1) {
    return "hace unos segundos";
  }

  if (minutos < 60) {
    return `hace ${minutos} min`;
  }

  if (horas < 24) {
    return `hace ${horas} h`;
  }

  if (dias === 1) {
    return "hace 1 día";
  }

  return `hace ${dias} días`;
}

//Componente PRINCIPAL
function Notifications({onUnreadChange}){
  const [notificaciones, setNotificaciones] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("todas");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelado = false;
    let socket = null;
    
    async function cargarNotificaciones() {
      try {
        const respuesta = await api.listNotifications();
        if (cancelado) return;

        const recibidas = respuesta?.notifications ?? [];
        
        setNotificaciones((actuales) => {
          const combinadas = new Map();

          recibidas.forEach((notificacion) => {
            combinadas.set(
              String(notificacion.id),
              adaptarNotificacion(notificacion)
            );
          });
          
          actuales.forEach((notificacion) => {
            if(!combinadas.has(String(notificacion.id))){
              combinadas.set(String(notificacion.id), notificacion);
            }
          });

          return Array.from(combinadas.values()).sort(
            (a, b) => new Date(b.fecha) - new Date(a.fecha)
          );
        });

        setError("");
      } catch (err) {
        if (cancelado) return;

        setError(
          err.message ||
            "No se pudieron cargar las notificaciones.",
        );
      } finally {
        if (!cancelado) {
          setCargando(false);
        }
      }
    }

    const token = api.getToken();
    if(token){
      const socketUrl = new URL(
        API_URL,
        window.location.origin
      ).origin;

      socket = io(socketUrl, {
        auth: { token },
        transports: ["websocket"],
        reconnection: true,
      });

      socket.on("notification:new", (notification) => {
        if (cancelado) return;
        const nueva = adaptarNotificacion(notification);

        setNotificaciones((actuales) => {
          if(actuales.some((item) => String(item.id) === String(nueva.id))){
            return actuales;
          }
          
          return [nueva, ...actuales].sort(
            (a,b) => new Date(b.fecha) - new Date(a.fecha)
          );
        });
      });

      socket.on("connect", () =>{
        console.log("✅ Socket.IO conectado y autenticado:", socket.id);
        
        if(!cancelado){
          cargarNotificaciones();
        }
      });

      socket.on("connect_error", (err) => {
        console.error("Error de Socket.IO:", err.message);
      });
    }

    cargarNotificaciones();
    return () => {
      cancelado = true;

      if(socket){
        socket.disconnect();
      }
    };
  }, []);

  //Contadores
  const totalNotificaciones = notificaciones.length;
  const totalSinLeer = notificaciones.filter((notificacion) => !notificacion.leida,).length;
  const totalAlertas = notificaciones.filter(
      (notificacion) =>
      obtenerTipoNotificacion(notificacion.tipo) === "alerta",
  ).length;
  
  const totalMensajes = notificaciones.filter(
      (notificacion) =>
      obtenerTipoNotificacion(notificacion.tipo) === "mensaje",
  ).length;
  
  const totalProyectos = notificaciones.filter(
      (notificacion) =>
      obtenerTipoNotificacion(notificacion.tipo) === "proyecto",
  ).length;
  
  //Filtros y Busqueda
  const notificacionesFiltradas = useMemo(() => {
    return notificaciones.filter((notificacion) => {
      const tipo = obtenerTipoNotificacion(
        notificacion.tipo,
      );

      const limpiarTexto = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      const textoBusqueda = limpiarTexto(busqueda);
      const coincideBusqueda = textoBusqueda === "" || limpiarTexto(notificacion.titulo).includes(textoBusqueda) || limpiarTexto(notificacion.descripcion).includes(textoBusqueda);
      
      let coincideFiltro = true;
      
      if (filtro === "sin_leer") {
        coincideFiltro = !notificacion.leida;
      } else if (
        ["alerta", "mensaje", "proyecto", "generico"].includes(filtro,)
      ){
        coincideFiltro = tipo === filtro;
      }
      return coincideBusqueda && coincideFiltro;
    });
  }, [notificaciones, busqueda, filtro]);
  
  const grupos = [
      "HOY",
      "AYER",
      "ESTA SEMANA",
      "ANTERIORES",
  ];
  

  async function marcarComoLeida(id) {
    const notificacion = notificaciones.find(
      (item) => item.id === id
    );

    if(!notificacion || notificacion.leida) return;

    try{
      await api.markNotificationAsRead(id);

      setNotificaciones((actuales) =>
        actuales.map((item) =>
          item.id === id ? {...item, leida: true} : item
        )
      );

      onUnreadChange?.();

    } catch (err) {
      console.error("No se pudo marcar la notificación como leída", err);
    }
  }
  
  async function marcarTodasComoLeidas() {
    if (totalSinLeer === 0) return;
    try{
      await api.markAllNotificationsAsRead();
      setNotificaciones((actuales) =>
        actuales.map((notificacion) => ({
          ...notificacion,
          leida: true,
        }))
      );

      onUnreadChange?.();
    } catch (err) {
      console.error(
        "No se pudieron marcar todas como leídas:",
        err
      );
    }
  }
  return (
    <section className="notifications-page">
      <div className="notifications-heading">
        <div>
          <span className="notifications-kicker">
            {totalSinLeer} SIN LEER
          </span>
          <h1>¿Que hay de nuevo?</h1>
        </div>
        
        <div className="notifications-actions">
          <div className="notifications-search">
            <MdSearch />
            <input
              type="text"
              placeholder="Buscar en avisos"
              value={busqueda}
              onChange={(event) =>
                setBusqueda(event.target.value)
              }
            />
          </div>
          <button
            type="button"
            className="mark-all-button"
            onClick={marcarTodasComoLeidas}
            disabled={totalSinLeer === 0}
          >
            Marcar todo como leído
          </button>
        </div>
      </div>
      
      <div className="notifications-filters">
        <button 
          type="button" 
          className={filtro === "todas" ? "active" : ""} 
          onClick={() => setFiltro("todas")}
        >
          Todas 
          <span>{totalNotificaciones}</span>
        </button>
        
        <button
          type="button"
          className={
              filtro === "sin_leer" ? "active" : ""
          }
          onClick={() => setFiltro("sin_leer")}
        >
          Sin leer 
          <span>{totalSinLeer}</span>
        </button>

        <button
          type="button"
          className={
              filtro === "alerta" ? "active" : ""
          }
          onClick={() => setFiltro("alerta")}
        >
          Alertas 
          <span>{totalAlertas}</span>
        </button>
        
        <button
          type="button"
          className={
              filtro === "mensaje" ? "active" : ""
          }
          onClick={() => setFiltro("mensaje")}
        >
          Mensajes 
          <span>{totalMensajes}</span>
        </button>
        
        <button
          type="button"
          className={
              filtro === "proyecto" ? "active" : ""
          }
          onClick={() => setFiltro("proyecto")}
        >
          Proyectos 
          <span>{totalProyectos}</span>
        </button>
      </div>
      
      <div className="notifications-list">
        {cargando && (
          <div className="notifications-empty">
            <p>Cargando notificaciones...</p>
          </div>
        )}

        {error && (
          <div className="notifications-empty" role="alert">
            <h3>No se pudieron cargar las notificaciones</h3>
            <p>{error}</p>
          </div>
        )}

        {!cargando && !error && grupos.map((grupo) =>{
          const items = notificacionesFiltradas.filter(
            (notificacion) =>
              obtenerGrupoFecha(notificacion.fecha) === grupo
          );
          
          if(items.length === 0){
            return null;
          }

          return(
            <div className="notification-group" key={grupo}>
              <div className="notification-group-title">
                {grupo}
              </div>
              {items.map((notification)=> {
                const tipo = obtenerTipoNotificacion(
                  notificacion.tipo
                );
                
                const configuracion = TIPOS_NOTIFICACION[tipo];
                const Icono = configuracion.icono;

                return(
                  <article
                    className={`notification-item ${
                      notificacion.leida ? "read" : "unread"
                    }`}
                    key={notificacion.id}
                    onMouseEnter={() =>
                      marcarComoLeida(notificacion.id)
                    }
                  >
                    <div 
                      className={`notificaction-icon ${configuracion.clase}`}
                    >
                      <Icono/>
                    </div>

                    <div className="notification-content">
                      <div className="notification-title-row">
                        <h3>{notificacion.titulo}</h3>

                        {!notificacion.leida &&(
                          <span
                            className="unread-dot"
                            aria-label="Sin leer"  
                          />
                        )}
                      </div>

                      <p>
                        {notificacion.descripcion}
                        <span className="notification-time">
                          {" · "}
                          {obtenerTiempoRelativo(
                            notificacion.fecha
                          )}
                        </span>
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          );
        })}

        {!cargando && !error && notificacionesFiltradas.length === 0 &&(
          <div className="notifications-empty">
            <h3>No hay notificaciones</h3>
            <p>
              No encontramos avisos que coincidan con tu búsqueda.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
export default Notifications;