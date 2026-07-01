'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Campo = { id: number; nombre: string }
type CategoriaHacienda = { id: string; nombre: string; orden: number }
type StockRow = { campo_id: number; campo_nombre: string; categoria_id: string; categoria_nombre: string; categoria_orden: number; stock_actual: number }
type StockPorCampo = { campo_nombre: string; filas: StockRow[]; total: number }
type MovimientoRow = {
  id: string; campo_id: number; categoria_id: string; cantidad: number
  tipo_movimiento: string; fecha: string; precio_cabeza_usd: number | null
  monto_total_usd: number | null; observaciones: string | null
  movimiento_relacionado_id: string | null
  categorias_hacienda: { nombre: string }; campos: { nombre: string }
}

type TipoMovimientoUI = 'compra' | 'venta' | 'nacimiento' | 'muerte' | 'recategorizacion' | 'ajuste_positivo' | 'ajuste_negativo'
const TIPOS_MOVIMIENTO: { value: TipoMovimientoUI; label: string }[] = [
  { value: 'compra', label: 'Compra' }, { value: 'venta', label: 'Venta' },
  { value: 'nacimiento', label: 'Nacimiento' }, { value: 'muerte', label: 'Muerte / Desaparecido' },
  { value: 'recategorizacion', label: 'Recategorización' },
  { value: 'ajuste_positivo', label: 'Ajuste (suma)' }, { value: 'ajuste_negativo', label: 'Ajuste (resta)' },
]
const REQUIERE_PRECIO = ['compra', 'venta']
const LABEL_TIPO: Record<string, string> = {
  compra: 'Compra', venta: 'Venta', nacimiento: 'Nacimiento', muerte: 'Muerte',
  recategorizacion_baja: 'Recategorización', ajuste_positivo: 'Ajuste (+)', ajuste_negativo: 'Ajuste (−)',
}

const inputCls = 'w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none'
const labelCls = 'mb-1 block text-sm font-medium text-stone-700'

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <h3 className="text-base font-semibold text-stone-900">{title}</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-xl leading-none">×</button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-6 py-5 space-y-4">{children}</div>
      </div>
    </div>
  )
}

