'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// =====================================================================
// Tipos
// =====================================================================

type Campo = {
  id: number
  nombre: string
}

type CategoriaHacienda = {
  id: string
  nombre: string
  orden: number
}

type StockRow = {
  campo_id: number
  campo_nombre: string
  categoria_id: string
  categoria_nombre: string
  categoria_orden: number
  stock_actual: number
}

type StockPorCampo = {
  campo_nombre: string
  filas: StockRow[]
  total: number
}

// Tipo "lógico" que muestra el usuario en el selector. Recategorización se
// resuelve internamente como dos movimientos vinculados.
type TipoMovimientoUI =
  | 'compra'
  | 'venta'
  | 'nacimiento'
  | 'muerte'
  | 'recategorizacion'
  | 'ajuste_positivo'
  | 'ajuste_negativo'

const TIPOS_MOVIMIENTO: { value: TipoMovimientoUI; label: string }[] = [
  { value: 'compra', label: 'Compra' },
  { value: 'venta', label: 'Venta' },
  { value: 'nacimiento', label: 'Nacimiento' },
  { value: 'muerte', label: 'Muerte / Desaparecido' },
  { value: 'recategorizacion', label: 'Recategorización' },
  { value: 'ajuste_positivo', label: 'Ajuste (suma)' },
  { value: 'ajuste_negativo', label: 'Ajuste (resta)' },
]

const REQUIERE_PRECIO: TipoMovimientoUI[] = ['compra', 'venta']

// =====================================================================
// Página
// =====================================================================

