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

// Los 4 slots de documentacion de APIWorking (existeFile1..4) confirmados
// con el negocio — orden fijo, no cambia por cliente. Ver calcularDocumentacion
// en mappers/enrichment/documentacion.ts.
export type ClaveDocumento = "CARTA" | "FOTO_DNI" | "CLAVE_SOL" | "PAGOS";

export interface DocumentoDetalle {
  clave: ClaveDocumento;
  etiqueta: string;
  disponible: boolean;
}

export interface DocumentacionResumen {
  disponibles: number;
  total: number;
  porcentaje: number;
  detalle: DocumentoDetalle[];
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
  documentacion: DocumentacionResumen;
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
  documentacion: DocumentacionResumen;
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
  documentacionGlobal: DocumentacionResumen;
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
  // false unicamente cuando la periodicidad necesita anclarse a un
  // comprobante real de renovacion (Trimestral/Semestral/Anual, ver
  // usaUltimoComprobantePararRenovacion) y el cliente nunca tuvo uno — la
  // fecha cayo al respaldo de fechaSistema, que puede errar por meses. Para
  // Mensual siempre true (fechaSistema + dia de ciclo real es confiable).
  // No es una regla nueva: solo expone una distincion que el calculo ya
  // hacia internamente (ver enrichCliente.ts / Renovaciones Fase 3.1).
  renovacionAnclaConfiable: boolean;
  // Dia real de facturacion (1/12/22/etc.) tomado de nCicloFacturacion
  // (Administrativo/post-venta) — solo se calcula para periodicidad MENSUAL,
  // confirmado con negocio (Fase 2) que el ciclo de facturacion como filtro
  // solo aplica ahi; Trimestral/Semestral/Anual se anclan al ultimo
  // comprobante real en su lugar (ver usaUltimoComprobantePararRenovacion).
  // null si no es Mensual o si APIWorking no trae un dia identificable.
  diaCicloMensual: number | null;

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
  // true si el cliente tiene al menos una incidencia "DAR DE ALTA AL
  // CLIENTE" sin resolver en Administrativo/incidencias — precalculado por
  // el sync diario (fetchAllIncidencias), nunca en vivo (36k+ incidencias
  // historicas, no se puede pedir por request). Ver alerta ALTA_PENDIENTE.
  altaPendiente: boolean;
  // Mismo mecanismo que altaPendiente, pero para incidencias "CERTIFICADO
  // DIGITAL POR VENCER" / "CERTIFICADO DIGITAL SE VENCE HOY" sin resolver.
  // Ver alertas CERTIFICADO_POR_VENCER / CERTIFICADO_VENCE_HOY.
  certificadoPorVencer: boolean;
  certificadoVenceHoy: boolean;

  metadata: {
    notasCount: number;
    tareasAbiertasCount: number;
    tareasTotalCount: number;
    alertasCount: { INFO: number; WARNING: number; CRITICAL: number };
  };

  // Solo presente en GET /api/clientes (Cartera) — cuantos episodios de
  // recuperacion ABIERTOS (EN_RECUPERACION/PENDIENTE_VALIDACION) tiene este
  // RUC en ordenes DISTINTAS a la vigente. No cuenta la propia ordenVigente
  // si esta en recuperacion (ver modulo Recuperacion) — evita duplicar la
  // info que ya se ve como "orden activa" en la fila.
  recuperacionAbiertaCount?: number;

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
  // Corte entre "historial" y "trabajo activo" (2026-09-21, alcance ampliado
  // 2026-09-21): incidencias pendientes con fecha anterior a esto dejan de
  // alimentar Dashboard/Alertas activas/prioridades/Misiones de hoy (ver
  // indexarSenalesIncidenciasPorCliente). Ademas, TODA alerta global (deuda,
  // certificado, documentacion, renovacion, etc.) de un cliente/sistema cuyo
  // ordenVigente.fechaSistema sea anterior a esto queda fuera de GET
  // /api/alertas, cola urgente, contadores del Dashboard y
  // metadata.alertasCount — ver filtrarClientesDesdeCorteHistorico en
  // alertas.engine.ts. En ambos casos, la ficha/historial del cliente sigue
  // mostrando todo sin filtrar, y nunca se borra ni se marca resuelto
  // automaticamente — solo se saca de la vista operativa diaria/global.
  "operativo.fecha_corte_historico": string;
  // Lista mas amplia que dataset.estados_excluidos, usada solo para el
  // desempate de pickOrdenVigente() (cliente.aggregator.ts) — una orden en
  // uno de estos estados nunca gana el "vigente" por sobre una orden
  // realmente activa del mismo cliente, aunque sea mas reciente. A
  // diferencia de estados_excluidos, NO saca al cliente del dataset (ver
  // modulo Recuperacion).
  "dataset.estados_no_vigentes": string;
  // Modulo Recuperacion de clientes: dias de gracia despues de la fecha
  // esperada de renovacion antes de considerar una orden "renovacion
  // impaga", y dias de permanencia en la cola antes de marcarla PERDIDO
  // automaticamente si nadie la recupera.
  "recuperacion.dias_gracia_renovacion": number;
  "recuperacion.dias_permanencia": number;
}

