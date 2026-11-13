import { createClient } from '@/lib/supabase/server'
import VentasClient from './VentasClient'
import { obtenerMapaCultivoComercial } from '@/lib/cultivoComercial'
import { fetchAllRows } from '@/lib/supabase/fetchAll'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function VentasPage() {
  const supabase = createClient()

  const [{ data: movimientos }, { data: contratos }, mapaCultivo, { data: variedadesMov }] = await Promise.all([
    fetchAllRows(() =>
      supabase
        .from('movimientos_cereal')
        .select(`*, campanias(nombre), cultivos(nombre), lotes(nombre, establecimiento), contratos(numero, cliente_id, precio_unitario, precio_plus, comision_corredor, bonificacion_calidad), cartas_porte(ctg, bonificacion_calidad, tarifa_flete)`)
        .order('fecha', { ascending: false })
        .order('id', { ascending: false })
    ),
    supabase
      .from('contratos')
      .select('id, numero, cultivo_id, clientes(razon_social)')
      .order('numero', { ascending: false }),
    obtenerMapaCultivoComercial(supabase),
    // Tipo de soja de cada movimiento (común / DM 40E25 / DM 47E23, o mezcla)
    fetchAllRows(() =>
      supabase
        .from('vw_movimientos_variedad')
        .select('movimiento_id, variedad_id, variedad, es_comun, variedad_orden, toneladas')
        .order('movimiento_id')
        .order('variedad_id')
    ),
  ])

  const variedadPorMov = new Map<string, { variedad: string; es_comun: boolean; orden: number; toneladas: number }[]>()
  for (const v of variedadesMov ?? []) {
    const arr = variedadPorMov.get(v.movimiento_id) ?? []
    arr.push({ variedad: v.variedad, es_comun: !!v.es_comun, orden: Number(v.variedad_orden ?? 0), toneladas: Math.abs(Number(v.toneladas ?? 0)) })
    variedadPorMov.set(v.movimiento_id, arr)
  }
  const textoVariedad = (movId: string): string | null => {
    const partes = (variedadPorMov.get(movId) ?? []).slice().sort((a, b) => a.orden - b.orden)
    if (partes.length === 0) return null
    if (partes.length === 1) return partes[0].variedad
    return partes
      .map(p => `${p.variedad} ${p.toneladas.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`)
      .join(' + ')
  }

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
    const toneladas = Number(e.toneladas ?? 0)
    // Si no hay carta de porte con tarifa por tonelada, usar el flete total cargado
    // directo en el movimiento (mismo que alimenta resultado_neto en movimientos_cereal)
    const tarifa_flete_cp = Number((e.cartas_porte as any)?.tarifa_flete ?? 0)
    const tarifa_flete = tarifa_flete_cp || (toneladas > 0 ? Number(e.flete ?? 0) / toneladas : 0)

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
      cultivo: mapaCultivo.get(e.cultivo_id) ?? (e.cultivos as any)?.nombre ?? null,
      campania: (e.campanias as any)?.nombre ?? null,
      lote: (e.lotes as any)?.nombre ? `${(e.lotes as any).nombre}${(e.lotes as any).establecimiento ? ' — ' + (e.lotes as any).establecimiento : ''}` : null,
      toneladas: e.toneladas,
      variedad: textoVariedad(e.id),
      descripcion_movimiento: e.descripcion_movimiento,
      observaciones: e.observaciones,
      // valores crudos del movimiento (para editarlos)
      humedad: e.humedad,
      precio_mov: e.precio_unitario,
      flete_total: e.flete,
      secado: e.secado,
      paritaria: e.paritaria,
      otros_gastos: e.otros_gastos,
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
          <h1 className="text-2xl font-bold text-campo-900">Movimientos</h1>
          <p className="text-campo-500 text-sm mt-0.5">Ventas, compras, ajustes y otros movimientos de cereal</p>
        </div>
        <a href="/dashboard/ventas/nuevo" className="btn-primary">+ Nuevo movimiento</a>
      </div>
      <VentasClient ventas={ventas} contratos={contratos ?? []} />
    </div>
  )
}