export default function GanaderiaPage() {
  const supabase = createClient()

  // ---- Datos de catálogo ----
  const [campos, setCampos] = useState<Campo[]>([])
  const [categorias, setCategorias] = useState<CategoriaHacienda[]>([])

  // ---- Formulario ----
  const [campoId, setCampoId] = useState<string>('')
  const [tipo, setTipo] = useState<TipoMovimientoUI>('compra')
  const [categoriaId, setCategoriaId] = useState<string>('')
  const [categoriaDestinoId, setCategoriaDestinoId] = useState<string>('')
  const [cantidad, setCantidad] = useState<string>('')
  const [precioCabeza, setPrecioCabeza] = useState<string>('')
  const [fecha, setFecha] = useState<string>(
    new Date().toISOString().slice(0, 10)
  )
  const [observaciones, setObservaciones] = useState<string>('')

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)

  // ---- Stock ----
  const [stock, setStock] = useState<StockPorCampo[]>([])
  const [cargandoStock, setCargandoStock] = useState(true)
  const [errorStock, setErrorStock] = useState<string | null>(null)

  // ---- Carga inicial de catálogos ----
  useEffect(() => {
    const cargarCatalogos = async () => {
      const [{ data: camposData }, { data: categoriasData }] =
        await Promise.all([
          supabase.from('campos').select('id, nombre').order('nombre'),
          supabase
            .from('categorias_hacienda')
            .select('id, nombre, orden')
            .order('orden'),
        ])

      setCampos(camposData ?? [])
      setCategorias(categoriasData ?? [])
    }

    cargarCatalogos()
  }, [supabase])

  // ---- Carga / recarga de stock ----
  const cargarStock = async () => {
    setCargandoStock(true)
    setErrorStock(null)

    const { data, error: errorQuery } = await supabase
      .from('vw_stock_hacienda')
      .select('*')
      .order('campo_nombre')
      .order('categoria_orden')

    if (errorQuery) {
      setErrorStock(errorQuery.message)
      setCargandoStock(false)
      return
    }

    const filas = (data ?? []) as StockRow[]

    // Solo mostramos categorías con stock distinto de cero.
    const agrupado = new Map<string, StockPorCampo>()
    for (const fila of filas) {
      if (fila.stock_actual === 0) continue

      if (!agrupado.has(fila.campo_nombre)) {
        agrupado.set(fila.campo_nombre, {
          campo_nombre: fila.campo_nombre,
          filas: [],
          total: 0,
        })
      }
      const grupo = agrupado.get(fila.campo_nombre)!
      grupo.filas.push(fila)
      grupo.total += fila.stock_actual
    }

    setStock(Array.from(agrupado.values()))
    setCargandoStock(false)
  }

  useEffect(() => {
    cargarStock()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Helpers del formulario ----
  const esRecategorizacion = tipo === 'recategorizacion'
  const requierePrecio = REQUIERE_PRECIO.includes(tipo)

  const resetForm = () => {
    setCategoriaId('')
    setCategoriaDestinoId('')
    setCantidad('')
    setPrecioCabeza('')
    setObservaciones('')
  }

  const validar = (): string | null => {
    if (!campoId) return 'Seleccioná un campo.'
    if (!categoriaId) return 'Seleccioná una categoría.'
    if (esRecategorizacion && !categoriaDestinoId) {
      return 'Seleccioná la categoría destino de la recategorización.'
    }
    if (esRecategorizacion && categoriaDestinoId === categoriaId) {
      return 'La categoría destino debe ser distinta a la de origen.'
    }
    const cantidadNum = Number(cantidad)
    if (!cantidad || cantidadNum <= 0) {
      return 'Ingresá una cantidad de cabezas mayor a 0.'
    }
    if (requierePrecio && (!precioCabeza || Number(precioCabeza) <= 0)) {
      return 'Ingresá un precio por cabeza válido.'
    }
    if (!fecha) return 'Seleccioná una fecha.'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setExito(null)

    const errorValidacion = validar()
    if (errorValidacion) {
      setError(errorValidacion)
      return
    }

    setGuardando(true)

    try {
      const cantidadNum = Number(cantidad)
      const precioNum = requierePrecio ? Number(precioCabeza) : null

      if (esRecategorizacion) {
        // Dos movimientos vinculados: baja en origen, alta en destino.
        const { data: bajaInsertada, error: errorBaja } = await supabase
          .from('movimientos_hacienda')
          .insert({
            campo_id: Number(campoId),
            categoria_id: categoriaId,
            cantidad: cantidadNum,
            tipo_movimiento: 'recategorizacion_baja',
            fecha,
            observaciones: observaciones || null,
          })
          .select('id')
          .single()

        if (errorBaja || !bajaInsertada) {
          throw errorBaja ?? new Error('No se pudo registrar la baja.')
        }

        const { data: altaInsertada, error: errorAlta } = await supabase
          .from('movimientos_hacienda')
          .insert({
            campo_id: Number(campoId),
            categoria_id: categoriaDestinoId,
            cantidad: cantidadNum,
            tipo_movimiento: 'recategorizacion_alta',
            fecha,
            observaciones: observaciones || null,
            movimiento_relacionado_id: bajaInsertada.id,
          })
          .select('id')
          .single()

        if (errorAlta || !altaInsertada) {
          // Revertimos la baja para no dejar el movimiento huérfano.
          await supabase
            .from('movimientos_hacienda')
            .delete()
            .eq('id', bajaInsertada.id)
          throw errorAlta ?? new Error('No se pudo registrar la alta.')
        }

        // Vinculamos la baja con la alta también.
        await supabase
          .from('movimientos_hacienda')
          .update({ movimiento_relacionado_id: altaInsertada.id })
          .eq('id', bajaInsertada.id)
      } else {
        const { error: errorInsert } = await supabase
          .from('movimientos_hacienda')
          .insert({
            campo_id: Number(campoId),
            categoria_id: categoriaId,
            cantidad: cantidadNum,
            tipo_movimiento: tipo,
            fecha,
            precio_cabeza_usd: precioNum,
            observaciones: observaciones || null,
          })

        if (errorInsert) throw errorInsert
      }

      setExito('Movimiento registrado correctamente.')
      resetForm()
      cargarStock()
    } catch (err: any) {
      setError(err?.message ?? 'Ocurrió un error al guardar el movimiento.')
    } finally {
      setGuardando(false)
    }
  }

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Ganadería</h1>
        <p className="text-sm text-stone-500">
          Stock de hacienda y registro de movimientos por campo.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[400px_1fr]">
        {/* ---------------- Formulario ---------------- */}
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-lg border border-stone-200 bg-white p-6"
        >
          <h2 className="text-lg font-semibold text-stone-900">
            Nuevo movimiento de hacienda
          </h2>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {exito && (
            <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {exito}
            </div>
          )}

          {/* Campo */}
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">
              Campo
            </label>
            <select
              value={campoId}
              onChange={(e) => setCampoId(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
            >
              <option value="">Seleccionar campo...</option>
              {campos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de movimiento */}
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">
              Tipo de movimiento
            </label>
            <select
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value as TipoMovimientoUI)
                setCategoriaDestinoId('')
                setPrecioCabeza('')
              }}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
            >
              {TIPOS_MOVIMIENTO.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Categoría origen */}
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">
              {esRecategorizacion ? 'Categoría origen' : 'Categoría'}
            </label>
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
            >
              <option value="">Seleccionar categoría...</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Categoría destino (solo recategorización) */}
          {esRecategorizacion && (
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">
                Categoría destino
              </label>
              <select
                value={categoriaDestinoId}
                onChange={(e) => setCategoriaDestinoId(e.target.value)}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
              >
                <option value="">Seleccionar categoría...</option>
                {categorias
                  .filter((c) => c.id !== categoriaId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Cantidad */}
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">
              Cantidad de cabezas
            </label>
            <input
              type="number"
              min={1}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
            />
          </div>

          {/* Precio por cabeza (solo compra/venta) */}
          {requierePrecio && (
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">
                Precio por cabeza (USD)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={precioCabeza}
                onChange={(e) => setPrecioCabeza(e.target.value)}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
              />
              {cantidad && precioCabeza && (
                <p className="mt-1 text-xs text-stone-500">
                  Total: USD{' '}
                  {(Number(cantidad) * Number(precioCabeza)).toLocaleString(
                    'es-AR',
                    { minimumFractionDigits: 2 }
                  )}
                </p>
              )}
            </div>
          )}

          {/* Fecha */}
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">
              Fecha
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
            />
          </div>

          {/* Observaciones */}
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">
              Observaciones
            </label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={guardando}
            className="w-full rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Guardar movimiento'}
          </button>
        </form>

        {/* ---------------- Stock ---------------- */}
        <div>
          <h2 className="mb-3 text-lg font-semibold text-stone-900">
            Stock actual
          </h2>

          {cargandoStock && (
            <p className="text-sm text-stone-500">Cargando stock...</p>
          )}

          {!cargandoStock && errorStock && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Error al cargar el stock: {errorStock}
            </div>
          )}

          {!cargandoStock && !errorStock && stock.length === 0 && (
            <p className="text-sm text-stone-500">
              No hay cabezas registradas todavía.
            </p>
          )}

          {!cargandoStock && !errorStock && stock.length > 0 && (
            <div className="space-y-6">
              {stock.map((grupo) => (
                <div
                  key={grupo.campo_nombre}
                  className="overflow-hidden rounded-lg border border-stone-200"
                >
                  <div className="flex items-center justify-between bg-stone-50 px-4 py-2">
                    <h3 className="text-sm font-semibold text-stone-900">
                      {grupo.campo_nombre}
                    </h3>
                    <span className="text-sm text-stone-500">
                      {grupo.total.toLocaleString('es-AR')} cabezas
                    </span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-200 text-left text-stone-500">
                        <th className="px-4 py-2 font-medium">Categoría</th>
                        <th className="px-4 py-2 text-right font-medium">
                          Stock
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {grupo.filas.map((fila) => (
                        <tr
                          key={fila.categoria_id}
                          className="border-b border-stone-100 last:border-0"
                        >
                          <td className="px-4 py-2 text-stone-700">
                            {fila.categoria_nombre}
                          </td>
                          <td className="px-4 py-2 text-right font-medium text-stone-900">
                            {fila.stock_actual.toLocaleString('es-AR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
