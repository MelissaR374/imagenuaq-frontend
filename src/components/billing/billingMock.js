//DATOS TEMPORALES: LOS DATOS SON FICTICIOS Y SIRVEN UNICAMENTE PARA PROBAR LA INTERFAZ
//Una vez que se conecte con el backend, aquí irá la conexión de los datos por la respuesta de la API
export const billingMock = {
  projects: [
    {
      id: 1,
      projectId: 1,
      code: "SPA_CLS_001",
      name: "Reconocimientos Premium Enriqueta Rangel Andrade",
      responsible: "Miguel Ángel García",
      entity: "Rectoría",
      amount: 1000,
      quotation: {
        status: "available",
        label: "Archivo disponible",
        fileName: "SPA_CLS_001.xlsx",

        downloadUrl: "/documentos/cotizaciones/SPA_CLS_001.xlsx",
      },
      invoice: {
        status: "missing",
        label: "Sin factura registrada",
      },
      receipt: {
        status: "referenced",
        label: "Recibo referenciado",
        folio: "5685752",
        date: "31/10/2026",
      },
    },
    {
      id: 2,
      projectId: 2,
      code: "SPA_CLS_002",
      name: "Rotulación Sentra, Secretaría de la Contraloría",
      responsible: "Miguel Ángel García",
      entity: "Secretaría de la Contraloría",
      amount: 850,
      quotation: {
        status: "available",
        label: "Archivo disponible",
        fileName: "SPA_CLS_002.xlsx",
      },
      invoice: {
        status: "missing",
        label: "Sin factura registrada",
      },
      receipt: {
        status: "referenced",
        label: "Recibo referenciado",
        folio: "5685753",
        date: "31/10/2026",
      },
    },
    {
      id: 3,
      projectId: 3,
      code: "SPA_CLS_003",
      name: "Rotulación con vinil esmerilado, puerta Dirección de Servicios Académicos",
      responsible: "Miguel Ángel García",
      entity: "Dirección de Servicios Académicos",
      amount: 540,
      quotation: {
        status: "available",
        label: "Archivo disponible",
        fileName: "SPA_CLS_003.xlsx",
      },
      invoice: {
        status: "missing",
        label: "Sin factura registrada",
      },
      receipt: {
        status: "referenced",
        label: "Recibo referenciado",
        folio: "5685754",
        date: "31/10/2026",
      },
    },
    {
      id: 4,
      projectId: 4,
      code: "SPA_CLS_004",
      name: "Reconocimientos Premium Enriqueta Rangel Andrade",
      responsible: "Rosa María Quiroz",
      entity: "Rectoría",
      amount: 1000,
      quotation: {
        status: "available",
        label: "Archivo disponible",
        fileName: "SPA_CLS_04.xlsx",
      },
      invoice: {
        status: "available",
        label: "Factura disponible",
        fileName: "FACT_SPA_CLS_001.pdf",

        downloadUrl: "/documentos/facturas/FACT_SPA_CLS_001.pdf",
      },
      receipt: {
        status: "referenced",
        label: "Recibo referenciado",
        folio: "5685752",
        date: "31/10/2026",
      },
    },
  ],

  unlinkedRecords: [
    {
      id: 101,
      code: "SPA_CEL_000",
      description: "Pendiente",
      amount: null,
      quotation: {
        status: "pending",
        label: "Falta cotización",
      },
      invoice: {
        status: "missing",
        label: "Sin factura registrada",
      },
      receipt: {
        status: "referenced",
        label: "Recibo referenciado",
        folio: "5685723",
        date: "31/10/2026",
      },
    },
    {
      id: 102,
      code: "SPA_CEL_001",
      description: "Pendiente",
      amount: null,
      quotation: {
        status: "pending",
        label: "Falta cotización",
      },
      invoice: {
        status: "missing",
        label: "Sin factura registrada",
      },
      receipt: {
        status: "referenced",
        label: "Recibo referenciado",
        folio: "5685794",
        date: "31/10/2026",
      },
    },
    {
      id: 103,
      code: "SPA_CEL_002",
      description: "Pendiente",
      amount: null,
      quotation: {
        status: "pending",
        label: "Falta cotización",
      },
      invoice: {
        status: "missing",
        label: "Sin factura registrada",
      },
      receipt: {
        status: "referenced",
        label: "Recibo referenciado",
        folio: "5685832",
        date: "31/10/2026",
      },
    },
  ],
};