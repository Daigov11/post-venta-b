// Espejo manual: frontend/src/types/postventaCliente.ts debe mantenerse alineado con este archivo.

// ---------------------------------------------------------------------------
// Forma cruda tal como la devuelve APIWorking (GET /Administrativo/orden-servicio)
// ---------------------------------------------------------------------------
export interface RawOrdenServicio {
  total: number;
  deudaTotalALL: number;
  idOrdenServicio: number;
  numeroOs: string | null;
  fechaOs: string | null;
  fechaFormat: string | null;
  cliente: string | null;
  numeroDocumentoCliente: string | null;
  nombrePlan: string | null;
  idEstado: string | null;
  nEstado: string | null;
  fechaSistema: string | null;
  idEquipo: string | null;
  idContrato: number | null;
  existeFactura: number;
  existeFacturaEquipo: number;
  existeFile1: number;
  existeFile2: number;
  existeFile3: number;
  existeFile4: number;
  facturacion: string | null;
  flagFacturacion: string | null;
  ejecutivo: string | null;
  nTipoPlan: string | null;
  nTipoOS: string | null;
  tipo: string | null;
  nDistribuidor: string | null;
  existeEquipo: number;
  principalDistribuidor: string | null;
  idDistribuidor: string | null;
  usuarioCreacion: string | null;
  linkSistema: string | null;
  deuda: string;
  totalDeudaOrder: number;
  totalDeuda: number;
  idSolicitudRegistro: string | number | null;
  cantidadComprobantes: number;
  pruebaFechaInicio: string | null;
  deudaProyectada: string;
  telefono: string | null;
  diasPruebas: string | null;
  origenSolicitud: string | null;
  nUbigeo: string | null;
  // Solo viene poblado cuando el request incluye incluirPago=1.
  pagos: RawPago[];
  [key: string]: unknown;
}

export interface RawPago {
  idOrdenServicio: number;
  nroComprobante: string;
  tipoComprobante: string;
  descripcionCliente: string;
  origen: string;
  fechaEmitido: string; // "DD-MM-YYYY"
  total: number;
  deuda: number;
  estado: string;
}

// GET /Administrativo/post-venta — endpoint separado, requiere rol _SISTEMAS
// (403 para roles normales, se usa el FALLBACK_API_TOKEN). Nombres de campo
// en snake_case/mixtos tal como los devuelve la API, distintos de
// orden-servicio aunque describan al mismo idOrdenServicio. Se cruza con
// orden-servicio por id_ordenservicio para completar el dataset — no lo
// reemplaza (a este le faltan documentacion, equipo, distribuidor y pagos).
export interface RawPostVenta {
  id_ordenservicio: number;
  numerodocumento_cliente: string | null;
  id_sistema: number | null;
  nsistema: string | null;
  nombre_comercial: string | null;
  fecha_activacion: string | null; // "DD-MM-YYYY"
  nCicloFacturacion: string | null;
  nEstadoSistema: string | null;
  nEstadoSunat: string | null;
  nEstadoCapacitado: string | null;
  nAfiliadoSunat: string | null;
  nModo: string | null;
  visualizar_sunat: number;
  suspendido: string | null; // "1" | "0"
  acargo: string | null;
  fecha_vencimiento_certificado_formato: string | null; // "DD-MM-YYYY"
  fecha_inactivo_formato: string | null; // "DD-MM-YYYY h:mm AM/PM" o centinela "00-00-0000..."
  cantidadComprobantesMensual: number;
  cantidadMensualBV: number;
  cantidadMensualFV: number;
  cantidadMensualNV: number;
  cantidadMensualOtros: number;
  ingresosClienteMensual: string | null; // "S/ 4,940.00"
  instalado: string | null; // "1" | "0"
  meses: number | null; // duracion numerica del ciclo (1 = mensual, etc.)
  fecha_instalacion: string | null; // "DD-MM-YYYY", distinta de fecha_activacion
  [key: string]: unknown;
}

