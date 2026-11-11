import type { SupabaseClient } from '@supabase/supabase-js'

// Variedades / tecnologías de un cultivo comercial (hoy sólo Soja: Común,
// DM 40E25, DM 47E23). La lista es editable en la tabla variedades_cultivo.

export type Variedad = {
  id: string
  cultivo_id: string
  nombre: string
  tecnologia: string | null
  es_comun: boolean
  activo: boolean
  orden: number
}

/** Valores de una mezcla: variedad_id -> toneladas (texto del input). */
export type MezclaVariedades = Record<string, string>

/** Devuelve el id del cultivo comercial de un cultivo (Soja 1 -> Soja). */
export async function cultivoComercialId(supabase: SupabaseClient, cultivoId: string): Promise<string> {
  if (!cultivoId) return ''
  const { data } = await supabase.from('cultivos').select('id, cultivo_comercial_id').eq('id', cultivoId).maybeSingle()
  return data?.cultivo_comercial_id ?? data?.id ?? cultivoId
}

/** Variedades activas del cultivo (por id de cultivo comercial o específico). Vacío si el cultivo no tiene variedades. */
export async function cargarVariedades(supabase: SupabaseClient, cultivoId: string): Promise<Variedad[]> {
  if (!cultivoId) return []
  const comercial = await cultivoComercialId(supabase, cultivoId)
  const { data } = await supabase
    .from('variedades_cultivo')
    .select('*')
    .eq('cultivo_id', comercial)
    .eq('activo', true)
    .order('orden')
  return (data ?? []) as Variedad[]
}

export function totalMezcla(m: MezclaVariedades): number {
  return Object.values(m).reduce((s, v) => s + (Number(v) || 0), 0)
}

/** ¿La mezcla tiene alguna variedad distinta de la común con toneladas? */
export function tieneVariedadEspecial(m: MezclaVariedades, variedades: Variedad[]): boolean {
  return variedades.some(v => !v.es_comun && Number(m[v.id]) > 0)
}

// ── Carta de porte ──────────────────────────────────────────────────────────

export async function cargarMezclaCPE(supabase: SupabaseClient, cartaPorteId: string): Promise<MezclaVariedades> {
  const { data } = await supabase
    .from('cartas_porte_variedades')
    .select('variedad_id, toneladas_origen')
    .eq('carta_porte_id', cartaPorteId)
  const m: MezclaVariedades = {}
  for (const r of data ?? []) m[r.variedad_id] = String(r.toneladas_origen)
  return m
}

/** Reemplaza el desglose por variedad de una CPE. Mezcla vacía = todo común (sin filas). */
export async function guardarMezclaCPE(
  supabase: SupabaseClient,
  cartaPorteId: string,
  mezcla: MezclaVariedades
): Promise<{ error: string | null }> {
  const { error: errClear } = await supabase.from('cartas_porte_variedades').delete().eq('carta_porte_id', cartaPorteId)
  if (errClear) return { error: errClear.message }
  const filas = Object.entries(mezcla)
    .filter(([, tn]) => Number(tn) > 0)
    .map(([variedad_id, tn]) => ({ carta_porte_id: cartaPorteId, variedad_id, toneladas_origen: Number(tn) }))
  if (filas.length === 0) return { error: null }
  const { error } = await supabase.from('cartas_porte_variedades').insert(filas)
  return { error: error?.message ?? null }
}

// ── Movimientos (compras, ventas, otros) ────────────────────────────────────

export async function cargarMezclaMovimiento(supabase: SupabaseClient, movimientoId: string): Promise<MezclaVariedades> {
  const { data } = await supabase
    .from('movimientos_cereal_variedades')
    .select('variedad_id, toneladas')
    .eq('movimiento_id', movimientoId)
  const m: MezclaVariedades = {}
  for (const r of data ?? []) m[r.variedad_id] = String(r.toneladas)
  return m
}

/**
 * Guarda el desglose por variedad de uno o varios movimientos creados a partir
 * de una misma operación. Si la operación se repartió en varios movimientos
 * (varios silos), cada uno se queda con la misma proporción de la mezcla.
 */
export async function guardarMezclaMovimientos(
  supabase: SupabaseClient,
  movimientos: { id: string; toneladas: number }[],
  mezcla: MezclaVariedades
): Promise<{ error: string | null }> {
  const partes = Object.entries(mezcla).filter(([, tn]) => Number(tn) > 0)
  const total = partes.reduce((s, [, tn]) => s + Number(tn), 0)
  for (const mov of movimientos) {
    const { error: errClear } = await supabase.from('movimientos_cereal_variedades').delete().eq('movimiento_id', mov.id)
    if (errClear) return { error: errClear.message }
    if (partes.length === 0 || total <= 0) continue
    const filas = partes.map(([variedad_id, tn]) => ({
      movimiento_id: mov.id,
      variedad_id,
      toneladas: Math.abs(mov.toneladas) * (Number(tn) / total),
    }))
    const { error } = await supabase.from('movimientos_cereal_variedades').insert(filas)
    if (error) return { error: error.message }
  }
  return { error: null }
}

// ── Presentación ────────────────────────────────────────────────────────────

/**
 * A partir de filas de vw_movimientos_variedad (o cualquier lista con
 * `clave`, `variedad`, `toneladas`, `orden`) arma un texto por clave:
 * "DM 40E25" si es una sola variedad, o "DM 40E25 20 + Soja común 10" si es mezcla.
 */
export function mapaTextoVariedad(
  filas: { clave: string; variedad: string; toneladas: number | string | null; orden?: number | string | null }[]
): Map<string, string> {
  const porClave = new Map<string, { variedad: string; toneladas: number; orden: number }[]>()
  for (const f of filas) {
    const arr = porClave.get(f.clave) ?? []
    arr.push({ variedad: f.variedad, toneladas: Math.abs(Number(f.toneladas ?? 0)), orden: Number(f.orden ?? 0) })
    porClave.set(f.clave, arr)
  }
  const out = new Map<string, string>()
  for (const [clave, partes] of porClave) {
    const ordenadas = partes.slice().sort((a, b) => a.orden - b.orden)
    out.set(
      clave,
      ordenadas.length === 1
        ? ordenadas[0].variedad
        : ordenadas.map(p => `${p.variedad} ${p.toneladas.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`).join(' + ')
    )
  }
  return out
}
