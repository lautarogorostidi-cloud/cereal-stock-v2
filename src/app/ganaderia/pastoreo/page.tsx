'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Campo = { id: number; nombre: string }
type Lote = { id: string; nombre: string; establecimiento: string }
type CategoriaHacienda = { id: string; nombre: string; orden: number }
type Pastoreo = {
  id: string; campo_id: number; lote_id: string; categoria_id: string
  cantidad: number; fecha_entrada: string; fecha_salida: string | null; observaciones: string | null
  lotes: { nombre: string }; categorias_hacienda: { nombre: string }; campos: { nombre: string }
}

type PastoreoTab = 'actual' | 'historial'
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

export default function PastoreoPage() {
  const supabase = createClient()
  const [campos, setCampos] = useState<Campo[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [categorias, setCategorias] = useState<CategoriaHacienda[]>([])
  const [pCampoId, setPCampoId] = useState('')
  const [pLoteId, setPLoteId] = useState('')
  const [pCategoriaId, setPCategoriaId] = useState('')
  const [pCantidad, setPCantidad] = useState('')
  const [pFechaEntrada, setPFechaEntrada] = useState(new Date().toISOString().slice(0, 10))
  const [pFechaSalida, setPFechaSalida] = useState('')
  const [pObservaciones, setPObservaciones] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const [pastoreoTab, setPastoreoTab] = useState<PastoreoTab>('actual')
  const [pastoreos, setPastoreos] = useState<Pastoreo[]>([])
  const [cargando, setCargando] = useState(false)
  const [editPast, setEditPast] = useState<Pastoreo | null>(null)
  const [epLoteId, setEpLoteId] = useState('')
  const [epCategoriaId, setEpCategoriaId] = useState('')
  const [epCantidad, setEpCantidad] = useState('')
  const [epFechaEntrada, setEpFechaEntrada] = useState('')
  const [epFechaSalida, setEpFechaSalida] = useState('')
  const [epObs, setEpObs] = useState('')
  const [epGuardando, setEpGuardando] = useState(false)
  const [epError, setEpError] = useState<string | null>(null)

  useEffect(() => {
    const cargar = async () => {
      const [{ data: c }, { data: l }, { data: cat }] = await Promise.all([
        supabase.from('campos').select('id, nombre').order('nombre'),
        supabase.from('lotes').select('id, nombre, establecimiento').eq('activo', true).order('nombre'),
        supabase.from('categorias_hacienda').select('id, nombre, orden').order('orden'),
      ])
      setCampos(c ?? []); setLotes(l ?? []); setCategorias(cat ?? [])
    }
    cargar()
  }, [])

  useEffect(() => { cargarPastoreos(pastoreoTab === 'actual') }, [pastoreoTab])

  const cargarPastoreos = async (soloActivos: boolean) => {
    setCargando(true)
    let q = supabase.from('pastoreos').select('*, lotes(nombre), categorias_hacienda(nombre), campos(nombre)').order('fecha_entrada', { ascending: false })
    if (soloActivos) q = q.is('fecha_salida', null)
    const { data } = await q
    setPastoreos((data ?? []) as Pastoreo[]); setCargando(false)
  }

  const nombreCampo = (id: string) => campos.find((c) => c.id === Number(id))?.nombre ?? ''
  const lotesPorCampo = (campoIdStr: string) =>
    campoIdStr ? lotes.filter((l) => l.establecimiento === nombreCampo(campoIdStr)) : lotes

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setExito(null)
    if (!pCampoId) return setError('Seleccioná un campo.')
    if (!pLoteId) return setError('Seleccioná un lote.')
    if (!pCategoriaId) return setError('Seleccioná una categoría.')
    if (!pCantidad || Number(pCantidad) <= 0) return setError('Ingresá una cantidad mayor a 0.')
    if (pFechaSalida && pFechaSalida < pFechaEntrada) return setError('La fecha de salida debe ser posterior.')
    setGuardando(true)
    try {
      const { error: eIns } = await supabase.from('pastoreos').insert({ campo_id: Number(pCampoId), lote_id: pLoteId, categoria_id: pCategoriaId, cantidad: Number(pCantidad), fecha_entrada: pFechaEntrada, fecha_salida: pFechaSalida || null, observaciones: pObservaciones || null })
      if (eIns) throw eIns
      setExito('Pastoreo registrado.'); setPLoteId(''); setPCategoriaId(''); setPCantidad(''); setPFechaSalida(''); setPObservaciones('')
      cargarPastoreos(pastoreoTab === 'actual')
    } catch (err: any) { setError(err?.message ?? 'Error al guardar.') }
    finally { setGuardando(false) }
  }

  const abrirEdit = (p: Pastoreo) => {
    setEditPast(p); setEpLoteId(p.lote_id); setEpCategoriaId(p.categoria_id)
    setEpCantidad(String(p.cantidad)); setEpFechaEntrada(p.fecha_entrada)
    setEpFechaSalida(p.fecha_salida ?? ''); setEpObs(p.observaciones ?? ''); setEpError(null)
  }

  const handleGuardarEdit = async () => {
    if (!editPast) return; setEpError(null)
    if (!epLoteId) return setEpError('Seleccioná un lote.')
    if (!epCantidad || Number(epCantidad) <= 0) return setEpError('Ingresá una cantidad válida.')
    if (epFechaSalida && epFechaSalida < epFechaEntrada) return setEpError('La fecha de salida debe ser posterior.')
    setEpGuardando(true)
    try {
      const { error: eUp } = await supabase.from('pastoreos').update({ lote_id: epLoteId, categoria_id: epCategoriaId, cantidad: Number(epCantidad), fecha_entrada: epFechaEntrada, fecha_salida: epFechaSalida || null, observaciones: epObs || null }).eq('id', editPast.id)
      if (eUp) throw eUp
      setEditPast(null); cargarPastoreos(pastoreoTab === 'actual')
    } catch (err: any) { setEpError(err?.message ?? 'Error al guardar.') }
    finally { setEpGuardando(false) }
  }

  const handleBorrar = async (id: string) => {
    if (!confirm('¿Borrar este registro de pastoreo?')) return
    await supabase.from('pastoreos').delete().eq('id', id)
    cargarPastoreos(pastoreoTab === 'actual')
  }

  const registrarSalida = async (id: string) => {
    await supabase.from('pastoreos').update({ fecha_salida: new Date().toISOString().slice(0, 10) }).eq('id', id)
    cargarPastoreos(pastoreoTab === 'actual')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Pastoreo por lote</h1>
        <p className="text-sm text-stone-500">Registrá en qué lote está cada grupo de animales y cuándo entraron y salieron.</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[380px_1fr]">
        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-stone-200 bg-white p-6">
          <h2 className="text-base font-semibold text-stone-900">Registrar pastoreo</h2>
          {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {exito && <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{exito}</div>}

          <div><label className={labelCls}>Campo</label>
            <select value={pCampoId} onChange={(e) => { setPCampoId(e.target.value); setPLoteId('') }} className={inputCls}>
              <option value="">Seleccionar campo...</option>
              {campos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select></div>

          <div><label className={labelCls}>Lote</label>
            <select value={pLoteId} onChange={(e) => setPLoteId(e.target.value)} disabled={!pCampoId} className={`${inputCls} disabled:opacity-50`}>
              <option value="">Seleccionar lote...</option>
              {lotesPorCampo(pCampoId).map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select></div>

          <div><label className={labelCls}>Categoría</label>
            <select value={pCategoriaId} onChange={(e) => setPCategoriaId(e.target.value)} className={inputCls}>
              <option value="">Seleccionar categoría...</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select></div>

          <div><label className={labelCls}>Cantidad de cabezas</label>
            <input type="number" min={1} value={pCantidad} onChange={(e) => setPCantidad(e.target.value)} className={inputCls} /></div>

          <div><label className={labelCls}>Fecha de entrada</label>
            <input type="date" value={pFechaEntrada} onChange={(e) => setPFechaEntrada(e.target.value)} className={inputCls} /></div>

          <div><label className={labelCls}>Fecha de salida <span className="text-stone-400">(opcional)</span></label>
            <input type="date" value={pFechaSalida} onChange={(e) => setPFechaSalida(e.target.value)} min={pFechaEntrada} className={inputCls} /></div>

          <div><label className={labelCls}>Observaciones</label>
            <textarea value={pObservaciones} onChange={(e) => setPObservaciones(e.target.value)} rows={2} className={inputCls} /></div>

          <button type="submit" disabled={guardando} className="w-full rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Registrar pastoreo'}</button>
        </form>

        <div>
          <div className="mb-4 flex gap-1 border-b border-stone-200">
            {(['actual', 'historial'] as PastoreoTab[]).map((t) => (
              <button key={t} onClick={() => setPastoreoTab(t)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${pastoreoTab === t ? 'border-b-2 border-stone-900 text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}>
                {t === 'actual' ? 'Ubicación actual' : 'Historial'}
              </button>
            ))}
          </div>
          {cargando && <p className="text-sm text-stone-500">Cargando...</p>}
          {!cargando && pastoreos.length === 0 && <p className="text-sm text-stone-500">Sin registros de pastoreo.</p>}
          {!cargando && pastoreos.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-stone-200">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                  <th className="px-4 py-2 font-medium">Campo / Lote</th>
                  <th className="px-4 py-2 font-medium">Categoría</th>
                  <th className="px-4 py-2 text-right font-medium">Cabezas</th>
                  <th className="px-4 py-2 font-medium">Entrada</th>
                  <th className="px-4 py-2 font-medium">Salida</th>
                  <th className="px-4 py-2" />
                </tr></thead>
                <tbody>
                  {pastoreos.map((p) => (
                    <tr key={p.id} className="border-t border-stone-100">
                      <td className="px-4 py-2"><div className="font-medium text-stone-900">{p.campos?.nombre}</div><div className="text-xs text-stone-500">{p.lotes?.nombre}</div></td>
                      <td className="px-4 py-2 text-stone-700">{p.categorias_hacienda?.nombre}</td>
                      <td className="px-4 py-2 text-right font-medium">{p.cantidad.toLocaleString('es-AR')}</td>
                      <td className="px-4 py-2 text-stone-600">{new Date(p.fecha_entrada + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                      <td className="px-4 py-2 text-stone-600">
                        {p.fecha_salida ? new Date(p.fecha_salida + 'T00:00:00').toLocaleDateString('es-AR') : <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">En lote</span>}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-2 justify-end flex-wrap">
                          {pastoreoTab === 'actual' && !p.fecha_salida && (
                            <button onClick={() => registrarSalida(p.id)} className="text-xs text-stone-500 hover:text-stone-900 underline">Salida hoy</button>
                          )}
                          <button onClick={() => abrirEdit(p)} className="text-xs text-stone-500 hover:text-stone-900 underline">Editar</button>
                          <button onClick={() => handleBorrar(p.id)} className="text-xs text-red-500 hover:text-red-700 underline">Borrar</button>
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

      {editPast && (
        <Modal title="Editar pastoreo" onClose={() => setEditPast(null)}>
          {epError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{epError}</div>}
          <div className="rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-600"><span className="font-medium">{editPast.campos?.nombre}</span></div>
          <div><label className={labelCls}>Lote</label>
            <select value={epLoteId} onChange={(e) => setEpLoteId(e.target.value)} className={inputCls}>
              {lotesPorCampo(String(editPast.campo_id)).map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select></div>
          <div><label className={labelCls}>Categoría</label>
            <select value={epCategoriaId} onChange={(e) => setEpCategoriaId(e.target.value)} className={inputCls}>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select></div>
          <div><label className={labelCls}>Cantidad de cabezas</label>
            <input type="number" min={1} value={epCantidad} onChange={(e) => setEpCantidad(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Fecha de entrada</label>
            <input type="date" value={epFechaEntrada} onChange={(e) => setEpFechaEntrada(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Fecha de salida <span className="text-stone-400">(opcional)</span></label>
            <input type="date" value={epFechaSalida} onChange={(e) => setEpFechaSalida(e.target.value)} min={epFechaEntrada} className={inputCls} /></div>
          <div><label className={labelCls}>Observaciones</label>
            <textarea value={epObs} onChange={(e) => setEpObs(e.target.value)} rows={2} className={inputCls} /></div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setEditPast(null)} className="flex-1 rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">Cancelar</button>
            <button onClick={handleGuardarEdit} disabled={epGuardando} className="flex-1 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50">
              {epGuardando ? 'Guardando...' : 'Guardar cambios'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
