import { createClient } from '@/lib/supabase/server'
import CartasPorteClient from './CartasPorteClient'

export default async function CartasPortePage() {
  const supabase = createClient()

  const [{ data: cartas }, { data: contratos }] = await Promise.all([
    supabase
      .from('cartas_porte')
      .select(`*, campanias(nombre), cultivos(nombre), contratos(numero)`)
      .order('fecha_emision', { ascending: false })
      .limit(100),
    supabase
      .from('contratos')
      .select(`id, numero, cultivo_id, campania_id`)
      .in('estado', ['activo', 'parcial'])
      .order('numero', { ascending: false }),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Cartas de Porte</h1>
          <p className="text-campo-500 text-sm mt-0.5">Trazabilidad y seguimiento de granos (CPE)</p>
        </div>
        <a href="/dashboard/cartas-porte/nueva" className="btn-primary">+ Nueva carta de porte</a>
      </div>
      <CartasPorteClient cartas={cartas ?? []} contratos={contratos ?? []} />
    </div>
  )
}