export interface PostVentaExtra {
  idSistema: number | null;
  nSistema: string | null; // "RESTAURANT" | "TIENDAS" | "HOTEL" | otros — autoritativo
  nombreComercial: string | null;
  fechaActivacion: string | null; // ISO
  nCicloFacturacion: string | null;
  nEstadoSistema: string | null;
  nEstadoSunat: string | null;
  nEstadoCapacitado: string | null;
  nAfiliadoSunat: string | null;
  nModo: string | null;
  visualizarSunat: boolean;
  suspendido: boolean;
  acargo: string | null;
  fechaVencimientoCertificado: string | null; // ISO
  fechaInactivo: string | null; // ISO, null si nunca estuvo inactivo
  cantidadComprobantesMensual: number;
  comprobantesMensualDesglose: { bv: number; fv: number; nv: number; otros: number };
  ingresosClienteMensual: number | null; // parseado desde "S/ 4,940.00"
  instalado: boolean;
  meses: number | null;
  fechaInstalacion: string | null; // ISO
}

export interface PagoNormalizado {
  nroComprobante: string;
  fechaEmitido: string | null; // ISO, null si no se pudo parsear
  total: number;
  deuda: number; // > 0 = todavia impago
  // Que tipo de cargo es — "Administrativo Plan"/"Administrativo Anualidad"
  // son la renovacion real del plan; "Directo", "Administrativo Equipo",
  // "Administrativo Implementacion" son cargos sueltos que no representan el
  // ciclo de facturacion (ver calcularProximaRenovacionDesdeComprobante).
  origen: string;
}

// ---------------------------------------------------------------------------
// Salida del mapper (mappers/ordenServicio.mapper.ts) — una fila normalizada
// ---------------------------------------------------------------------------
export interface OsRefNormalized {
  idOrdenServicio: number;
  numeroOs: string;
  fechaOs: string | null; // ISO, null si no se pudo parsear
  // Ancla de facturacion: fecha en que se registro la OS en el sistema. El
  // proximo vencimiento de pago se calcula sumando la periodicidad del plan
  // a esta fecha, de forma recurrente.
  fechaSistema: string | null; // ISO, null si no se pudo parsear
  numeroDocumentoCliente: string;
  nombreCliente: string;
  telefono: string | null;
  nUbigeo: string | null;
  pruebaFechaInicio: string | null; // valor crudo "DD-MM-YYYY"
  nombrePlan: string;
  // Periodicidad declarada por APIWorking (orden-servicio.nTipoPlan) —
  // "Mensual"/"Trimestral"/"Semestral"/"Anual", autoritativo. Reemplaza a la
  // heuristica sobre nombrePlan como fuente primaria (ver parsePlan) — esa
  // heuristica fallaba para planes con formato "NOMBRE/PRECIO" sin la
  // palabra de periodicidad en el texto (ej. "RESTO/99", confirmado Mensual
  // con datos reales pero indetectable por keyword).
  nTipoPlan: string | null;
  tipoOS: string;
  tipoCodigo: string;
  idEstadoApiWorking: string;
  nEstadoApiWorking: string;
  deuda: number;
  deudaProyectada: number;
  existeEquipo: boolean;
  idEquipo: string | null;
  documentacion: { disponibles: number; total: number; porcentaje: number };
  facturas: { disponibles: number; equipoDisponibles: number };
  cantidadComprobantes: number;
  distribuidor: { id: string | null; nombre: string | null } | null;
  facturable: boolean;
  linkSistema: string | null;
  ejecutivo: string | null;
  pagos: PagoNormalizado[];
  // null si no hay fila correspondiente en el endpoint post-venta para esta OS
  // (ej. OS anterior al 25-09-2022, limite conocido donde ese endpoint falla).
  postVentaExtra: PostVentaExtra | null;
}

