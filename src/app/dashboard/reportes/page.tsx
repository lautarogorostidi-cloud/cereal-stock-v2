import { createClient } from '@/lib/supabase/server'
import ReportesClient from './ReportesClient'
import { mapaTextoVariedad } from '@/lib/variedades'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ReportesPage() {
  const supabase = createClient()
  const [{ data: resultadosBase }, { data: cartas }, { data: variedadesCpe }] = await Promise.all([
    supabase.from('vw_resultado_comercial').select('*'),
    supabase.from('cartas_porte').select('id, ctg').not('ctg', 'is', null),
    supabase.from('cartas_porte_variedades').select('carta_porte_id, toneladas_origen, variedades_cultivo(nombre, orden)'),
  ])

  // Tipo de soja de cada carga (por CTG). Sin desglose cargado = soja común.
  const textoPorCpe = mapaTextoVariedad(
    (variedadesCpe ?? []).map((v: any) => ({
      clave: v.carta_porte_id,
      variedad: v.variedades_cultivo?.nombre ?? '',
      toneladas: v.toneladas_origen,
      orden: v.variedades_cultivo?.orden,
    }))
  )
  const textoPorCtg = new Map<string, string>()
  for (const c of cartas ?? []) {
    const t = textoPorCpe.get(c.id)
    if (t && c.ctg) textoPorCtg.set(String(c.ctg), t)
  }
  const resultados = (resultadosBase ?? []).map((r: any) => ({
    ...r,
    variedad: textoPorCtg.get(String(r.ctg ?? '')) ?? (String(r.cultivo ?? '').startsWith('Soja') ? 'Soja' : null),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-campo-900">Reportes</h1>
        <p className="text-campo-500 text-sm mt-0.5">Resultado comercial por campaña, cultivo y cliente</p>
      </div>
      <ReportesClient resultados={resultados} />
    </div>
  )
}