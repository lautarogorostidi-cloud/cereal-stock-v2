import { createClient } from '@/lib/supabase/server'
import StockClient from './StockClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function StockPage() {
  const supabase = createClient()

  const [{ data: stock }, { data: comprometido }, { data: silos }, { data: campanias }] = await Promise.all([
    supabase.from('vw_stock_actual').select('*'),
    supabase.from('vw_comprometido').select('*'),
    supabase.from('vw_stock_silos').select('*'),
    supabase.from('campanias').select('*').order('nombre', { ascending: false }),
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

    return { ...r, ton_comprometidas_real, stock_fisico, margen, stock_campo, stock_acopio, silosCampo, silosAcopio, acopiosAgrupados }
  })

  // Campaña activa primero (para que el filtro arranque mostrando solo esa,
  // y así no se mezclen los cultivos de distintas campañas por defecto).
  const nombresCampanias = (campanias ?? [])
    .slice()
    .sort((a: any, b: any) => (a.activa === b.activa ? 0 : a.activa ? -1 : 1))
    .map((c: any) => c.nombre as string)

  return <StockClient rows={stockConComprometido} campanias={nombresCampanias} />
}