export default function GanaderiaMovimientosPage() {
  const supabase = createClient()
  const [campos, setCampos] = useState<Campo[]>([])
  const [categorias, setCategorias] = useState<CategoriaHacienda[]>([])
  const [campoId, setCampoId] = useState('')
  const [tipo, setTipo] = useState<TipoMovimientoUI>('compra')
  const [categoriaId, setCategoriaId] = useState('')
  const [categoriaDestinoId, setCategoriaDestinoId] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [precioCabeza, setPrecioCabeza] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [observaciones, setObservaciones] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const [movimientos, setMovimientos] = useState<MovimientoRow[]>([])
  const [cargandoMov, setCargandoMov] = useState(true)
  const [stock, setStock] = useState<StockPorCampo[]>([])
  const [cargandoStock, setCargandoStock] = useState(true)
  const [errorStock, setErrorStock] = useState<string | null>(null)
  const [editMov, setEditMov] = useState<MovimientoRow | null>(null)
  const [emCategoriaId, setEmCategoriaId] = useState('')
  const [emCantidad, setEmCantidad] = useState('')
  const [emPrecio, setEmPrecio] = useState('')
  const [emFecha, setEmFecha] = useState('')
  const [emObs, setEmObs] = useState('')
  const [emGuardando, setEmGuardando] = useState(false)
  const [emError, setEmError] = useState<string | null>(null)

  useEffect(() => {
    const cargar = async () => {
      const [{ data: c }, { data: cat }] = await Promise.all([
        supabase.from('campos').select('id, nombre').order('nombre'),
        supabase.from('categorias_hacienda').select('id, nombre, orden').order('orden'),
      ])
      setCampos(c ?? []); setCategorias(cat ?? [])
    }
    cargar(); cargarStock(); cargarMovimientos()
  }, [])

  const cargarStock = async () => {
    setCargandoStock(true); setErrorStock(null)
    const { data, error: eq } = await supabase.from('vw_stock_hacienda').select('*').order('campo_nombre').order('categoria_orden')
    if (eq) { setErrorStock(eq.message); setCargandoStock(false); return }
    const filas = (data ?? []) as StockRow[]
    const agrupado = new Map<string, StockPorCampo>()
    for (const f of filas) {
      if (f.stock_actual === 0) continue
      if (!agrupado.has(f.campo_nombre)) agrupado.set(f.campo_nombre, { campo_nombre: f.campo_nombre, filas: [], total: 0 })
      const g = agrupado.get(f.campo_nombre)!
      g.filas.push(f); g.total += f.stock_actual
    }
    setStock(Array.from(agrupado.values())); setCargandoStock(false)
  }

  const cargarMovimientos = async () => {
    setCargandoMov(true)
    const { data } = await supabase.from('movimientos_hacienda')
      .select('*, categorias_hacienda(nombre), campos(nombre)')
      .not('tipo_movimiento', 'in', '(recategorizacion_alta)')
      .order('fecha', { ascending: false }).limit(50)
    setMovimientos((data ?? []) as MovimientoRow[]); setCargandoMov(false)
  }

  const esRecategorizacion = tipo === 'recategorizacion'
  const requierePrecio = REQUIERE_PRECIO.includes(tipo)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setExito(null)
    if (!campoId) return setError('Seleccioná un campo.')
    if (!categoriaId) return setError('Seleccioná una categoría.')
    if (esRecategorizacion && !categoriaDestinoId) return setError('Seleccioná la categoría destino.')
    if (esRecategorizacion && categoriaDestinoId === categoriaId) return setError('Las categorías deben ser distintas.')
    if (!cantidad || Number(cantidad) <= 0) return setError('Ingresá una cantidad mayor a 0.')
    if (requierePrecio && (!precioCabeza || Number(precioCabeza) <= 0)) return setError('Ingresá un precio por cabeza válido.')
    setGuardando(true)
    try {
      const cantNum = Number(cantidad)
      const precioNum = requierePrecio ? Number(precioCabeza) : null
      if (esRecategorizacion) {
        const { data: baja, error: eBaja } = await supabase.from('movimientos_hacienda')
          .insert({ campo_id: Number(campoId), categoria_id: categoriaId, cantidad: cantNum, tipo_movimiento: 'recategorizacion_baja', fecha, observaciones: observaciones || null })
          .select('id').single()
        if (eBaja || !baja) throw eBaja ?? new Error('Error en la baja.')
        const { data: alta, error: eAlta } = await supabase.from('movimientos_hacienda')
          .insert({ campo_id: Number(campoId), categoria_id: categoriaDestinoId, cantidad: cantNum, tipo_movimiento: 'recategorizacion_alta', fecha, observaciones: observaciones || null, movimiento_relacionado_id: baja.id })
          .select('id').single()
        if (eAlta || !alta) { await supabase.from('movimientos_hacienda').delete().eq('id', baja.id); throw eAlta ?? new Error('Error en la alta.') }
        await supabase.from('movimientos_hacienda').update({ movimiento_relacionado_id: alta.id }).eq('id', baja.id)
      } else {
        const { error: eIns } = await supabase.from('movimientos_hacienda').insert({ campo_id: Number(campoId), categoria_id: categoriaId, cantidad: cantNum, tipo_movimiento: tipo, fecha, precio_cabeza_usd: precioNum, observaciones: observaciones || null })
        if (eIns) throw eIns
      }
      setExito('Movimiento registrado.'); setCategoriaId(''); setCategoriaDestinoId(''); setCantidad(''); setPrecioCabeza(''); setObservaciones('')
      cargarStock(); cargarMovimientos()
    } catch (err: any) { setError(err?.message ?? 'Error al guardar.') }
    finally { setGuardando(false) }
  }

  const abrirEdit = (m: MovimientoRow) => {
    setEditMov(m); setEmCategoriaId(m.categoria_id); setEmCantidad(String(m.cantidad))
    setEmPrecio(m.precio_cabeza_usd ? String(m.precio_cabeza_usd) : ''); setEmFecha(m.fecha); setEmObs(m.observaciones ?? ''); setEmError(null)
  }

  const handleGuardarEdit = async () => {
    if (!editMov) return; setEmError(null)
    if (!emCantidad || Number(emCantidad) <= 0) return setEmError('Ingresá una cantidad válida.')
    if (REQUIERE_PRECIO.includes(editMov.tipo_movimiento) && (!emPrecio || Number(emPrecio) <= 0)) return setEmError('Ingresá un precio válido.')
    setEmGuardando(true)
    try {
      const { error: eUp } = await supabase.from('movimientos_hacienda').update({
        categoria_id: emCategoriaId, cantidad: Number(emCantidad),
        precio_cabeza_usd: REQUIERE_PRECIO.includes(editMov.tipo_movimiento) ? Number(emPrecio) : null,
        fecha: emFecha, observaciones: emObs || null,
      }).eq('id', editMov.id)
      if (eUp) throw eUp
      setEditMov(null); cargarStock(); cargarMovimientos()
    } catch (err: any) { setEmError(err?.message ?? 'Error al guardar.') }
    finally { setEmGuardando(false) }
  }

  const handleBorrar = async (m: MovimientoRow) => {
    if (!confirm(`¿Borrar este movimiento de ${m.cantidad} cabezas (${LABEL_TIPO[m.tipo_movimiento] ?? m.tipo_movimiento})?`)) return
    if (m.movimiento_relacionado_id) await supabase.from('movimientos_hacienda').delete().eq('id', m.movimiento_relacionado_id)
    await supabase.from('movimientos_hacienda').delete().eq('id', m.id)
    cargarStock(); cargarMovimientos()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Movimientos de hacienda</h1>
        <p className="text-sm text-stone-500">Registrá compras, ventas, nacimientos y movimientos de hacienda.</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[380px_1fr]">
        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-stone-200 bg-white p-6">
          <h2 className="text-base font-semibold text-stone-900">Nuevo movimiento</h2>
          {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {exito && <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{exito}</div>}

          <div><label className={labelCls}>Campo</label>
            <select value={campoId} onChange={(e) => setCampoId(e.target.value)} className={inputCls}>
              <option value="">Seleccionar campo...</option>
              {campos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select></div>

          <div><label className={labelCls}>Tipo de movimiento</label>
            <select value={tipo} onChange={(e) => { setTipo(e.target.value as TipoMovimientoUI); setCategoriaDestinoId(''); setPrecioCabeza('') }} className={inputCls}>
              {TIPOS_MOVIMIENTO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select></div>

          <div><label className={labelCls}>{esRecategorizacion ? 'Categoría origen' : 'Categoría'}</label>
            <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className={inputCls}>
              <option value="">Seleccionar categoría...</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select></div>

          {esRecategorizacion && (
            <div><label className={labelCls}>Categoría destino</label>
              <select value={categoriaDestinoId} onChange={(e) => setCategoriaDestinoId(e.target.value)} className={inputCls}>
                <option value="">Seleccionar categoría...</option>
                {categorias.filter((c) => c.id !== categoriaId).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select></div>
          )}

          <div><label className={labelCls}>Cantidad de cabezas</label>
            <input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} className={inputCls} /></div>

          {requierePrecio && (
            <div><label className={labelCls}>Precio por cabeza (USD)</label>
              <input type="number" min={0} step="0.01" value={precioCabeza} onChange={(e) => setPrecioCabeza(e.target.value)} className={inputCls} />
              {cantidad && precioCabeza && <p className="mt-1 text-xs text-stone-500">Total: USD {(Number(cantidad) * Number(precioCabeza)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>}
            </div>
          )}

          <div><label className={labelCls}>Fecha</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} /></div>

          <div><label className={labelCls}>Observaciones</label>
            <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} className={inputCls} /></div>

          <button type="submit" disabled={guardando} className="w-full rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Guardar movimiento'}</button>
        </form>

        <div className="space-y-6">
          <div>
            <h2 className="mb-3 text-base font-semibold text-stone-900">Stock actual</h2>
            {cargandoStock && <p className="text-sm text-stone-500">Cargando...</p>}
            {!cargandoStock && errorStock && <p className="text-sm text-red-600">{errorStock}</p>}
            {!cargandoStock && !errorStock && stock.length === 0 && <p className="text-sm text-stone-500">Sin cabezas registradas.</p>}
            {!cargandoStock && stock.length > 0 && (
              <div className="space-y-4">
                {stock.map((grupo) => (
                  <div key={grupo.campo_nombre} className="overflow-hidden rounded-lg border border-stone-200">
                    <div className="flex items-center justify-between bg-stone-50 px-4 py-2">
                      <span className="text-sm font-semibold text-stone-900">{grupo.campo_nombre}</span>
                      <span className="text-sm text-stone-500">{grupo.total.toLocaleString('es-AR')} cabezas</span>
                    </div>
                    <table className="w-full text-sm">
                      <tbody>
                        {grupo.filas.map((f) => (
                          <tr key={f.categoria_id} className="border-t border-stone-100">
                            <td className="px-4 py-1.5 text-stone-700">{f.categoria_nombre}</td>
                            <td className="px-4 py-1.5 text-right font-medium text-stone-900">{f.stock_actual.toLocaleString('es-AR')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-base font-semibold text-stone-900">Últimos movimientos</h2>
            {cargandoMov && <p className="text-sm text-stone-500">Cargando...</p>}
            {!cargandoMov && movimientos.length === 0 && <p className="text-sm text-stone-500">Sin movimientos registrados.</p>}
            {!cargandoMov && movimientos.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-stone-200">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                    <th className="px-4 py-2 font-medium">Fecha</th>
                    <th className="px-4 py-2 font-medium">Campo</th>
                    <th className="px-4 py-2 font-medium">Tipo</th>
                    <th className="px-4 py-2 font-medium">Categoría</th>
                    <th className="px-4 py-2 text-right font-medium">Cabezas</th>
                    <th className="px-4 py-2 text-right font-medium">USD/cab</th>
                    <th className="px-4 py-2" />
                  </tr></thead>
                  <tbody>
                    {movimientos.map((m) => (
                      <tr key={m.id} className="border-t border-stone-100">
                        <td className="px-4 py-2 text-stone-600">{new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                        <td className="px-4 py-2 text-stone-700">{m.campos?.nombre}</td>
                        <td className="px-4 py-2 text-stone-700">{LABEL_TIPO[m.tipo_movimiento] ?? m.tipo_movimiento}</td>
                        <td className="px-4 py-2 text-stone-700">{m.categorias_hacienda?.nombre}</td>
                        <td className="px-4 py-2 text-right font-medium text-stone-900">{m.cantidad.toLocaleString('es-AR')}</td>
                        <td className="px-4 py-2 text-right text-stone-600">{m.precio_cabeza_usd ? `$${Number(m.precio_cabeza_usd).toLocaleString('es-AR')}` : '—'}</td>
                        <td className="px-4 py-2">
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => abrirEdit(m)} className="text-xs text-stone-500 hover:text-stone-900 underline">Editar</button>
                            <button onClick={() => handleBorrar(m)} className="text-xs text-red-500 hover:text-red-700 underline">Borrar</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {editMov && (
        <Modal title="Editar movimiento" onClose={() => setEditMov(null)}>
          {emError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{emError}</div>}
          <div className="rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-600">
            <span className="font-medium">{editMov.campos?.nombre}</span> · {LABEL_TIPO[editMov.tipo_movimiento] ?? editMov.tipo_movimiento}
          </div>
          <div><label className={labelCls}>Categoría</label>
            <select value={emCategoriaId} onChange={(e) => setEmCategoriaId(e.target.value)} className={inputCls}>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select></div>
          <div><label className={labelCls}>Cantidad de cabezas</label>
            <input type="number" min={1} value={emCantidad} onChange={(e) => setEmCantidad(e.target.value)} className={inputCls} /></div>
          {REQUIERE_PRECIO.includes(editMov.tipo_movimiento) && (
            <div><label className={labelCls}>Precio por cabeza (USD)</label>
              <input type="number" min={0} step="0.01" value={emPrecio} onChange={(e) => setEmPrecio(e.target.value)} className={inputCls} /></div>
          )}
          <div><label className={labelCls}>Fecha</label>
            <input type="date" value={emFecha} onChange={(e) => setEmFecha(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Observaciones</label>
            <textarea value={emObs} onChange={(e) => setEmObs(e.target.value)} rows={2} className={inputCls} /></div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setEditMov(null)} className="flex-1 rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">Cancelar</button>
            <button onClick={handleGuardarEdit} disabled={emGuardando} className="flex-1 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50">
              {emGuardando ? 'Guardando...' : 'Guardar cambios'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
