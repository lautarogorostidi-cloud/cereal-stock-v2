// Helper compartido para vincular movimientos de salida (CPE, ventas, entregas,
// consumo, merma, otros egresos) al silo/acopio de origen, de modo que el stock
// por silo (vw_stock_silos) descuente correctamente en vez de quedar fijo en lo
// ingresado.
//
// Patrón: cuando el usuario reparte una salida entre uno o más silos/acopios,
// se crea UN movimiento_cereal por cada origen (igual que hace la cosecha con
// sus destinos) y se registra el vínculo en movimiento_cereal_origenes.
// Si no se especifica ningún origen, se crea un único movimiento "genérico"
// (comportamiento anterior, sin descuento de silo puntual).

import type { SupabaseClient } from '@supabase/supabase-js'

export type SiloDisponible = {
  destino_id: string
  ubicacion: 'campo' | 'acopio'
  silo_nombre: string | null
  acopio_nombre: string | null
  acopio_cliente_id: string | null
  toneladas_ingresadas: number
  toneladas_egresadas: number
  stock_actual: number
}

export type OrigenSeleccionado = {
  id: string
  destino_id: string
  ubicacion: 'campo' | 'acopio'
  etiqueta: string
  acopio_cliente_id: string | null
  disponible: number
  toneladas: string
}

export async function cargarSilosDisponibles(
  supabase: SupabaseClient,
  campaniaNombre: string,
  cultivoId: string
): Promise<SiloDisponible[]> {
  if (!campaniaNombre || !cultivoId) return []
  // Se filtra por cultivo_comercial_id (no por cultivo puntual): así, al elegir
  // "Soja" o "Maíz" en una venta/CPE, aparecen los silos cargados bajo Soja 1,
  // Soja 2, Maíz Temprano, Maíz Tardío o Maíz 2 (el módulo de Seguimiento sigue
  // registrando la cosecha por variante específica).
  const { data } = await supabase
    .from('vw_stock_silos')
    .select('destino_id, ubicacion, silo_nombre, acopio_nombre, acopio_cliente_id, toneladas_ingresadas, toneladas_egresadas, stock_actual')
    .eq('campania', campaniaNombre)
    .eq('cultivo_comercial_id', cultivoId)
  return (data ?? []) as SiloDisponible[]
}

export function etiquetaSilo(s: SiloDisponible): string {
  return s.ubicacion === 'acopio' ? (s.acopio_nombre ?? 'Acopio') : (s.silo_nombre ?? 'Campo')
}

export function origenesValidos(origenes: OrigenSeleccionado[]): OrigenSeleccionado[] {
  return origenes.filter(o => o.destino_id && Number(o.toneladas) > 0)
}

export function totalOrigenes(origenes: OrigenSeleccionado[]): number {
  return origenesValidos(origenes).reduce((s, o) => s + (Number(o.toneladas) || 0), 0)
}

/**
 * Crea los movimientos de cereal (uno por origen seleccionado) y sus vínculos
 * en movimiento_cereal_origenes. Si `origenes` viene vacío, crea un único
 * movimiento con `basePayload` tal cual (sin vínculo a silo puntual).
 *
 * `basePayload` NO debe incluir toneladas, ubicacion ni acopio_cliente_id:
 * esos campos los completa esta función por cada origen.
 *
 * `camposAProrratear` lista claves de `basePayload` que representan un monto
 * TOTAL de la operación (flete, secado, otros gastos) y no una tarifa por
 * tonelada: cuando se reparte entre varios orígenes, cada movimiento se queda
 * con su parte proporcional para no contar el gasto completo varias veces.
 * Los campos que ya son una tarifa por tonelada (precio_unitario) no deben
 * incluirse acá.
 */
export async function crearMovimientosConOrigen(
  supabase: SupabaseClient,
  origenes: OrigenSeleccionado[],
  basePayload: Record<string, any>,
  toneladasSinOrigen: number,
  camposAProrratear: string[] = []
): Promise<{ error: string | null; movimientoIds: string[] }> {
  const validos = origenesValidos(origenes)
  const movimientoIds: string[] = []

  if (validos.length === 0) {
    const { data, error } = await supabase
      .from('movimientos_cereal')
      .insert({ ...basePayload, toneladas: toneladasSinOrigen, ubicacion: 'campo' })
      .select('id')
      .single()
    if (error) return { error: error.message, movimientoIds }
    movimientoIds.push(data.id)
    return { error: null, movimientoIds }
  }

  const totalTn = totalOrigenes(validos)

  for (const o of validos) {
    const tn = Number(o.toneladas)
    const factor = totalTn > 0 ? tn / totalTn : 0
    const prorrateo: Record<string, any> = {}
    for (const campo of camposAProrratear) {
      if (basePayload[campo] != null) prorrateo[campo] = Number(basePayload[campo]) * factor
    }

    const { data: mov, error: errMov } = await supabase
      .from('movimientos_cereal')
      .insert({
        ...basePayload,
        ...prorrateo,
        toneladas: tn,
        ubicacion: o.ubicacion,
        acopio_cliente_id: o.ubicacion === 'acopio' ? o.acopio_cliente_id : null,
      })
      .select('id')
      .single()
    if (errMov) return { error: errMov.message, movimientoIds }
    movimientoIds.push(mov.id)

    const { error: errLink } = await supabase
      .from('movimiento_cereal_origenes')
      .insert({ movimiento_id: mov.id, cosecha_destino_id: o.destino_id, toneladas: tn })
    if (errLink) return { error: errLink.message, movimientoIds }
  }

  return { error: null, movimientoIds }
}

