import React from "react";
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
  MdLogout
} from "react-icons/md";

import "./Sidebar.css";

const menuSections = [
  {
    title: null,
    items: [
      {
        label: "Notificaciones",
        icon: MdNotificationsNone,
        roles: ["admin", "trabajador"],
        badge: 12
      },
      {
        label: "Panel general",
        icon: MdDashboard,
        roles: ["admin", "trabajador"]
      },
      {
        label: "Bandeja de solicitudes",
        icon: MdInbox,
        roles: ["admin", "trabajador"],
        badge: 12
      },
      {
        label: "Proyectos",
        icon: MdFolder,
        roles: ["admin", "trabajador"]
      },
      {
        label: "Personas y carga",
        icon: MdPeople,
        roles: ["admin", "trabajador"]
      },
      {
        label: "Cronograma",
        icon: MdSchedule,
        roles: ["admin", "trabajador"]
      },
      {
        label: "Calendario",
        icon: MdCalendarToday,
        roles: ["admin", "trabajador"]
      }
    ]
  },

  {
    title: "CONFIGURACIÓN",
    items: [
      {
        label: "Diseñador de flujos",
        icon: MdAccountTree,
        roles: ["admin", "trabajador"]
      },
      {
        label: "Áreas y usuarios",
        icon: MdBusiness,
        roles: ["admin", "trabajador"]
      },
      {
        label: "Formatos de solicitud",
        icon: MdDescription,
        roles: ["admin", "trabajador"]
      }
    ]
  },

  {
    title: "VISTA DE SOLO LECTURA",
    items: [
      {
        label: "Facturación",
        icon: MdReceipt,
        roles: ["admin", "trabajador"]
      },
      {
        label: "Reportes",
        icon: MdAssessment,
        roles: ["admin", "trabajador"]
      }
    ]
  }
];

function Sidebar({
  role = "admin",
  activeItem = "Proyectos",
  onNavigate
}) {
  return (
    <aside className="sidebar">

      {/* LOGO */}
      <div className="sidebar-brand">
        <div className="brand-icon">
          <span></span>
        </div>

        <span className="brand-name">
          IMAGEN UAQ
        </span>
      </div>

      {/* MENÚ */}
      <nav className="sidebar-menu">

        {menuSections.map((section, sectionIndex) => {

          const visibleItems = section.items.filter((item) =>
            item.roles.includes(role)
          );

          if (visibleItems.length === 0) {
            return null;
          }

          return (
            <div
              className="sidebar-section"
              key={sectionIndex}
            >

              {section.title && (
                <p className="sidebar-section-title">
                  {section.title}
                </p>
              )}

              <div className="sidebar-section-items">

                {visibleItems.map((item) => {

                  const Icon = item.icon;

                  const isActive =
                    activeItem === item.label;

                  return (
                    <button
                      key={item.label}
                      className={`sidebar-item ${
                        isActive ? "active" : ""
                      }`}
                      onClick={() =>
                        onNavigate &&
                        onNavigate(item.label)
                      }
                    >

                      <Icon className="sidebar-item-icon" />

                      <span className="sidebar-item-label">
                        {item.label}
                      </span>

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

        <div className="user-avatar">
          JL
        </div>

        <div className="user-info">
          <span className="user-name">
            Juan López Pérez
          </span>

          <span className="user-role">
            Dirección - vista global
          </span>
        </div>

        <MdLogout className="logout-icon" />

      </div>

    </aside>
  );
}

export default Sidebar;