// ---------------------------------------------------------------------------
// Salida del aggregator (mappers/cliente.aggregator.ts) — antes de enriquecer
// ---------------------------------------------------------------------------
export interface ClienteBase {
  numeroDocumentoCliente: string;
  nombreCliente: string;
  telefono: string | null;
  nUbigeo: string | null;
  pruebaFechaInicio: string | null;
  ordenVigente: OsRefNormalized;
  osRefs: OsRefNormalized[];
  deudaTotal: number;
}

// ---------------------------------------------------------------------------
// Contrato estable para el frontend — nunca se lee un campo crudo de APIWorking
// ---------------------------------------------------------------------------
export type EstadoPostVenta = "NORMAL" | "REVISAR" | "ATENCION";
export type SegmentoCartera = "DIAMANTE" | "ORO" | "PLATA" | "CRITICO";
export type Periodicidad =
  | "MENSUAL"
  | "TRIMESTRAL"
  | "SEMESTRAL"
  | "ANUAL"
  | "DESCONOCIDO";

export interface OsRefResumen {
  idOrdenServicio: number;
  numeroOs: string;
  fechaOs: string | null;
  fechaSistema: string | null;
  nombrePlan: string;
  nTipoPlan: string | null;
  tipoOS: string;
  tipoCodigo: string;
  idEstadoApiWorking: string;
  nEstadoApiWorking: string;
  deuda: number;
  deudaProyectada: number;
  existeEquipo: boolean;
  idEquipo: string | null;
  documentacion: { disponibles: number; total: number; porcentaje: number };
  facturas: { disponibles: number; equipoDisponibles: number };
  cantidadComprobantes: number;
  distribuidor: { id: string | null; nombre: string | null } | null;
  facturable: boolean;
  linkSistema: string | null;
  ejecutivo: string | null;
  pagos: PagoNormalizado[];
  postVentaExtra: PostVentaExtra | null;
}

export interface Ubicacion {
  departamento: string;
  provincia: string;
  distrito: string;
}

// Que otros sistemas de la familia APIWorking tiene el cliente, calculado
// desde el texto de los planes de sus OS (ver calcularSistemas) — nunca
// inventado. apiWorking es la cantidad de OS (>1 = varios locales/sistemas
// APIWorking); el resto son booleanos, en gris cuando no hay señal real.
export interface ClienteSistemas {
  apiWorking: number;
  apiLoyalty: boolean;
  donChat: boolean;
  sireContable: boolean;
  apiReview: boolean;
  pos: boolean;
}

export interface PostVentaCliente {
  numeroDocumentoCliente: string;
  nombreCliente: string;
  sistemas: ClienteSistemas;
  // telefono es el dato crudo de APIWorking, nunca se sobreescribe. Si al
  // contactar al cliente resulta ser otro numero, se guarda telefonoManual
  // (nuestro, editable) y telefonoEfectivo es el que hay que usar en toda la
  // UI (manual si existe, si no el de APIWorking) — mismo patron que
  // segmentoManual/segmentoEfectivo.
  telefono: string | null;
  telefonoManual: string | null;
  telefonoEfectivo: string | null;
  ubicacion: Ubicacion | { raw: string } | null;

  ordenVigente: OsRefResumen;
  planActual: {
    nombre: string;
    periodicidad: Periodicidad;
    precio: number | null;
    precioAnualProyectado: number | "No determinado";
  };

  osRefs: OsRefResumen[];
  cantidadOs: number;

  deudaTotal: number;
  fechaInicioCliente: string | null;
  antiguedad:
    | { texto: string; meses: number }
    | { texto: "No determinado"; meses: null };
  documentacionGlobal: { disponibles: number; total: number; porcentaje: number };
  cantidadComprobantesHistorico: number;

  // Vencimiento de pago mas reciente ya cumplido, calculado desde fechaSistema
  // + periodicidad. Base para evaluar puntualidad de pago (segmento de cartera).
  // null si el cliente todavia no llega a su primer ciclo.
  ultimoVencimientoPago: string | null;

