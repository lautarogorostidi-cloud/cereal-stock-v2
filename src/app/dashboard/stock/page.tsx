import { createClient } from '@/lib/supabase/server'
import StockClient from './StockClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function StockPage() {
  const supabase = createClient()

  const [{ data: stock }, { data: comprometido }, { data: silos }, { data: campanias }, { data: stockVar }, { data: compVar }, { data: destVar }, { data: variedadesCat }] = await Promise.all([
    supabase.from('vw_stock_actual').select('*'),
    supabase.from('vw_comprometido').select('*'),
    supabase.from('vw_stock_silos').select('*'),
    supabase.from('campanias').select('*').order('nombre', { ascending: false }),
    supabase.from('vw_stock_actual_variedad').select('*').order('variedad_orden'),
    supabase.from('vw_comprometido_variedad').select('*'),
    supabase.from('vw_stock_por_destino_variedad').select('*'),
    supabase.from('variedades_cultivo').select('*').eq('activo', true).order('orden'),
  ])

  const stockConComprometido = (stock ?? []).map(r => {
    const comp = (comprometido ?? []).find(
      c => c.campania === r.campania && c.cultivo === r.cultivo
    )
    const ton_comprometidas_real = Number(comp?.ton_comprometidas ?? 0)
    const stock_fisico = Number(r.ton_ingresadas ?? 0) - Number(r.ton_salidas ?? 0)
    const margen = stock_fisico - ton_comprometidas_real
    const stock_campo = Number(r.stock_campo ?? 0)
    const stock_acopio = Number(r.stock_acopio ?? 0)

    // Silos de esta fila (vw_stock_silos guarda el cultivo específico -Soja 1,
    // Maíz Temprano, etc.-, por eso se cruza por cultivo_comercial, no por cultivo)
    const silosRow = (silos ?? []).filter(
      s => s.campania === r.campania && s.cultivo_comercial === r.cultivo
    )
    const silosCampo = silosRow.filter(s => s.ubicacion === 'campo')
    const silosAcopio = silosRow.filter(s => s.ubicacion === 'acopio')

    // Un mismo acopio (Fedea, Morero, etc.) puede tener mercadería de varias
    // cargas/lotes distintos (cada uno es un registro de vw_stock_silos): acá
    // se suman todas las cargas de un mismo acopio en una sola línea, para
    // mostrar cuánto hay en total en cada acopio, no una línea por carga.
    const acopiosPorCliente = new Map<string, { nombre: string; total: number }>()
    for (const s of silosAcopio) {
      const key = s.acopio_cliente_id ?? s.acopio_nombre ?? 'acopio'
      const prev = acopiosPorCliente.get(key)
      const monto = Number(s.stock_actual)
      if (prev) prev.total += monto
      else acopiosPorCliente.set(key, { nombre: s.acopio_nombre ?? 'Acopio', total: monto })
    }
    const acopiosAgrupados = Array.from(acopiosPorCliente.values())

    // Desglose por variedad / tecnología (sólo cultivos que tienen variedades, ej. soja)
    const variedadesRow = (stockVar ?? [])
      .filter((v: any) => v.campania === r.campania && v.cultivo === r.cultivo)
      .map((v: any) => {
        const comp = (compVar ?? []).find((c: any) => c.campania === r.campania && c.cultivo === r.cultivo && c.variedad_id === v.variedad_id)
        return {
          variedad_id: v.variedad_id as string,
          variedad: v.variedad as string,
          es_comun: !!v.es_comun,
          ton_ingresadas: Number(v.ton_ingresadas ?? 0),
          ton_entregadas: Number(v.ton_entregadas ?? 0),
          stock_fisico: Number(v.stock_fisico ?? 0),
          stock_campo: Number(v.stock_campo ?? 0),
          stock_acopio: Number(v.stock_acopio ?? 0),
          comprometido: Number(comp?.ton_comprometidas ?? 0),
        }
      })
      .filter((v: any) => Math.abs(v.stock_fisico) > 0.0001 || v.ton_ingresadas > 0.0001 || v.ton_entregadas > 0.0001)
    // Contratos que no piden una variedad en particular
    const compSinVariedad = (compVar ?? [])
      .filter((c: any) => c.campania === r.campania && c.cultivo === r.cultivo && !c.variedad_id)
      .reduce((sum: number, c: any) => sum + Number(c.ton_comprometidas ?? 0), 0)
    const destinosVariedad = (destVar ?? []).filter((d: any) => d.campania === r.campania && d.cultivo === r.cultivo)

    return { ...r, ton_comprometidas_real, stock_fisico, margen, stock_campo, stock_acopio, silosCampo, silosAcopio, acopiosAgrupados, variedades: variedadesRow, compSinVariedad, destinosVariedad }
  })

  // Campaña activa primero (para que el filtro arranque mostrando solo esa,
  // y así no se mezclen los cultivos de distintas campañas por defecto).
  const nombresCampanias = (campanias ?? [])
    .slice()
    .sort((a: any, b: any) => (a.activa === b.activa ? 0 : a.activa ? -1 : 1))
    .map((c: any) => c.nombre as string)

  const campaniasIds = Object.fromEntries((campanias ?? []).map((c: any) => [c.nombre as string, c.id as string]))

  return (
    <StockClient
      rows={stockConComprometido}
      campanias={nombresCampanias}
      campaniasIds={campaniasIds}
      variedadesCat={variedadesCat ?? []}
    />
  )
}
