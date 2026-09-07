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
    color: 'border-lime-400 bg-lime-500/20 hover:bg-lime-500/30',
    badgeColor: 'bg-lime-400 text-lime-950 font-semibold',
  },
  {
    href: '/agroquimicos',
    icon: '🧪',
    titulo: 'Agroquímicos',
    descripcion: 'Stock de productos, compras y aplicaciones por lote y campaña',
    activo: true,
    color: 'border-lime-400 bg-lime-500/20 hover:bg-lime-500/30',
    badgeColor: 'bg-lime-400 text-lime-950 font-semibold',
  },
  {
    href: '/seguimiento',
    icon: '🌱',
    titulo: 'Seguimiento Agronómico',
    descripcion: 'Trazabilidad por lote: siembra, aplicaciones, cosecha y costos',
    activo: true,
    color: 'border-lime-400 bg-lime-500/20 hover:bg-lime-500/30',
    badgeColor: 'bg-lime-400 text-lime-950 font-semibold',
  },
  {
    href: '/ganaderia',
    icon: '🐄',
    titulo: 'Ganadería',
    descripcion: 'Stock de hacienda por categoría y costos ganaderos por campo',
    activo: true,
    color: 'border-lime-400 bg-lime-500/20 hover:bg-lime-500/30',
    badgeColor: 'bg-lime-400 text-lime-950 font-semibold',
  },
  {
    href: '/semillas',
    icon: '🌱',
    titulo: 'Semillas',
    descripcion: 'Stock de semillas, compras y uso por siembra',
    activo: true,
    color: 'border-lime-400 bg-lime-500/20 hover:bg-lime-500/30',
    badgeColor: 'bg-lime-400 text-lime-950 font-semibold',
  },
  {
    href: '/fertilizantes',
    icon: '🧱',
    titulo: 'Fertilizantes',
    descripcion: 'Stock de fertilizantes, compras y costos por cultivo',
    activo: true,
    color: 'border-lime-400 bg-lime-500/20 hover:bg-lime-500/30',
    badgeColor: 'bg-lime-400 text-lime-950 font-semibold',
  },
  {
    href: '/combustible',
    icon: '⛽',
    titulo: 'Combustible',
    descripcion: 'Stock de tanques, cargas a maquinaria y consumo por vehículo',
    activo: true,
    color: 'border-lime-400 bg-lime-500/20 hover:bg-lime-500/30',
    badgeColor: 'bg-lime-400 text-lime-950 font-semibold',
  },
]