  // "Renovacion" = el proximo vencimiento del ciclo de pago (mismo ancla
  // fechaSistema + periodicidad que ultimoVencimientoPago, proyectado hacia
  // adelante) — no es una fecha de contrato separada, APIWorking no la tiene.
  // null si la periodicidad es DESCONOCIDA.
  proximaRenovacion: string | null;
  diasParaRenovacion: number | null;
  // true si diasParaRenovacion cae dentro de la ventana de aviso configurada
  // para la periodicidad del plan (ver renovacion.alerta_*_dias) — precalculado
  // para que el filtro del cuadro de Clientes y la alerta RENOVACION_PROXIMA
  // usen exactamente el mismo criterio.
  renovacionEnAlerta: boolean;

  // Desde que ciclo el cliente quedo sin pagar (ver calcularVencidoDesde) —
  // null si esta al dia. Distinto de proximaRenovacion: este mira hacia
  // atras, al comprobante real mas reciente, en vez de proyectar el proximo
  // ciclo calendario (que sigue avanzando aunque el cliente lleve meses sin
  // que le emitan un comprobante nuevo, ej. tras quedar SUSPENDIDO POR PAGO).
  vencidoDesde: string | null;
  diasVencido: number | null;

  // Ingreso mensual real, calculado desde el comprobante mas reciente de
  // pagos[] (no desde ordenVigente.postVentaExtra.ingresosClienteMensual,
  // cuya formula no conocemos) — ver calcularIngresoMensualReal. Es la fuente
  // que usan los KPIs de dinero en Renovaciones (ingresos en juego/en riesgo).
  ingresoMensualReal: number | null;

  estadoPostVenta: EstadoPostVenta;
  estadoPostVentaManual: EstadoPostVenta | null;
  estadoPostVentaEfectivo: EstadoPostVenta;

  segmentoManual: string | null;
  segmentoCalculado: SegmentoCartera | null;
  segmentoEfectivo: SegmentoCartera | string | null;
  etiquetas: string[];
  observacionGeneral: string | null;

  // Heuristica sobre nombrePlan (ej. "RESTO" -> "Restaurante"). "No determinado"
  // si el nombre del plan no matchea ningun rubro conocido — nunca se inventa.
  rubro: string | "No determinado";

  // Aproximado por la cantidad de usuarios registrados en el sistema propio
  // del cliente (endpoint systemUser). Cacheado en MySQL, no en vivo — puede
  // estar desactualizado, ver cantidadTrabajadoresActualizadoEn.
  cantidadTrabajadores: number | null;
  cantidadTrabajadoresActualizadoEn: string | null;
  // Usuarios del sistema propio del cliente, listos para copiar/pegar — mismo
  // cache que cantidadTrabajadores, nunca incluye la clave (password): el
  // mapper de systemUsers.ts la descarta antes de llegar aca.
  usuarios: string[];
  baseDatos: string | null;

  // Proxy de "ultima actividad" — postVentaExtra.fechaInactivo se actualiza
  // constantemente en clientes que usan el sistema con normalidad (no es "se
  // dio de baja"), asi que un valor viejo o ausente sugiere que dejaron de
  // usarlo, independiente de si pagan bien. null si no hay dato (nunca se
  // inventa).
  diasSinActividad: number | null;
  // true si diasSinActividad supera el umbral configurado (ver
  // actividad.dias_sin_uso_alerta) — precalculado para que el filtro del
  // cuadro de Clientes y la alerta SIN_ACTIVIDAD_RECIENTE usen exactamente
  // el mismo criterio (mismo patron que renovacionEnAlerta).
  sinActividadReciente: boolean;

  metadata: {
    notasCount: number;
    tareasAbiertasCount: number;
    tareasTotalCount: number;
    alertasCount: { INFO: number; WARNING: number; CRITICAL: number };
  };

  generatedAt: string;
}

export interface SystemUsersCache {
  numeroDocumentoCliente: string;
  cantidadTrabajadores: number;
  baseDatos: string | null;
  usuarios: string[];
  linkSistemaUsado: string | null;
  updatedAt: string;
}

