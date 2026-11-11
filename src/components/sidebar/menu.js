// Las pestañas del menú lateral y las reglas para mostrarlas:
// - Las pestañas generales (Organigrama, Notificaciones) se muestran a cualquier usuario autenticado.
// - Las pantallas operativas se gestionan dinámicamente mediante el catálogo de permisos por rol (RF-USR-02, RF-USR-05).
// - Únicamente las funciones reservadas por seguridad a la coordinación (Empleados, Roles y permisos, Tipos de contrato) se restringen a admin.
import {
  MdNotificationsNone,
  MdInbox,
  MdFolder,
  MdPeople,
  MdSchedule,
  MdAccountTree,
  MdBusiness,
  MdDescription,
  MdReceipt,
  MdCheckBox,
  MdAttachFile,
  MdAttachMoney,
  MdBadge,
  MdContacts,
  MdAdminPanelSettings,
  MdLabel,
  MdSchema,
  MdViewQuilt,
  MdCalendarMonth,
  MdWork,
  MdEventBusy,
} from "react-icons/md";

export const menuSections = [
  {
    title: null,
    items: [
      {
        label: "Organigrama",
        icon: MdContacts,
      },
      {
        label: "Notificaciones",
        icon: MdNotificationsNone,
      },
      {
        label: "Cronograma",
        icon: MdSchedule,
        permission: "calendar.read",
      },
      {
        label: "Calendario",
        icon: MdCalendarMonth,
        permission: "calendar.read",
      },
      {
        label: "Mis tareas",
        icon: MdCheckBox,
        permission: "task.read",
      },
    ],
  },

  {
    title: "ADMINISTRAR",
    items: [
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
        permission: "document.read",
      },
      {
        label: "Ausencias",
        icon: MdEventBusy,
        permission: "absence.read",
      },
      {
        label: "Empleados",
        icon: MdBadge,
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
        label: "Tipos de contrato",
        icon: MdWork,
        roles: ["admin"],
      },
      {
        label: "Tipos de ausencia",
        icon: MdEventBusy,
        permission: "absence.manage",
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
        permission: "spreadsheet.read",
      },
    ],
  },

  {
    title: "DATOS",
    items: [
      {
        label: "Facturación",
        icon: MdReceipt,
        permission: "finance.read",
      },
    ],
  },

  {
    title: "COBRO",
    items: [
      {
        label: "Cotizaciones",
        icon: MdAttachMoney,
        permission: "finance.read",
      },
      {
        label: "Facturas",
        icon: MdReceipt,
        permission: "finance.read",
      },
    ],
  },

  {
    title: "LÍDER",
    items: [
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
        label: "Equipo",
        icon: MdPeople,
        permission: "task.write",
      },
    ],
  },
];

/**
 * Si el elemento del menú se ve:
 * - Por `permission` si la define (gestión por catálogo de permisos de roles).
 * - Por `roles` si la define (exclusivo para admin).
 * - Si no define ninguna (pestañas generales), visible para cualquier usuario autenticado.
 */
export function itemVisible(item, role, permissions) {
  if (item.permission) {
    return permissions.includes(item.permission);
  }
  if (item.roles) {
    return item.roles.includes(role);
  }
  return true;
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
