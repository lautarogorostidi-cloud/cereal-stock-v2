// Helpers compartidos del módulo Camión (todo en USD)

export type ViajeCamion = {
  origen_viaje: 'propio' | 'tercero'
  viaje_id: string
  fecha: string
  fecha_descarga: string | null
  cliente: string | null
  cliente_id: number | null
  carga: string | null
  origen: string | null
  destino: string | null
  chofer: string | null
  patente: string | null
  km: number | null
  tn_origen: number | null
  tn: number | null
  numero_cpe: string | null
  ctg: string | null
  contrato: string | null
  tarifa_usd_tn: number
  observaciones: string | null
  diferencia_tn: number
  ingreso_usd: number
  tarifa_chofer_usd_tn: number | null
  tarifa_chofer_propia: boolean
  costo_chofer_usd: number
  resultado_usd: number
}

export type CostoCamion = {
  id: number
  fecha: string
  categoria: string
  descripcion: string | null
  litros: number | null
  monto_usd: number
  proveedor: string | null
  comprobante: string | null
  observaciones: string | null
}

export const CATEGORIAS_COSTO: { value: string; label: string; icon: string }[] = [
  { value: 'combustible',        label: 'Combustible',            icon: '⛽' },
  { value: 'repuestos',          label: 'Repuestos',              icon: '🔩' },
  { value: 'mantenimiento',      label: 'Mantenimiento / taller', icon: '🔧' },
  { value: 'neumaticos',         label: 'Neumáticos',             icon: '🛞' },
  { value: 'peajes',             label: 'Peajes',                 icon: '🛣️' },
  { value: 'seguro_patente',     label: 'Seguro / patentes',      icon: '🛡️' },
  { value: 'chofer_adicionales', label: 'Chofer – adicionales',   icon: '👷' },
  { value: 'otros',              label: 'Otros',                  icon: '📦' },
]

export const etiquetaCategoria = (v: string) => CATEGORIAS_COSTO.find(c => c.value === v)?.label ?? v

export const n = (v: any) => Number(v ?? 0)

export const fmtUsd = (v: number | null | undefined) =>
  'USD ' + n(v).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const fmtNum = (v: number | null | undefined, dec = 1) =>
  n(v).toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })

export const fmtFecha = (f: string | null | undefined) => {
  if (!f) return '—'
  const [y, m, d] = f.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export const hoy = () => new Date().toISOString().split('T')[0]

export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export const claveMes = (f: string) => f.slice(0, 7) // YYYY-MM
export const claveTrimestre = (f: string) => {
  const y = f.slice(0, 4)
  const q = Math.floor((parseInt(f.slice(5, 7), 10) - 1) / 3) + 1
  return `${y}-T${q}`
}
export const etiquetaClave = (k: string) => {
  if (k.includes('T')) { const [y, t] = k.split('-'); return `${t} ${y}` }
  const [y, m] = k.split('-')
  return `${MESES[parseInt(m, 10) - 1]} ${y}`
}
