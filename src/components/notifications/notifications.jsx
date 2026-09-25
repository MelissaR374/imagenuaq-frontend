import { useMemo, useState } from "react";
import {
  MdSearch,
  MdWarningAmber,
  MdMailOutline,
  MdFolderOpen,
  MdNotificationsNone,
  MdCake,
} from "react-icons/md";

import "./notifications.css";

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


/*
 * MOCK DE DATOS (PROVISIONALES)
 *
 * Esta estructura está pensada para tener la misma forma
 * que posteriormente devolverá la API.
 *
 * No guardamos "HOY", "AYER" ni "hace 2 h".
 * Guardamos una fecha real y el frontend calcula esos textos.
*/

const NOTIFICACIONES_INICIALES = [
  {
    id: 1,
    tipo: "alerta",
    titulo: "P-0340 lleva 52 días sin responsable",
    descripcion:
      "Se disparó al superar 30 días en la etapa de Impresión",
    fecha: "2026-09-23T12:00:00",
    leida: false,
  },

  {
    id: 2,
    tipo: "alerta",
    titulo: "P-0361 lleva 34 días esperando el V.B. de la FBA",
    descripcion:
      "Se disparó al tercer recordatorio sin respuesta",
    fecha: "2026-09-23T10:00:00",
    leida: false,
  },

  {
    id: 3,
    tipo: "proyecto",
    titulo: "Diseño gráfico rebasó su capacidad (112%)",
    descripcion:
      "Se disparó al asignar la tercera tarea a Daniel Ibarra",
    fecha: "2026-09-23T09:00:00",
    leida: false,
  },

  {
    id: 4,
    tipo: "alerta",
    titulo: "8 entregas siguen sin factura emitida",
    descripcion:
      "Se disparó al cierre de la quincena",
    fecha: "2026-09-23T08:00:00",
    leida: false,
  },

  {
    id: 5,
    tipo: "mensaje",
    titulo: "Rocío Salas dio V.B. a la propuesta de P-0412",
    descripcion:
      "Ahora espera el V.B. de la Facultad de Ingeniería",
    fecha: "2026-09-22T16:30:00",
    leida: true,
  },

  {
    id: 6,
    tipo: "alerta",
    titulo: "Impresión reportó falta de material en P-0340",
    descripcion:
      "Lona banner 13 oz · faltan 40 m²",
    fecha: "2026-09-22T14:20:00",
    leida: true,
  },

  {
    id: 7,
    tipo: "proyecto",
    titulo:
      'Producción AV propuso un flujo nuevo para "Video institucional"',
    descripcion:
      "Requiere tu revisión antes de publicarse",
    fecha: "2026-09-22T11:00:00",
    leida: true,
  },

  {
    id: 8,
    tipo: "proyecto",
    titulo: "Daniel Ibarra subió 3 entregables a P-0427",
    descripcion:
      "Retícula, jara tipográfica y portada",
    fecha: "2026-09-19T15:00:00",
    leida: true,
  },

  {
    id: 9,
    tipo: "mensaje",
    titulo: "Oficio 118/2026 sin contestar hace 41 días",
    descripcion:
      "Se disparó a los 40 días · requiere firma de dirección",
    fecha: "2026-09-18T10:00:00",
    leida: true,
  },

  {
    id: 10,
    tipo: null,
    titulo: "El cierre de semestre abre en 83 días",
    descripcion:
      "Aviso programado · 14 proyectos deben facturarse antes",
    fecha: "2026-09-17T09:00:00",
    leida: true,
  },

  {
    id: 11,
    tipo: "birthday",
    titulo: "Feliz cumpleaños a José",
    descripcion:
      "Desea un feliz cumpleaños a uno de los integrantes y que siga celebrando",
    fecha: "2026-09-17T09:00:00",
    leida: true,
  },
];


/*
 * Obtiene un tipo válido.
 * Si la API manda:
 * -null
 * -undefined
 * -""
 *  
 * SE UTILIZA EL ICONO "generico".
*/

