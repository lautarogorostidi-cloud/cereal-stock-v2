export type RolUsuario = 'admin' | 'comercial' | 'operario'
export type TipoMovimiento = 'cosecha' | 'venta' | 'entrega' | 'transferencia' | 'ajuste' | 'devolucion'
export type EstadoContrato = 'borrador' | 'activo' | 'parcial' | 'cumplido' | 'cancelado'
export type EstadoEntrega = 'pendiente' | 'en_transito' | 'entregado' | 'rechazado'
export type EstadoCartaPorte = 'emitida' | 'en_transito' | 'descargada' | 'anulada'
export type TipoPrecio = 'disponible' | 'forward' | 'mercado_termino' | 'fijado'
export type EstadoLiquidacion = 'borrador' | 'emitida' | 'pagada' | 'impugnada'

export interface Perfil {
  id: string
  nombre: string
  apellido: string
  email: string
  rol: RolUsuario
  activo: boolean
  telefono?: string
  created_at: string
  updated_at: string
}

export interface Campania {
  id: string
  nombre: string
  fecha_inicio: string
  fecha_fin?: string
  activa: boolean
  created_at: string
}

export interface Cultivo {
  id: string
  nombre: string
  codigo: string
  activo: boolean
}

export interface Lote {
  id: string
  nombre: string
  establecimiento: string
  hectareas?: number
  provincia?: string
  partido?: string
  localidad?: string
  activo: boolean
}

export interface Cliente {
  id: string
  razon_social: string
  cuit?: string
  tipo: string
  contacto?: string
  email?: string
  telefono?: string
  direccion?: string
  localidad?: string
  provincia?: string
  activo: boolean
}

export interface Acopio {
  id: string
  nombre: string
  razon_social?: string
  cuit?: string
  direccion?: string
  localidad: string
  provincia: string
  capacidad_ton?: number
  activo: boolean
}

export interface Puerto {
  id: string
  nombre: string
  provincia: string
  activo: boolean
}

export interface Transportista {
  id: string
  nombre: string
  cuit?: string
  patente_camion?: string
  patente_acoplado?: string
  chofer?: string
  telefono?: string
  activo: boolean
}

export interface Moneda {
  id: string
  codigo: string
  nombre: string
  simbolo: string
}

export interface TipoCambio {
  id: string
  fecha: string
  moneda_origen: string
  moneda_destino: string
  valor: number
  fuente?: string
  created_at: string
}

export interface Contrato {
  id: string
  numero: string
  campania_id: string
  cultivo_id: string
  cliente_id: string
  fecha_contrato: string
  tipo_precio: TipoPrecio
  precio_unitario?: number
  moneda_id: string
  toneladas_pactadas: number
  toneladas_entregadas: number
  puerto_id?: string
  acopio_id?: string
  fecha_inicio_entrega?: string
  fecha_fin_entrega?: string
  condiciones?: string
  estado: EstadoContrato
  observaciones?: string
  usuario_id?: string
  created_at: string
  updated_at: string
  // joins
  campanias?: Campania
  cultivos?: Cultivo
  clientes?: Cliente
  monedas?: Moneda
  puertos?: Puerto
  acopios?: Acopio
}

export interface CartaPorte {
  id: string
  numero_cpe: string
  campania_id: string
  cultivo_id: string
  lote_id?: string
  contrato_id?: string
  fecha_emision: string
  fecha_partida?: string
  transportista_id?: string
  origen_acopio_id?: string
  destino_acopio_id?: string
  destino_puerto_id?: string
  toneladas_origen: number
  toneladas_destino?: number
  humedad_origen?: number
  humedad_destino?: number
  proteina?: number
  gluten?: number
  peso_hectolitrico?: number
  zaranda?: number
  bonificacion_calidad?: number
  merma_humedad?: number
  toneladas_netas?: number
  estado: EstadoCartaPorte
  observaciones?: string
  usuario_id?: string
  created_at: string
  updated_at: string
}

export interface MovimientoCereal {
  id: string
  tipo: TipoMovimiento
  fecha: string
  campania_id: string
  cultivo_id: string
  lote_id?: string
  toneladas: number
  humedad?: number
  proteina?: number
  gluten?: number
  peso_hectolitrico?: number
  cliente_id?: string
  acopio_origen_id?: string
  acopio_destino_id?: string
  puerto_id?: string
  contrato_id?: string
  carta_porte_id?: string
  precio_unitario?: number
  moneda_id?: string
  tipo_cambio?: number
  precio_usd?: number
  flete?: number
  secado?: number
  paritaria?: number
  otros_gastos?: number
  resultado_neto?: number
  observaciones?: string
  usuario_id: string
  created_at: string
  updated_at: string
  // joins
  campanias?: Campania
  cultivos?: Cultivo
  clientes?: Cliente
  monedas?: Moneda
}

export interface Liquidacion {
  id: string
  numero: string
  contrato_id: string
  carta_porte_id?: string
  fecha_liquidacion: string
  toneladas: number
  precio_unitario: number
  moneda_id: string
  tipo_cambio?: number
  bruto_pesos?: number
  bruto_usd?: number
  descuento_humedad?: number
  descuento_calidad?: number
  flete?: number
  secado?: number
  paritaria?: number
  otros_descuentos?: number
  neto_pesos?: number
  neto_usd?: number
  estado: EstadoLiquidacion
  fecha_pago?: string
  observaciones?: string
  usuario_id?: string
  created_at: string
  updated_at: string
}

// Tipos para las vistas
export interface StockActual {
  campania: string
  cultivo: string
  cultivo_codigo: string
  ton_cosechadas: number
  ton_vendidas: number
  ton_entregadas: number
  stock_fisico: number
  ton_comprometidas: number
  stock_disponible: number
}

export interface PosicionContrato {
  numero: string
  fecha_contrato: string
  cliente: string
  cultivo: string
  campania: string
  tipo_precio: TipoPrecio
  precio_unitario: number
  moneda: string
  toneladas_pactadas: number
  toneladas_entregadas: number
  toneladas_pendientes: number
  pct_cumplimiento: number
  estado: EstadoContrato
  fecha_fin_entrega?: string
}

export interface ResultadoComercial {
  campania: string
  cultivo: string
  cantidad_operaciones: number
  ton_totales: number
  precio_promedio: number
  ingreso_bruto: number
  total_gastos: number
  resultado_neto: number
  moneda: string
}
