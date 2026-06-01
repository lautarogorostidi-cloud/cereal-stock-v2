import { createClient } from '@/lib/supabase/server'
import EntregasClient from './EntregasClient'

export default async function EntregasPage() {
  const supabase = createClient()

  const { data: movimientos } = await supabase
    .from('movimientos_cereal')
    .select(`
      *,
      campanias(nombre),
      cultivos(nombre),
      contratos(numero, clientes(razon_social)),
      cartas_porte(ctg)
    `)
    .eq('tipo', 'entrega')
    .order('fecha', { ascending: false })
    .limit(200)

  const entregas = (movimientos ?? []).map(e => ({
    id: e.id,
    fecha: e.fecha,
    ctg: (e.cartas_porte as any)?.ctg ?? null,
    carta_porte_id: e.carta_porte_id,
    cultivo: (e.cultivos as any)?.nombre ?? null,
    campania: (e.campanias as any)?.nombre ?? null,
    toneladas: e.toneladas,
    cliente: (e.contratos as any)?.clientes?.razon_social ?? null,
    contrato: (e.contratos as any)?.numero ?? null,
    descripcion_movimiento: e.descripcion_movimiento,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Entregas</h1>
          <p className="text-campo-500 text-sm mt-0.5">Historial de entregas realizadas</p>
        </div>
      </div>
      <EntregasClient entregas={entregas} />
    </div>
  )
}