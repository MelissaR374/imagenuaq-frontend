import { useState } from "react";
import "./sidebar.css";

import {
  MdNotificationsNone,
  MdDashboard,
  MdInbox,
  MdFolder,
  MdPeople,
  MdSchedule,
  MdCalendarToday,
  MdAccountTree,
  MdBusiness,
  MdDescription,
  MdReceipt,
  MdAssessment,
  MdLogout,
  MdChatBubbleOutline,
  MdCheckBox,
  MdAttachFile,
  MdCurrencyExchange,
  MdAttachMoney,
  MdAssignmentInd,
  MdBadge,
  MdMenu,
  MdContacts,
  MdAdminPanelSettings,
  MdSwapHoriz,
} from "react-icons/md";

const menuSections = [
  {
    title: null,
    items: [
      //VISTAS GENERALES
      {
        label: "Organigrama",
        icon: MdContacts,
        roles: ["admin", "lider","finanzas","trabajador"]
      },
      {
        label: "Notificaciones",
        icon: MdNotificationsNone,
        roles: ["admin", "lider","finanzas","trabajador"]
      },
      {
        label: "Cronograma",
        icon: MdSchedule,
        roles: ["admin", "lider","finanzas","trabajador"]
      },
      {
        label: "Mensajes",
        icon: MdChatBubbleOutline,
        roles: ["admin", "lider","finanzas","trabajador"]
      },
      

      //VISTAS TRABAJADOR Y FINANZAS
      {
        label: "Mis tareas",
        icon:MdCheckBox,
        roles: ["trabajador", "finanzas"]
      },
      {
        label: "Mi semana",
        icon: MdCalendarToday,
        roles: ["trabajador", "finanzas"]
      },
      {
        label: "Mis proyectos",
        icon: MdFolder,
        roles: ["trabajador", "finanzas"]
      },

      //VISTA TRABAJADOR
      {
        label: "Mis archivos",
        icon: MdAttachFile,
        roles: ["trabajador"]
      },
            
    ],
  },
  
  //SECCIONES ADMIN
  {
    title: "ADMINISTRAR",
    items: [
      {
        label: "Panel general",
        icon: MdDashboard,
        roles: ["admin"],
      },
      {
        label: "Bandeja de solicitudes",
        icon: MdInbox,
        roles: ["admin"],
        //badge: 12,
      },
      {
        label: "Proyectos",
        icon: MdFolder,
        roles: ["admin"],
      },
      {
        label: "Personas y carga",
        icon: MdPeople,
        roles: ["admin"],
      },
      {
        //ALTA Y BAJA DE CUENTAS, SOLO ADMIN
        label: "Empleados",
        icon: MdBadge,
        roles: ["admin"],
      },
      {
        label: "Calendario",
        icon: MdCalendarToday,
        roles: ["admin"],
      },
    ],
  },

  {
    title: "CONFIGURACIÓN",
    items: [
      {
        label: "Diseñador de flujos",
        icon: MdAccountTree,
        roles: ["admin"],
      },
      {
        label: "Áreas y usuarios",
        icon: MdBusiness,
        roles: ["admin"],
      },
      {
        //ROLES Y SUS PERMISOS, SOLO ADMIN
        label: "Roles y permisos",
        icon: MdAdminPanelSettings,
        roles: ["admin"],
      },
      {
        //CUENTAS MICROSOFT Y LIBROS DE EXCEL REGISTRADOS, SOLO ADMIN
        label: "Formatos de solicitud",
        icon: MdDescription,
        roles: ["admin"],
      },
      {
        //ESQUEMAS Y MAPEO DE LOS LIBROS A PROYECTOS; TODAVÍA SIN PANTALLA
        label: "Configuración de formatos de solicitud",
        icon: MdSwapHoriz,
        roles: ["admin"],
      },
    ],
  },

  {
    title: "VISTA DE SOLO LECTURA",
    items: [
      {
        label: "Facturación",
        icon: MdReceipt,
        roles: ["admin"],
      },
      {
        label: "Reportes",
        icon: MdAssessment,
        roles: ["admin"],
      },
    ],
  },

  //SECCIÓN FINANZAS
  {
    title: "COBRO",
    items: [
      {
        label: "Facturas",
        icon: MdCurrencyExchange,
        roles: ["finanzas"],
      },
      {
        label: "Cotizaciones",
        icon: MdAttachMoney,
        roles: ["finanzas"],
        badge: 12,
      },
    ],
  },


  //SECCIÓN LÍDER
  {
    title: "LÍDER",
    items: [
      {
        label: "Panel de área",
        icon: MdDashboard,
        roles: ["lider"],
      },
      {
        label: "Por asignar",
        icon: MdInbox,
        roles: ["lider"],
        badge: 12,
      },
      {
        label: "Proyectos del área",
        icon: MdFolder,
        roles: ["lider"],
      },
      {
        label: "Equipo",
        icon: MdPeople,
        roles: ["lider"],
      },
      {
        label: "Calendario del área",
        icon: MdCalendarToday,
        roles: ["lider"],
      },
    ],
  },

  {
    title: "ÁREA",
    items: [
      {
        label: "Flujos aplicables",
        icon: MdAccountTree,
        roles: ["lider"],
      },
      {
        label: "Capacidad y turnos",
        icon: MdAssignmentInd,
        roles: ["lider"],
        //badge: 12,
      },
    ],
  },
];

// `foto` es el object URL de la foto de perfil, o null para mostrar las iniciales.
function Sidebar({ usuario, foto = null, role = "admin", activeItem = "Proyectos", onNavigate, onLogout}) {
  
  //CREAMOS EL ESTADO, al inicio es false
  /* isClosed = false -> menú abierto 
    Al presionar el botón será:
    isClosed = true -> menú cerrado
    */
  const [isClosed, setIsClosed] = useState(false);

  return (
    /*operador ternario  condición ? expresion si es verdadera : expresion si es falsa  */
    <aside className={`sidebar ${isClosed ? "closed" : ""}`}>
      {/* LOGO */}
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
      

      {/* MENÚ */}
      <nav className="sidebar-menu">
        {/* section = sección actual, sectionIndex = índice de las secciones (0,1,2,3,4,...)*/}
        {menuSections.map((section, sectionIndex) => {
          const visibleItems = section.items.filter((item) =>
            item.roles.includes(role),
          );

          if (visibleItems.length === 0) {
            return null;
          }

          return (
            <div className="sidebar-section" key={sectionIndex}>
              {section.title && (
                <p className="sidebar-section-title">{section.title}</p>
              )}

              <div className="sidebar-section-items">
                {visibleItems.map((item) => {
                  const Icon = item.icon;

                  const isActive = activeItem === item.label;

                  return (
                    <button
                      key={item.label}
                      className={`sidebar-item ${isActive ? "active" : ""}`}
                      onClick={() => onNavigate && onNavigate(item.label)}
                    >
                      <Icon className="sidebar-item-icon" />

                      <span className="sidebar-item-label">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* USUARIO: hacer clic abre "Mi perfil" */}
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
