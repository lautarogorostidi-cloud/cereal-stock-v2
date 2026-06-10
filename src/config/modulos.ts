// ============================================================
//  CONFIGURACIÓN CENTRAL DE MÓDULOS
// ============================================================

export interface Modulo {
  href: string
  icon: string
  titulo: string
  descripcion: string
  activo: boolean
  color: string
  badgeColor: string
}

export const MODULOS: Modulo[] = [
  {
    href: '/dashboard',
    icon: '🌾',
    titulo: 'Stock Cereal',
    descripcion: 'Stock, contratos, ventas, entregas y cartas de porte',
    activo: true,
    color: 'border-lime-700 hover:border-lime-500 hover:bg-lime-950',
    badgeColor: 'bg-lime-800 text-lime-100',
  },
  {
    href: '/agroquimicos',
    icon: '🧪',
    titulo: 'Agroquímicos',
    descripcion: 'Stock de productos, compras y aplicaciones por lote y campaña',
    activo: true,
    color: 'border-lime-700 hover:border-lime-500 hover:bg-lime-950',
    badgeColor: 'bg-lime-800 text-lime-100',
  },
  {
    href: '/seguimiento',
    icon: '🌱',
    titulo: 'Seguimiento Agronómico',
    descripcion: 'Trazabilidad por lote: siembra, aplicaciones, cosecha y costos',
    activo: true,
    color: 'border-lime-700 hover:border-lime-500 hover:bg-lime-950',
    badgeColor: 'bg-lime-800 text-lime-100',
  },
  {
    href: '/semillas',
    icon: '🌱',
    titulo: 'Semillas',
    descripcion: 'Próximamente disponible',
    activo: false,
    color: 'border-campo-800 opacity-50 cursor-not-allowed',
    badgeColor: 'bg-campo-800 text-campo-400',
  },
  {
    href: '/fertilizantes',
    icon: '🧱',
    titulo: 'Fertilizantes',
    descripcion: 'Próximamente disponible',
    activo: false,
    color: 'border-campo-800 opacity-50 cursor-not-allowed',
    badgeColor: 'bg-campo-800 text-campo-400',
  },
  {
    href: '/combustible',
    icon: '⛽',
    titulo: 'Combustible',
    descripcion: 'Próximamente disponible',
    activo: false,
    color: 'border-campo-800 opacity-50 cursor-not-allowed',
    badgeColor: 'bg-campo-800 text-campo-400',
  },
]
