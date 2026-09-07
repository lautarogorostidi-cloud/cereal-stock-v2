import { createClient } from '@/lib/supabase/server'
import DashboardClient from '@/components/charts/DashboardClient'

// Siempre traer datos frescos (contratos, stock) en cada visita, nunca una version cacheada
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardPage() {
  const supabase = createClient()

  const [{ data: stock }, { data: comprometido }, { data: campanias }, { data: cultivos }] = await Promise.all([
    supabase.from('vw_stock_actual').select('*'),
    supabase.from('vw_comprometido').select('*'),
    supabase.from('campanias').select('*').order('nombre', { ascending: false }),
    supabase.from('cultivos').select('*').eq('activo', true).order('nombre'),
  ])

  // "Sin Siembra" y "Vicia + Avena" son conceptos de Seguimiento Agronómico (lotes en
  // barbecho o con cobertura mixta), no cultivos que se comercialicen: se ocultan acá
  // para no ensuciar el filtro del Dashboard Comercial. No se tocan en la tabla maestra.
  const cultivosComerciales = (cultivos ?? []).filter(
    c => c.nombre !== 'Sin Siembra' && c.nombre !== 'Vicia + Avena'
  )

  return (
    <DashboardClient
      stockData={stock ?? []}
      comprometidoData={comprometido ?? []}
      campanias={campanias ?? []}
      cultivos={cultivosComerciales}
    />
  )
}
