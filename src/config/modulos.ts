// ============================================================
//  CONFIGURACIÓN CENTRAL DE MÓDULOS
//  Para agregar un módulo nuevo, solo añadí un objeto acá.
//  El selector lo muestra automáticamente.
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
    titulo: 'Cereal',
    descripcion: 'Stock, contratos, ventas, entregas y cartas de porte',
    activo: true,
    color: 'border-campo-600 hover:border-campo-400 hover:bg-campo-900',
    badgeColor: 'bg-campo-700 text-campo-100',
  },
  {
    href: '/agroquimicos',
    icon: '🧪',
    titulo: 'Agroquímicos',
    descripcion: 'Stock de productos, compras y aplicaciones por lote y campaña',
    activo: true,
    color: 'border-emerald-700 hover:border-emerald-500 hover:bg-emerald-950',
    badgeColor: 'bg-emerald-800 text-emerald-100',
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