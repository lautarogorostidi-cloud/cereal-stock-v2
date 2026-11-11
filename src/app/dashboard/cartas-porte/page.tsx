import { createClient } from '@/lib/supabase/server'
import CartasPorteClient from './CartasPorteClient'
import { obtenerMapaCultivoComercial } from '@/lib/cultivoComercial'
import { mapaTextoVariedad } from '@/lib/variedades'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CartasPortePage() {
  const supabase = createClient()
  const [{ data: cartas }, { data: contratos }, mapaCultivo, { data: variedadesCpe }] = await Promise.all([
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
    obtenerMapaCultivoComercial(supabase),
    supabase
      .from('cartas_porte_variedades')
      .select('carta_porte_id, toneladas_origen, variedades_cultivo(nombre, orden)'),
  ])

  const textoVariedad = mapaTextoVariedad(
    (variedadesCpe ?? []).map((v: any) => ({
      clave: v.carta_porte_id,
      variedad: v.variedades_cultivo?.nombre ?? '',
      toneladas: v.toneladas_origen,
      orden: v.variedades_cultivo?.orden,
    }))
  )

  const cartasResueltas = (cartas ?? []).map(c => ({
    ...c,
    cultivos: { nombre: mapaCultivo.get((c as any).cultivo_id) ?? (c.cultivos as any)?.nombre ?? null },
    variedad: textoVariedad.get((c as any).id) ?? null,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Cartas de Porte</h1>
          <p className="text-campo-500 text-sm mt-0.5">Trazabilidad y seguimiento de granos (CPE)</p>
        </div>
        <a href="/dashboard/cartas-porte/nueva" className="btn-primary">+ Nueva carta de porte</a>
      </div>
      <CartasPorteClient cartas={cartasResueltas} contratos={contratos ?? []} />
    </div>
  )
}