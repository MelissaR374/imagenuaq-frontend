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
} from "react-icons/md";

const menuSections = [
  {
    title: null,
    items: [
      //VISTAS GENERALES
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
        label: "Personal",
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
        label: "Formatos de solicitud",
        icon: MdDescription,
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

function Sidebar({ role = "admin", activeItem = "Proyectos", onNavigate }) {
  
  //CREAMOS EL ESTADO, al inicio es false
  /* isClosed = false -> menú abierto 
    Al presionar el botón será:
    isClosed = true -> menú cerrado
    */
  const [isClosed, setIsClosed] = useState(false);

  return (
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

      {/* USUARIO */}
      <div className="sidebar-user">
        <div className="user-avatar">JL</div>

        <div className="user-info">
          <span className="user-name">Juan López Pérez</span>

          <span className="user-role">Dirección - vista global</span>
        </div>

        <MdLogout className="logout-icon" />
      </div>
    </aside>
  );
}

export default Sidebar;
