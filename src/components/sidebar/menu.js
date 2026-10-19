// Las pestañas del menú lateral y quién ve cada una. Las que tienen pantalla se piden por permiso,
// porque los roles se crean y se editan en «Roles y permisos» (RF-USR-02, RF-USR-05); las que todavía
// no tienen pantalla, y las que el servidor reserva a admin, siguen por nombre de rol.
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
  MdChatBubbleOutline,
  MdCheckBox,
  MdAttachFile,
  MdCurrencyExchange,
  MdAttachMoney,
  MdAssignmentInd,
  MdBadge,
  MdContacts,
  MdAdminPanelSettings,
  MdLabel,
  MdSwapHoriz,
  MdSchema,
  MdViewQuilt,
} from "react-icons/md";

export const menuSections = [
  {
    title: null,
    items: [
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
      

      {
        label: "Mis tareas",
        icon:MdCheckBox,
        permission: "task.read",
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

            
    ],
  },
  
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
        permission: "request.read",
      },
      {
        label: "Proyectos",
        icon: MdFolder,
        permission: "project.read",
      },
      {
        label: "Archivos",
        icon: MdAttachFile,
        permission: "document.browse",
      },
      {
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
        permission: "workflow.manage",
      },
      {
        label: "Áreas y usuarios",
        icon: MdBusiness,
        permission: "area.manage",
      },
      {
        label: "Roles y permisos",
        icon: MdAdminPanelSettings,
        roles: ["admin"],
      },
      {
        label: "Catálogo de estatus",
        icon: MdLabel,
        permission: "status.manage",
      },
      {
        label: "Formatos de solicitud",
        icon: MdDescription,
        permission: "schema.manage",
      },
      {
        label: "Retención de archivos",
        icon: MdAttachFile,
        permission: "document.manage",
      },
      {
        label: "Libros de Excel",
        icon: MdSchema,
        roles: ["admin"],
      },
      {
        label: "Importar de Excel",
        icon: MdSwapHoriz,
        roles: ["admin"],
      },
    ],
  },

  {
    title: "DATOS",
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


  {
    title: "LÍDER",
    items: [
      {
        label: "Panel de área",
        icon: MdDashboard,
        roles: ["lider"],
      },
      {
        label: "Panorama de áreas",
        icon: MdViewQuilt,
        permission: "task.write",
      },
      {
        label: "Por asignar",
        icon: MdInbox,
        permission: "task.write",
      },
      {
        label: "Proyectos del área",
        icon: MdFolder,
        roles: ["lider"],
      },
      {
        label: "Equipo",
        icon: MdPeople,
        permission: "task.write",
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
      },
    ],
  },
];

/** Si el elemento del menú se ve: con su `permission` si la pide y, si no, por `roles`. */
export function itemVisible(item, role, permissions) {
  return item.permission
    ? permissions.includes(item.permission)
    : item.roles.includes(role);
}

/** Las pestañas que abre el permiso `code`, para decirlo en «Roles y permisos». */
export function tabsFor(code) {
  return menuSections
    .flatMap((section) => section.items)
    .filter((item) => item.permission === code)
    .map((item) => item.label);
}

/** Si la pestaña `label` se ve; una que no está en el menú, como «Mi perfil», siempre se ve. */
export function canSee(label, role, permissions) {
  const item = menuSections
    .flatMap((section) => section.items)
    .find((candidate) => candidate.label === label);
  return !item || itemVisible(item, role, permissions);
}
