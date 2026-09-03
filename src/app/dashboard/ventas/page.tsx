import { createClient } from '@/lib/supabase/server'
import VentasClient from './VentasClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function VentasPage() {
  const supabase = createClient()

  const [{ data: movimientos }, { data: contratos }] = await Promise.all([
    supabase
      .from('movimientos_cereal')
      .select(`*, campanias(nombre), cultivos(nombre), contratos(numero, cliente_id, precio_unitario, precio_plus, comision_corredor, bonificacion_calidad), cartas_porte(ctg, bonificacion_calidad, tarifa_flete)`)
      .in('tipo', ['entrega', 'compra'])
      .order('fecha', { ascending: false })
      .limit(200),
    supabase
      .from('contratos')
      .select('id, numero, cultivo_id, clientes(razon_social)')
      .order('numero', { ascending: false })
  ])

  const clienteIds = Array.from(new Set((movimientos ?? []).flatMap(e => [(e.contratos as any)?.cliente_id, e.cliente_id]).filter(Boolean)))
  const { data: clientes } = clienteIds.length > 0
    ? await supabase.from('clientes').select('id, razon_social').in('id', clienteIds)
    : { data: [] }

  const clienteMap = Object.fromEntries((clientes ?? []).map(c => [c.id, c.razon_social]))

  const ventas = (movimientos ?? []).map(e => {
    // Precio: primero el del contrato (ventas con contrato), si no el que se
    // haya cargado directo en el movimiento (típico en compras, sin contrato).
    const precio_base = Number((e.contratos as any)?.precio_unitario ?? e.precio_unitario ?? 0)
    const precio_plus = Number((e.contratos as any)?.precio_plus ?? 0)
    const comision_pct = Number((e.contratos as any)?.comision_corredor ?? 0)
    const tarifa_flete = Number((e.cartas_porte as any)?.tarifa_flete ?? 0)
    const toneladas = Number(e.toneladas ?? 0)

    // Bonificación: primero carta de porte, luego movimiento, luego contrato
    const bonificacion =
      Number((e.cartas_porte as any)?.bonificacion_calidad ?? 0) ||
      Number((e as any).bonificacion_calidad ?? 0) ||
      Number((e.contratos as any)?.bonificacion_calidad ?? 0)

    const bonif_usd = precio_base * bonificacion / 100
    const comision_tn = (precio_base + precio_plus) * comision_pct / 100
    const total_tn = precio_base + bonif_usd + precio_plus - comision_tn - tarifa_flete
    const total_usd = total_tn * toneladas

    return {
      id: e.id,
      tipo: e.tipo,
      contrato_id: e.contrato_id,
      fecha: e.fecha,
      ctg: (e.cartas_porte as any)?.ctg ?? null,
      carta_porte_id: e.carta_porte_id,
      cultivo: (e.cultivos as any)?.nombre ?? null,
      campania: (e.campanias as any)?.nombre ?? null,
      toneladas: e.toneladas,
      descripcion_movimiento: e.descripcion_movimiento,
      observaciones: e.observaciones,
      cliente: clienteMap[(e.contratos as any)?.cliente_id] ?? clienteMap[e.cliente_id] ?? null,
      contrato: (e.contratos as any)?.numero ?? null,
      precio_base: precio_base || null,
      precio_plus: precio_plus || null,
      bonificacion: bonificacion || null,
      bonif_usd: bonif_usd || null,
      comision_tn: comision_tn || null,
      tarifa_flete: tarifa_flete || null,
      total_tn: total_tn || null,
      total_usd: total_usd || null,
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Ventas</h1>
          <p className="text-campo-500 text-sm mt-0.5">Ventas (entregas) y compras</p>
        </div>
        <a href="/dashboard/ventas/nuevo" className="btn-primary">+ Nuevo movimiento</a>
      </div>
      <VentasClient ventas={ventas} contratos={contratos ?? []} />
    </div>
  )
}