// ---------------------------------------------------------------------------
// Alertas / Oportunidades
// ---------------------------------------------------------------------------
export type NivelAlerta = "INFO" | "WARNING" | "CRITICAL";
// ABIERTA = estado por defecto (calculado). VISTA/RESUELTA son marcas
// manuales guardadas en postventa_alertas_estado — una vez marcada RESUELTA
// queda asi hasta que alguien la reabra a mano, sin importar si la condicion
// que la disparo sigue activa (decision explicita: "resuelta" significa que
// ya se gestiono el caso, no que el dato de origen cambio).
export type EstadoAlerta = "ABIERTA" | "VISTA" | "RESUELTA";

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
  // Necesario para las acciones de contacto directo (Llamar/WhatsApp) desde
  // la propia tarjeta de alerta — ver rediseno de Alertas (Fase 3).
  telefonoEfectivo: string | null;
  fecha: string;
  origen: string;
  estado: EstadoAlerta;
}

export type EstadoOportunidad = "ABIERTA" | "EN_GESTION" | "GANADA" | "PERDIDA";

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
  // Gestion manual — ver postventa_oportunidades_estado. Sin override
  // guardado, una oportunidad recien detectada es ABIERTA, sin responsable
  // ni siguiente accion asignados todavia (no se inventa un responsable
  // default).
  estado: EstadoOportunidad;
  responsable: string | null;
  siguienteAccion: string | null;
  resultado: string | null;
}