export interface PostVentaDataset {
  clientes: PostVentaCliente[];
  generatedAt: string;
  totalOsRows: number;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
export interface PostVentaConfigValues {
  "estado.deuda_atencion_min": number;
  "estado.documentacion_completa_min": number;
  "alerta.deuda_min": number;
  // Dias de atraso (diasVencido) a partir de los cuales la alerta de deuda
  // pendiente deja de dispararse — un cliente suspendido hace meses ya se
  // sabe que esta perdido, seguir alertando sobre el mismo caso indefinido
  // es solo ruido que tapa a los casos nuevos/accionables.
  "alerta.deuda_dias_max": number;
  "alerta.antiguedad_aniversario_meses": number;
  "oportunidad.cliente_antiguo_meses_min": number;
  "oportunidad.alto_volumen_comprobantes_min": number;
  "sync.fecha_inicio": string;
  // nEstado de APIWorking separados por coma — clientes cuya ordenVigente
  // tenga uno de estos estados se excluyen de TODO el dataset (dashboard,
  // cuadro de clientes, alertas, oportunidades). Ej. clientes desactivados.
  "dataset.estados_excluidos": string;
  // Dias de atraso entre el vencimiento del ciclo y la emision de la factura
  // que lo cubre, usados para clasificar el segmento de cartera. Diamante:
  // 0..diamante_max_dias, Oro: hasta oro_max_dias, Plata: hasta plata_max_dias,
  // Critico: mas que eso, o deuda pendiente, o vencimiento sin factura.
  "segmento.diamante_max_dias": number;
  "segmento.oro_max_dias": number;
  "segmento.plata_max_dias": number;
  // El endpoint post-venta falla con fechas anteriores al 25-09-2022 (error
  // de conversion de fecha del lado de APIWorking, confirmado probando el
  // rango). No usar la misma sync.fecha_inicio de orden-servicio para este.
  "sync.post_venta_fecha_inicio": string;
  // Dias de anticipacion para la alerta "Renovacion proxima", segun la
  // periodicidad del plan (a mas duracion de ciclo, mas anticipacion —
  // confirmado con el negocio: mensual 7, trimestral 15, semestral y anual 45).
  "renovacion.alerta_mensual_dias": number;
  "renovacion.alerta_trimestral_dias": number;
  "renovacion.alerta_semestral_dias": number;
  "renovacion.alerta_anual_dias": number;
  // Dias sin señal de actividad (fechaInactivo) a partir de los cuales se
  // alerta posible desuso — independiente del segmento de pago.
  "actividad.dias_sin_uso_alerta": number;
  // Seguimiento post venta ("Meta Team") — dias entre cada ronda de contacto
  // a un cliente recien capacitado, y la fecha a partir de la cual un
  // cliente nuevo entra al flujo automatico (los anteriores a esa fecha ya
  // fueron seguidos a mano, ver import del Excel de Ligia).
  "seguimiento.dias_etapa2": number;
  "seguimiento.dias_etapa3": number;
  "seguimiento.fecha_corte_clientes_nuevos": string;
}

// ---------------------------------------------------------------------------
// Alertas / Oportunidades
// ---------------------------------------------------------------------------
export type NivelAlerta = "INFO" | "WARNING" | "CRITICAL";

export interface Alerta {
  id: string;
  tipo: string;
  nivel: NivelAlerta;
  titulo: string;
  mensaje: string;
  cliente: string;
  nombreCliente: string;
  sistemas: ClienteSistemas;
  idOrdenServicio: number | null;
  fecha: string;
  origen: string;
  estado: "ABIERTA";
}

export interface Oportunidad {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  cliente: string;
  nombreCliente: string;
  sistemas: ClienteSistemas;
  idOrdenServicio: number | null;
  valorEstimado: number | "No determinado";
  fecha: string;
  origen: string;
}

// ---------------------------------------------------------------------------
// Recursos propios de Post Venta (MySQL)
// ---------------------------------------------------------------------------
export interface ClienteMetadata {
  id: number;
  numeroDocumentoCliente: string;
  idOrdenServicio: number | null;
  segmentoManual: string | null;
  estadoPostVentaManual: EstadoPostVenta | null;
  telefonoManual: string | null;
  etiquetas: string[];
  observacionGeneral: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Nota {
  id: number;
  numeroDocumentoCliente: string;
  idOrdenServicio: number | null;
  usuario: string;
  nota: string;
  createdAt: string;
  updatedAt: string;
}

export type PrioridadTarea = "BAJA" | "MEDIA" | "ALTA";
export type EstadoTarea =
  | "PENDIENTE"
  | "EN_PROCESO"
  | "ESPERANDO_CLIENTE"
  | "COMPLETADA"
  | "CANCELADA";
// RENOVACION = generada automaticamente por sincronizarTareasRenovacion,
// MANUAL = creada a mano desde la ficha del cliente (createTarea).
export type TipoTarea = "MANUAL" | "RENOVACION";

export interface Tarea {
  id: number;
  numeroDocumentoCliente: string;
  idOrdenServicio: number | null;
  tipo: TipoTarea;
  titulo: string;
  descripcion: string | null;
  responsable: string;
  prioridad: PrioridadTarea;
  estado: EstadoTarea;
  fechaVencimiento: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Seguimiento {
  id: number;
  tareaId: number;
  usuario: string;
  comentario: string;
  estadoEnEseMomento: EstadoTarea | null;
  createdAt: string;
}

// Tarea de tipo RENOVACION enriquecida con un snapshot del cliente al
// momento de la consulta (no se guarda en la tarea — se lee en vivo del
// dataset compartido) para poder filtrar por periodicidad y ordenar por
// ingreso mensual sin tener que ir a buscar cada cliente por separado.
export interface TareaRenovacion {
  tarea: Tarea;
  cliente: {
    numeroDocumentoCliente: string;
    nombreCliente: string;
    sistemas: ClienteSistemas;
    periodicidad: Periodicidad;
    proximaRenovacion: string | null;
    diasParaRenovacion: number | null;
    ingresoMensualReal: number | null;
  };
}

export interface SavedView {
  id: number;
  usuario: string;
  screen: string;
  nombre: string;
  columnas: string[];
  filtros: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Intereses comerciales — catalogo de productos/upsell que un ejecutivo puede
// marcar por cliente. Catalogo editable (sin campo de descuento estructurado
// a proposito — cualquier promo/badge va como texto libre en "etiqueta").
// ---------------------------------------------------------------------------
export interface InteresCatalogo {
  id: number;
  icono: string | null;
  nombre: string;
  descripcion: string | null;
  etiqueta: string | null;
  orden: number;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Reuniones — agenda con verificacion de disponibilidad real por asesor.
// Horario de atencion: 9:00-18:00, Lunes a Sabado, slots de 30 min. Duracion
// segun modalidad: VIRTUAL 30 min, PRESENCIAL 90 min (fijo, no configurable
// por ahora — regla de negocio confirmada).
// ---------------------------------------------------------------------------
export type ModalidadReunion = "VIRTUAL" | "PRESENCIAL";
export type EstadoReunion = "PROGRAMADA" | "COMPLETADA" | "CANCELADA";

export interface Reunion {
  id: number;
  numeroDocumentoCliente: string;
  idOrdenServicio: number | null;
  ejecutivo: string;
  fecha: string; // "YYYY-MM-DD"
  horaInicio: string; // "HH:mm"
  horaFin: string; // "HH:mm"
  modalidad: ModalidadReunion;
  lugarOLink: string | null;
  nota: string | null;
  estado: EstadoReunion;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Historial de seguimiento — GET Administrativo/historial-seguimiento,
// origen=1 (Orden de Servicio). Bitacora real de APIWorking: cada cambio de
// estado de la OS a lo largo del tiempo, quien lo hizo y una observacion
// libre. Cubre lo que el plan original marcaba como "no disponible":
// historial de estados y contacto efectivo (llamadas). Las incidencias
// propiamente dichas tienen su propia tabla — ver Incidencia mas abajo.
// ---------------------------------------------------------------------------
export interface HistorialSeguimientoEvento {
  fecha: string | null;
  idEstado: number;
  estado: string;
  persona: string;
  observacion: string;
}

// ---------------------------------------------------------------------------
// Incidencias — GET Administrativo/incidencias. A diferencia del historial de
// seguimiento, esta SI es una tabla propia con estado de resolucion real:
// condicion "A" (abierta) / "C" (cerrada-resuelta) — ver incidencias.mapper.ts.
// ---------------------------------------------------------------------------
export interface Incidencia {
  idIncidencia: number;
  idOrdenServicio: number;
  numeroOs: string;
  fecha: string | null;
  caso: string;
  tipo: string;
  estado: string;
  resuelta: boolean;
  asignadoPor: string;
  asignadoA: string;
  aCargo: string;
  telefono: string | null;
  descripcion: string;
  reportadoPorCliente: boolean;
  automatico: boolean;
}

// ---------------------------------------------------------------------------
// Seguimiento Post Venta ("Meta Team") — onboarding de clientes recien
// capacitados: 3 rondas de contacto (bienvenida, +15 dias, +30 dias desde la
// anterior). Antes se llevaba a mano en un Excel (Ligia/Zurilma); los
// clientes de ahi se importaron con origen IMPORTADO_EXCEL, los nuevos desde
// seguimiento.fecha_corte_clientes_nuevos entran solos con AUTOMATICO.
// ---------------------------------------------------------------------------
export type EstadoPipelineSeguimiento = "EN_PROCESO" | "EXITOSO" | "REQUIERE_ATENCION";
export type OrigenSeguimiento = "AUTOMATICO" | "IMPORTADO_EXCEL";

export interface SeguimientoCliente {
  id: number;
  numeroDocumentoCliente: string;
  idOrdenServicio: number;
  fechaInicio: string;
  estadoPipeline: EstadoPipelineSeguimiento;
  origen: OrigenSeguimiento;
  createdAt: string;
  updatedAt: string;
}

export interface SeguimientoEtapa {
  id: number;
  seguimientoClienteId: number;
  etapa: 1 | 2 | 3;
  fechaRealizado: string | null;
  medioComunicacion: string | null;
  estadoSeguimiento: string | null;
  resumen: string | null;
  solicitudCliente: string | null;
  usuario: string | null;
  createdAt: string;
  updatedAt: string;
}

// Etiquetas de las 3 etapas — no vienen de APIWorking ni del Excel, son
// nuestras (confirmado con el negocio), calculadas segun cuantas etapas ya
// se registraron y cuantos dias pasaron desde la ultima.
export const ETAPA_LABEL: Record<1 | 2 | 3, string> = {
  1: "Cliente capacitado inactivo después de seguimiento post venta",
  2: "Cliente capacitado pendiente de revisión post venta",
  3: "Cliente revisado por posventa pendiente de activación",
};

export interface EtapaActualInfo {
  etapa: 1 | 2 | 3;
  label: string;
  diasParaSiguiente: number | null;
  vencida: boolean;
}

export interface SeguimientoResumen {
  numeroDocumentoCliente: string;
  nombreCliente: string;
  plan: string;
  sistemas: ClienteSistemas;
  ejecutivo: string | null;
  origen: OrigenSeguimiento;
  estadoPipeline: EstadoPipelineSeguimiento;
  fechaInicio: string;
  etapaActual: EtapaActualInfo | null; // null cuando estadoPipeline ya no esta EN_PROCESO
}

export interface SeguimientoDetalle {
  cliente: SeguimientoCliente;
  etapas: SeguimientoEtapa[];
  etapaActual: EtapaActualInfo | null;
  incidencias: HistorialSeguimientoEvento[];
  notas: Nota[];
}