/**
 * Para flujos donde el movimiento de cereal ya existe (p.ej. lo crea un
 * trigger de la base al guardar una carta de porte, recién cuando se carga
 * el peso de descarga): vincula ese movimiento a los orígenes seleccionados
 * en movimiento_cereal_origenes, y si el origen es homogéneo (un solo silo,
 * o varios del mismo tipo/acopio) también deja la ubicación/acopio del
 * movimiento reflejando de dónde salió.
 *
 * Idempotente: primero borra cualquier vínculo previo de ese movimiento antes
 * de insertar los nuevos, para poder llamarse de nuevo sin duplicar si el
 * origen se corrige en una edición posterior.
 */
export async function vincularOrigenesAMovimiento(
  supabase: SupabaseClient,
  movimientoId: string,
  origenes: OrigenSeleccionado[]
): Promise<{ error: string | null }> {
  const { error: errClear } = await supabase.from('movimiento_cereal_origenes').delete().eq('movimiento_id', movimientoId)
  if (errClear) return { error: errClear.message }

  const validos = origenesValidos(origenes)
  if (validos.length === 0) {
    const { error: errReset } = await supabase.from('movimientos_cereal').update({ ubicacion: 'campo', acopio_cliente_id: null }).eq('id', movimientoId)
    return { error: errReset?.message ?? null }
  }

  const ubicaciones = new Set(validos.map(o => o.ubicacion))
  if (ubicaciones.size === 1) {
    const ubicacion = validos[0].ubicacion
    const acopios = new Set(validos.map(o => o.acopio_cliente_id ?? ''))
    const acopio_cliente_id = ubicacion === 'acopio' && acopios.size === 1 ? validos[0].acopio_cliente_id : null
    const { error: errUbic } = await supabase
      .from('movimientos_cereal')
      .update({ ubicacion, acopio_cliente_id })
      .eq('id', movimientoId)
    if (errUbic) return { error: errUbic.message }
  }

  const { error } = await supabase
    .from('movimiento_cereal_origenes')
    .insert(validos.map(o => ({ movimiento_id: movimientoId, cosecha_destino_id: o.destino_id, toneladas: Number(o.toneladas) })))
  return { error: error?.message ?? null }
}

/**
 * Guarda (reemplazando lo anterior) el origen elegido para una carta de porte
 * en carta_porte_origenes, INDEPENDIENTEMENTE de si ya existe un movimiento de
 * stock para esa CPE. Esto es necesario porque el movimiento recién se crea
 * cuando se carga el peso de descarga (sección G) — normalmente en una edición
 * posterior — y no queremos perder la elección de origen hecha al emitir.
 */
export async function guardarOrigenesCPE(
  supabase: SupabaseClient,
  cartaPorteId: string,
  origenes: OrigenSeleccionado[]
): Promise<{ error: string | null }> {
  const { error: errClear } = await supabase.from('carta_porte_origenes').delete().eq('carta_porte_id', cartaPorteId)
  if (errClear) return { error: errClear.message }

  const validos = origenesValidos(origenes)
  if (validos.length === 0) return { error: null }

  const { error } = await supabase
    .from('carta_porte_origenes')
    .insert(validos.map(o => ({ carta_porte_id: cartaPorteId, cosecha_destino_id: o.destino_id, toneladas: Number(o.toneladas) })))
  return { error: error?.message ?? null }
}

/**
 * Reconstruye la selección de orígenes guardada para una CPE (para
 * precargar el formulario de edición), cruzando con el stock disponible
 * actual de cada silo/acopio.
 */
export async function cargarOrigenesCPE(
  supabase: SupabaseClient,
  cartaPorteId: string
): Promise<OrigenSeleccionado[]> {
  const { data } = await supabase
    .from('carta_porte_origenes')
    .select('id, toneladas, cosecha_destino_id, cosecha_destinos(ubicacion, nombre, acopio_cliente_id, clientes(razon_social))')
    .eq('carta_porte_id', cartaPorteId)
  if (!data || data.length === 0) return []

  // Traer el stock_actual real de cada destino involucrado
  const destinoIds = data.map((r: any) => r.cosecha_destino_id)
  const { data: silos } = await supabase
    .from('vw_stock_silos')
    .select('destino_id, stock_actual')
    .in('destino_id', destinoIds)
  const disponiblePorDestino = Object.fromEntries((silos ?? []).map((s: any) => [s.destino_id, Number(s.stock_actual)]))

  return data.map((r: any) => {
    const cd = r.cosecha_destinos
    const ubicacion: 'campo' | 'acopio' = cd?.ubicacion ?? 'campo'
    const etiqueta = ubicacion === 'acopio' ? (cd?.clientes?.razon_social ?? 'Acopio') : (cd?.nombre ?? 'Campo')
    return {
      id: r.id,
      destino_id: r.cosecha_destino_id,
      ubicacion,
      etiqueta,
      acopio_cliente_id: cd?.acopio_cliente_id ?? null,
      disponible: disponiblePorDestino[r.cosecha_destino_id] ?? 0,
      toneladas: String(r.toneladas),
    }
  })
}
