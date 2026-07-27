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

  return (
    <DashboardClient
      stockData={stock ?? []}
      comprometidoData={comprometido ?? []}
      campanias={campanias ?? []}
      cultivos={cultivos ?? []}
    />
  )
}
