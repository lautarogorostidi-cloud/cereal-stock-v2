import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Devuelve un mapa cultivo_id -> nombre a mostrar en pantallas comerciales
 * (Ventas, Entregas, Cartas de Porte). Si el cultivo tiene un
 * cultivo_comercial_id asignado (ej: "Soja 1" -> "Soja"), se usa el nombre
 * del cultivo comercial en vez del específico, para que todo se muestre
 * agrupado como Soja / Maíz. Seguimiento agronómico no usa este mapa: ahí
 * siempre se debe seguir mostrando la variedad específica.
 */
export async function obtenerMapaCultivoComercial(supabase: SupabaseClient): Promise<Map<string, string>> {
  const { data } = await supabase.from('cultivos').select('id, nombre, cultivo_comercial_id')
  const porId = new Map((data ?? []).map((c: any) => [c.id, c]))
  const mapa = new Map<string, string>()
  for (const c of data ?? []) {
    if (c.cultivo_comercial_id) {
      const comercial = porId.get(c.cultivo_comercial_id)
      mapa.set(c.id, comercial?.nombre ?? c.nombre)
    } else {
      mapa.set(c.id, c.nombre)
    }
  }
  return mapa
}
