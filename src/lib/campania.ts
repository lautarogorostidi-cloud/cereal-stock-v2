// Campaña agrícola = 1 de septiembre al 31 de agosto, nombrada 'YY-YY' (ej. '26-27').

/** Campaña que corresponde a la fecha de hoy (por defecto) según el calendario sep-ago. */
export function campaniaActual(hoy: Date = new Date()): string {
  const anio = hoy.getFullYear()
  const inicio = hoy.getMonth() >= 8 ? anio : anio - 1 // getMonth(): septiembre = 8
  const yy = (n: number) => String(n % 100).padStart(2, '0')
  return `${yy(inicio)}-${yy(inicio + 1)}`
}

/**
 * Elige la campaña actual entre las que existen en la lista. Si la actual todavía no está cargada,
 * toma la más reciente que no sea posterior (nunca salta a una campaña futura como la 28-29).
 */
export function elegirCampaniaActual(nombres: string[]): string {
  const actual = campaniaActual()
  if (nombres.includes(actual)) return actual
  const ordenadas = [...nombres].sort()
  const anteriores = ordenadas.filter(n => n <= actual)
  return anteriores.length > 0 ? anteriores[anteriores.length - 1] : (ordenadas[0] ?? '')
}