export interface OportunidadEstado {
  oportunidadId: string;
  numeroDocumentoCliente: string;
  estado: EstadoOportunidad;
  responsable: string | null;
  siguienteAccion: string | null;
  resultado: string | null;
  usuario: string;
  // tipo/montoDeclarado solo se llenan cuando estado='GANADA' (ver
  // migracion 0041/0042) — tipo se copia de Oportunidad.tipo al momento de
  // marcarla ganada (para poder sumar "La Bolsa" por tipo sin re-evaluar el
  // motor sobre historial pasado). montoDeclarado (antes "montoReal") NO es
  // una cifra verificada contra un pago real de APIWorking — se
  // autocompleta con valorEstimado cuando el motor ya trae un numero real
  // (hoy solo MIGRACION_PERIODICIDAD), o lo escribe la persona a mano para
  // el resto; es lo que alguien declaro, nunca una conciliacion de caja.
  tipo: string | null;
  montoDeclarado: number | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// "La Bolsa" — reemplaza al modulo Resultados (postventa_resultado_dia/
// accion/conversion, ver migracion 0033, que queda congelado como
// historial). Permite multiples aperturas/cierres el mismo dia por usuario
// (pedido explicito) — la clave real de "a que apertura pertenece esto" es
// (usuario, fecha, numeroApertura), no solo (usuario, fecha). Los
// contadores/montos NUNCA se persisten: se calculan en vivo sobre datos
// reales en la ventana [abiertaEn, cerradaEn o ahora] (ver
// services/postventa/bolsaResumen.ts) para que nunca queden desactualizados.
//
// Ajuste (feedback post-0041): se retiro el concepto de superadmin/roles
// (bolsa.admins) — no se introduce un rol nuevo sin decision explicita del
// negocio. Cada usuario ve unicamente su propia bolsa.
// ---------------------------------------------------------------------------
export type EstadoBolsaSesion = "ABIERTA" | "CERRADA";
export type OrigenBolsaSesion = "AUTOMATICA" | "MANUAL";

// Categorias fijas de conversion (ajuste post-0041: antes texto libre) —
// "OTRO" es una red de seguridad de migracion para historial que no calce
// con las 6 categorias reales, nunca se ofrece como opcion nueva.
export type TipoBolsaConversion =
  | "CAMBIO_PERIODICIDAD"
  | "ADQUISICION_EQUIPO"
  | "RECUPERACION_CLIENTE"
  | "VENTA_PRODUCTO"
  | "APILOYALTY"
  | "APIREVIEW"
  | "OTRO";

export interface BolsaSesion {
  id: number;
  usuario: string;
  fecha: string; // YYYY-MM-DD
  numeroApertura: number;
  abiertaEn: string;
  cerradaEn: string | null;
  origenApertura: OrigenBolsaSesion;
  origenCierre: OrigenBolsaSesion | null;
  observacionCierre: string | null;
  estado: EstadoBolsaSesion;
  createdAt: string;
  updatedAt: string;
}

export interface BolsaConversion {
  id: number;
  bolsaSesionId: number;
  tipo: TipoBolsaConversion;
  descripcion: string | null;
  createdBy: string;
  createdAt: string;
}

export interface BolsaOportunidadGanada {
  tipo: string;
  cantidad: number;
  montoTotal: number;
}

export interface BolsaResumen {
  contactos: number;
  misionesCompletadas: number;
  oportunidadesGanadas: BolsaOportunidadGanada[];
  totalSoles: number;
  conversiones: BolsaConversion[];
}

// "Resumen del dia anterior" — la notificacion que se muestra al primer
// ingreso del dia siguiente (pedido explicito), nunca automatica en el
// sentido de "calculada e inventada": son los mismos datos reales del dia
// de ayer, agregados. El frontend decide mostrarla una sola vez (guarda que
// ya se cerro) — el backend simplemente la devuelve siempre que haya datos.
export interface BolsaResumenDiaAnterior {
  fecha: string;
  aperturas: number;
  cierres: number;
  clientesContactadosUnicos: number;
  misionesCompletadas: number;
  conversionesPorCategoria: { tipo: TipoBolsaConversion; cantidad: number }[];
}

export interface BolsaEstado {
  sesion: BolsaSesion | null;
  resumen: BolsaResumen;
  resumenDiaAnterior: BolsaResumenDiaAnterior | null;
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

export interface AlertaEstado {
  alertaId: string;
  numeroDocumentoCliente: string;
  estado: "VISTA" | "RESUELTA";
  nota: string | null;
  usuario: string;
  createdAt: string;
  updatedAt: string;
}

// Adjuntos (imagenes) para comentarios/notas libres — un solo repositorio
// generico en vez de una tabla de imagenes por cada tipo de comentario.
export type EntidadAdjunto = "NOTA" | "TAREA_SEGUIMIENTO" | "REUNION" | "INCIDENCIA_MANUAL";

export interface Adjunto {
  id: number;
  entidadTipo: EntidadAdjunto;
  entidadId: number;
  url: string;
  nombreOriginal: string;
  mimeType: string;
  tamanoBytes: number;
  usuario: string;
  createdAt: string;
}

// Incidencia registrada a mano desde la app, mientras no esta conectado el
// endpoint de creacion de APIWorking (existe, se conecta mas adelante) — ver
// tipo real Incidencia (Administrativo/incidencias, solo lectura). No
// aparece en APIWorking todavia, solo en esta app.
export interface IncidenciaManual {
  id: number;
  numeroDocumentoCliente: string;
  idOrdenServicio: number | null;
  caso: string;
  tipo: string | null;
  descripcion: string | null;
  createdBy: string;
  createdAt: string;
}

// Registro de que alguien del equipo hizo clic en "Llamar" o "WhatsApp" para
// un cliente — no es un log de que la comunicacion realmente se concreto (no
// podemos saberlo desde el navegador), solo que se inicio el intento.
export type CanalContacto = "LLAMADA" | "WHATSAPP";

export interface Contacto {
  id: number;
  numeroDocumentoCliente: string;
  idOrdenServicio: number | null;
  canal: CanalContacto;
  usuario: string;
  createdAt: string;
}

export type PrioridadTarea = "BAJA" | "MEDIA" | "ALTA";
export type EstadoTarea =
  | "PENDIENTE"
  | "EN_PROCESO"
  | "ESPERANDO_CLIENTE"
  | "COMPLETADA"
  | "CANCELADA";
// Naturaleza de la tarea — que tipo de trabajo es, independiente de como se
// creo (ver OrigenTarea). RENOVACION = generada automaticamente por
// sincronizarTareasRenovacion (naturaleza y origen coinciden ahi, es el
// unico caso). PENDIENTE_CLASIFICACION = tareas historicas creadas antes de
// que existiera esta separacion (ex "MANUAL") — nunca se les asigna
// cobranza/soporte/etc. sin evidencia real, ver migracion 0036.
export type TipoTarea =
  | "RENOVACION"
  | "PENDIENTE_CLASIFICACION"
  | "COBRANZA"
  | "DOCUMENTACION"
  | "SOPORTE"
  | "SEGUIMIENTO"
  | "REUNION"
  | "OPORTUNIDAD_COMERCIAL";

// Como se creo la tarea (distinto de TipoTarea, que es la naturaleza del
// trabajo). MANUAL = creada a mano sin partir de ninguna otra pantalla.
export type OrigenTarea =
  | "MANUAL"
  | "ALERTA"
  | "INCIDENCIA"
  | "FICHA_CLIENTE"
  | "OPORTUNIDAD"
  | "RENOVACION"
  // Generado por sincronizarTareasRepartoMensual (services/postventa/
  // repartoMensualContacto.ts) — reparto automatico de TODOS los clientes
  // activos entre los dias habiles del mes, para asegurar un contacto de
  // seguimiento mensual. No hay ningun selector de origen en la UI de
  // creacion manual (el origen lo fija el contexto: alerta/incidencia/
  // ficha/oportunidad), asi que esto en la practica solo lo genera el sync.
  | "REPARTO_MENSUAL"
  | "RECUPERACION";

export interface Tarea {
  id: number;
  numeroDocumentoCliente: string;
  idOrdenServicio: number | null;
  tipo: TipoTarea;
  origen: OrigenTarea;
  // Entidad puntual que disparo la creacion (ej. origen=INCIDENCIA ->
  // origenEntidadTipo='INCIDENCIA', origenEntidadId=idIncidencia como
  // string) — null cuando el origen no tiene una entidad puntual (MANUAL) o
  // es una tarea historica sin ese dato (ver migracion 0036).
  origenEntidadTipo: string | null;
  origenEntidadId: string | null;
  // "YYYY-MM" — a que mes pertenece este reparto (ver migracion 0040).
  // Inmutable una vez creada, a diferencia de fechaVencimiento (que SI puede
  // redistribuirse) — es la clave real de deduplicacion mensual, con
  // restriccion UNIQUE real en la base (numero_documento_cliente, origen,
  // periodo_reparto). Solo se usa con origen=REPARTO_MENSUAL; null en
  // cualquier otro origen.
  periodoReparto: string | null;
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
// EN_ESPERA = reunion especial creada sin fecha/hora todavia (solo el
// comentario de disponibilidad del cliente en `nota`) — pasa a PROGRAMADA
// cuando alguien le asigna horario real (ver asignarHorarioReunion).
export type EstadoReunion = "PROGRAMADA" | "COMPLETADA" | "CANCELADA" | "EN_ESPERA";

export interface Reunion {
  id: number;
  numeroDocumentoCliente: string;
  idOrdenServicio: number | null;
  ejecutivo: string;
  // null solo mientras estado === "EN_ESPERA" (reunion especial sin horario
  // asignado todavia). Toda reunion PROGRAMADA/COMPLETADA/CANCELADA tiene
  // fecha/horaInicio/horaFin reales.
  fecha: string | null; // "YYYY-MM-DD"
  horaInicio: string | null; // "HH:mm"
  horaFin: string | null; // "HH:mm"
  modalidad: ModalidadReunion;
  lugarOLink: string | null;
  nota: string | null;
  estado: EstadoReunion;
  // null = reunion regular de seguimiento. "CAPACITACION" | "REFORZAMIENTO" |
  // texto libre (cuando se elige "Otro") para una reunion especial.
  tipoReunion: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// Reunion + snapshot en vivo del cliente, para la pantalla que lista TODAS
// las reuniones de la cartera (no solo las de un cliente puntual).
export interface ReunionConCliente {
  reunion: Reunion;
  cliente: {
    numeroDocumentoCliente: string;
    nombreCliente: string;
    sistemas: ClienteSistemas;
  } | null;
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

// Catalogo real de GET /Administrativo/tipo-incidencias — solo tipos activos
// (estado "A"), confirmado via prueba controlada. Ver externalApi.ts.
export interface TipoIncidenciaCatalogo {
  id: number;
  nombre: string;
}

// Capacitaciones/reforzamientos dictados al cliente — sync diario desde
// Administrativo/capacitaciones (ver mappers/capacitaciones.mapper.ts, el
// dato real viene todo mezclado en HTML libre, esto ya es la version limpia).
export interface Capacitacion {
  idCapacitacion: number;
  tipo: string; // "CAPACITACION" | "REFORZAMIENTO" | "" si no matcheo
  estado: "CANCELADA" | "CAPACITADO" | "PENDIENTE";
  numeroDocumentoCliente: string | null;
  numeroOs: string | null;
  fecha: string | null;
  fechaFinal: string | null;
  capacitador: string | null;
  agendador: string | null;
  vendedor: string | null;
  modalidad: string | null;
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

// ---------------------------------------------------------------------------
// Resultados y cierre diario (Fase 3) — 100% local, sin dependencia de
// APIWorking. Un ResultadoDia por usuario por fecha (UNIQUE en la tabla).
// No existe monto de cierre ni diferencia de cuadre: a proposito, ver
// migracion 0033 y Decisiones Fase 3.
// ---------------------------------------------------------------------------
export type EstadoResultadoDia = "ABIERTO" | "CERRADO";
export type TipoConversion = "EQUIPO" | "PLAN" | "MODULO";

export interface ResultadoAccion {
  id: number;
  resultadoDiaId: number;
  tipo: string;
  realizadas: number;
  noRealizadas: number;
}

export interface ResultadoConversion {
  id: number;
  resultadoDiaId: number;
  tipo: TipoConversion;
  cantidad: number;
  detalle: string | null;
}

export interface ResultadoDia {
  id: number;
  usuario: string;
  fecha: string; // YYYY-MM-DD
  estado: EstadoResultadoDia;
  montoApertura: number;
  horaApertura: string;
  horaCierre: string | null;
  observacionCierre: string | null;
  avisoAdministracion: boolean;
  motivoAviso: string | null;
  acciones: ResultadoAccion[];
  conversiones: ResultadoConversion[];
}

// Fila resumida para el historico — sin las acciones/conversiones completas,
// solo los totales (suma exacta, no una formula de evaluacion).
export interface ResultadoDiaResumen {
  id: number;
  usuario: string;
  fecha: string;
  estado: EstadoResultadoDia;
  montoApertura: number;
  horaApertura: string;
  horaCierre: string | null;
  avisoAdministracion: boolean;
  totalRealizadas: number;
  totalNoRealizadas: number;
  totalConversiones: number;
  conversionesPorTipo: Record<TipoConversion, number>;
}

// ---------------------------------------------------------------------------
// Registro automatico de eventos operativos (ajuste funcional Fase 3)
// ---------------------------------------------------------------------------
// Catalogo cerrado y validado server-side a proposito — nunca texto libre
// del frontend, para que "accion operativa real" siga significando algo
// concreto y no un click de navegacion cualquiera. Cada valor corresponde a
// una escritura real ya existente en su propio controller (ver comentario en
// repositories/eventoOperativo.repository.ts para el mapeo completo).
export type TipoAccionOperativa =
  | "CONTACTO_LLAMADA"
  | "CONTACTO_WHATSAPP"
  | "TAREA_CREADA"
  | "TAREA_COMPLETADA"
  | "TAREA_POSTERGADA"
  | "TAREA_REASIGNADA"
  | "ALERTA_RESUELTA"
  | "INCIDENCIA_CREADA"
  | "SEGUIMIENTO_REGISTRADO"
  | "OPORTUNIDAD_GESTIONADA"
  | "CONVERSION_REGISTRADA"
  | "DIA_ABIERTO"
  | "DIA_CERRADO"
  | "RECUPERACION_MARCADA_RECUPERADO"
  | "RECUPERACION_MARCADA_PERDIDO"
  | "RECUPERACION_REASIGNADA";

export type ModuloOperativo =
  | "CLIENTES"
  | "TAREAS"
  | "ALERTAS"
  | "INCIDENCIAS"
  | "SEGUIMIENTOS"
  | "OPORTUNIDADES"
  | "RESULTADOS"
  | "RECUPERACION";

export interface EventoOperativo {
  id: number;
  usuario: string;
  tipoAccion: TipoAccionOperativa;
  modulo: ModuloOperativo;
  numeroDocumentoCliente: string | null;
  entidadTipo: string | null;
  entidadId: string | null;
  resultado: string;
  detalle: string | null;
  createdAt: string;
}

export interface ResumenEventosOperativos {
  usuario: string;
  fecha: string;
  total: number;
  porTipo: Partial<Record<TipoAccionOperativa, number>>;
}

// ---------------------------------------------------------------------------
// Modulo "Recuperacion de clientes" — la unidad es la orden de servicio
// (idOrdenServicio), nunca el RUC. Ver migracion 0044.
// ---------------------------------------------------------------------------
export type OrigenRecuperacion = "RENOVACION_IMPAGA" | "SUSPENSION" | "BAJA";
export type EstadoRecuperacion =
  | "EN_RECUPERACION"
  | "RECUPERADO"
  | "PERDIDO"
  | "PENDIENTE_VALIDACION";

export interface EpisodioRecuperacion {
  id: number;
  idOrdenServicio: number;
  numeroDocumentoCliente: string;
  nombreCliente: string;
  origen: OrigenRecuperacion;
  numeroEpisodio: number;
  estado: EstadoRecuperacion;
  fechaIngreso: string | null;
  fechaLimite: string | null;
  motivo: string | null;
  responsable: string | null;
  resultado: string | null;
  fechaRecuperacion: string | null;
  fechaPerdida: string | null;
  creadoPor: string;
  creadoEn: string;
  actualizadoEn: string;
}

// Salida del motor de deteccion (recuperacion.engine.ts) — un candidato por
// orden que actualmente cumple alguna de las 3 reglas, con la evidencia real
// disponible (nunca inventada) para que el service decida si ya existe un
// episodio abierto o hay que crear uno nuevo.
export interface CandidatoRecuperacion {
  idOrdenServicio: number;
  numeroDocumentoCliente: string;
  nombreCliente: string;
  origen: OrigenRecuperacion;
  // true solo cuando hay evidencia real y confiable del hecho que origina la
  // recuperacion (fecha de vencimiento calculada para renovacion, o fecha de
  // baja ya cacheada) — false obliga a PENDIENTE_VALIDACION (ver auditoria:
  // suspension nunca tiene fecha real, baja solo a veces). NO es la fecha de
  // ingreso operativa — esa siempre es "hoy" (ver recuperacionService.ts):
  // los 30 dias de permanencia cuentan desde que la orden entra a ESTA cola,
  // nunca desde cuando el problema empezo historicamente (evita que un
  // vencimiento de hace meses nazca ya "perdido" el mismo dia que se detecta
  // por primera vez).
  evidenciaConfirmada: boolean;
  motivo: string;
  monto: number;
}