function obtenerTipoNotificacion(tipo) {
  if (tipo && TIPOS_NOTIFICACION[tipo]) {
    return tipo;
  }

  return "generico";
}


/*
 * Obtiene el grupo visual de una notificación.
 *
 * Ejemplo:
 *
 * 2026-09-23 -> HOY
 * 2026-09-22 -> AYER
 * últimos 7 días -> ESTA SEMANA
 * resto -> ANTERIORES
*/

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

/*
 * Convierte una fecha en algo como:
 *
 * hace 2 h
 * hace 5 h
 * hace 1 día
 * hace 41 días
 *
 * Si es reciente:
 * hace unos minutos
*/

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

function Notifications(){
    /* AHORA TENEMOS datos locales.
    * Cuando se una con el back se puede usar:
    * "api.getNotifications()"
    * sin cambiar el resto de la interfaz.
    */
    const [notificaciones, setNotificaciones] = useState(NOTIFICACIONES_INICIALES,);
    const [busqueda, setBusqueda] = useState("");
    
    /*
    * Filtros:
    * todas
    * sin_leer
    * alerta
    * mensaje
    * proyecto
    * generico
    */
    const [filtro, setFiltro] = useState("todas");
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
    
    /*FILTRADO*/
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
    
    /*AGRUPACIÓN POR FECHA*/
    const grupos = [
        "HOY",
        "AYER",
        "ESTA SEMANA",
        "ANTERIORES",
    ];
    
    function marcarComoLeida(id) {
        setNotificaciones((actuales) => actuales.map((notificacion) => notificacion.id === id? {...notificacion, leida: true,} : notificacion,),);
        
        /*Cuando exista API:
        * await api.markNotificationAsRead(id);
        */
    }
    
    function marcarTodasComoLeidas() {
        setNotificaciones((actuales) =>
        actuales.map((notificacion) => ({
            ...notificacion,
            leida: true,
        })),
        );

        /*Cuando exista API:
        *await api.markAllNotificationsAsRead();
        */
    }
    return (
        <section className="notifications-page">
            <div className="notifications-heading">
                <div>
                    <span className="notifications-kicker">
                        {totalSinLeer} SIN LEER
                    </span>
                    <h1>Notificaciones</h1>
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
                {grupos.map((grupo) => {
                    const items = notificacionesFiltradas.filter((notificacion) => obtenerGrupoFecha(notificacion.fecha) === grupo,);
                    
                    if (items.length === 0) {
                        return null;
                    }
                    return (
                        <div className="notification-group" key={grupo}>
                            <div className="notification-group-title">
                                {grupo}
                            </div>
                            {items.map((notificacion) => {
                                const tipo = obtenerTipoNotificacion(
                                    notificacion.tipo,
                                );
                                
                                const configuracion = TIPOS_NOTIFICACION[tipo];
                                const Icono = configuracion.icono;
                                
                                return (
                                    <article className={`notification-item ${notificacion.leida ? "read" : "unread"}`} key={notificacion.id} onMouseEnter={() => marcarComoLeida(notificacion.id)}>
                                        <div className={`notification-icon ${configuracion.clase}`}>
                                            <Icono />
                                        </div>
                                        <div className="notification-content">
                                            <div className="notification-title-row">
                                                <h3>
                                                    {notificacion.titulo}
                                                </h3>
                                                {!notificacion.leida && (
                                                    <span className="unread-dot" aria-label="Sin leer"/>
                                                )}
                                            </div>
                                            
                                            <p>
                                                {notificacion.descripcion}
                                                <span className="notification-time">
                                                    {" · "}
                                                    {obtenerTiempoRelativo(
                                                        notificacion.fecha,
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
                
                {notificacionesFiltradas.length === 0 && (
                    <div className="notifications-empty">
                        <h3>
                            No hay notificaciones
                        </h3>
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