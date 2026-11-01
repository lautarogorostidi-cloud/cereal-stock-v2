// PostgREST (Supabase) devuelve como máximo 1000 filas por respuesta, aunque se pida
// .limit(10000), y lo hace en silencio. Esta función pide la consulta por páginas con
// .range() hasta traer todo. Devuelve { data, error } para poder reemplazar a
// `const { data } = await supabase.from(...).select(...)` sin cambiar el resto del código.
// La consulta debe llevar un .order() sobre una columna única (ej. 'id') para que las
// páginas no se pisen ni se salteen filas.
export async function fetchAllRows<T = any>(
  armarConsulta: () => any,
  tamanoPagina = 1000
): Promise<{ data: T[]; error: any }> {
  let todas: T[] = []
  let desde = 0
  while (true) {
    const { data, error } = await armarConsulta().range(desde, desde + tamanoPagina - 1)
    if (error) {
      console.error('Error paginando consulta:', error)
      return { data: todas, error }
    }
    const pagina = (data ?? []) as T[]
    todas = todas.concat(pagina)
    if (pagina.length < tamanoPagina) break
    desde += tamanoPagina
  }
  return { data: todas, error: null }
}
