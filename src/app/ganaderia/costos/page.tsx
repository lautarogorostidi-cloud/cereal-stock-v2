'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Campo = { id: number; nombre: string }
type Campania = { id: number; nombre: string }
type LoteFeedlot = { id: string; numero_lote: string; campos: { nombre: string } }

type CostoGanaderia = {
  id: string; fecha: string; tipo: string; descripcion: string | null
  monto_usd: number; lote_feedlot_id: string | null; campo_id: number | null
  campania: string | null; observaciones: string | null
  lotes_feedlot: { numero_lote: string; campos: { nombre: string } } | null
  campos: { nombre: string } | null
}

type AsociacionTipo = 'feedlot' | 'general'

const TIPOS = [
  { value: 'flete', label: 'Flete' },
  { value: 'mano_obra', label: 'Mano de obra' },
  { value: 'veterinario', label: 'Veterinario' },
  { value: 'arrendamiento', label: 'Arrendamiento' },
  { value: 'otros', label: 'Otros' },
]

const inputCls = 'w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none'
const labelCls = 'mb-1 block text-sm font-medium text-stone-700'

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <h3 className="text-base font-semibold text-stone-900">{title}</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-xl leading-none">x</button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-6 py-5 space-y-4">{children}</div>
      </div>
    </div>
  )
}

export default function CostosPage() {
  const supabase = createClient()

  const [campos, setCampos] = useState<Campo[]>([])
  const [campanias, setCampanias] = useState<Campania[]>([])
  const [lotesFeedlot, setLotesFeedlot] = useState<LoteFeedlot[]>([])
  const [costos, setCostos] = useState<CostoGanaderia[]>([])
  const [cargando, setCargando] = useState(true)

  // Formulario
  const [asociacion, setAsociacion] = useState<AsociacionTipo>('feedlot')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [tipo, setTipo] = useState('flete')
  const [descripcion, setDescripcion] = useState('')
  const [monto, setMonto] = useState('')
  const [loteId, setLoteId] = useState('')
  const [campoId, setCampoId] = useState('')
  const [campania, setCampania] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)

  // Filtros historial
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroCampo, setFiltroCampo] = useState('')
  const [filtroCampania, setFiltroCampania] = useState('')

  // Modal editar
  const [editCosto, setEditCosto] = useState<CostoGanaderia | null>(null)
  const [eFecha, setEFecha] = useState('')
  const [eTipo, setETipo] = useState('')
  const [eDescripcion, setEDescripcion] = useState('')
  const [eMonto, setEMonto] = useState('')
  const [eLoteId, setELoteId] = useState('')
  const [eCampoId, setECampoId] = useState('')
  const [eCampania, setECampania] = useState('')
  const [eObs, setEObs] = useState('')
  const [eAsociacion, setEAsociacion] = useState<AsociacionTipo>('feedlot')
  const [eGuardando, setEGuardando] = useState(false)
  const [eError, setEError] = useState<string | null>(null)

  useEffect(() => {
    const cargar = async () => {
      const [{ data: c }, { data: camp }, { data: lotes }] = await Promise.all([
        supabase.from('campos').select('id, nombre').order('nombre'),
        supabase.from('campanas').select('id, nombre').order('nombre', { ascending: false }),
        supabase.from('lotes_feedlot').select('id, numero_lote, campos(nombre)').order('fecha_entrada', { ascending: false }),
      ])
      setCampos(c ?? [])
      setCampanias(camp ?? [])
      setLotesFeedlot((lotes ?? []) as unknown as LoteFeedlot[])
    }
    cargar(); cargarCostos()
  }, [])

  const cargarCostos = async () => {
    setCargando(true)
    const { data } = await supabase
      .from('costos_ganaderia')
      .select('*, lotes_feedlot(numero_lote, campos(nombre)), campos(nombre)')
      .order('fecha', { ascending: false })
    setCostos((data ?? []) as CostoGanaderia[])
    setCargando(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setExito(null)
    if (!monto || Number(monto) <= 0) return setError('Ingresa un monto valido.')
    if (asociacion === 'feedlot' && !loteId) return setError('Selecciona un lote feedlot.')
    if (asociacion === 'general' && !campoId) return setError('Selecciona un campo.')
    setGuardando(true)
    try {
      const { error: eIns } = await supabase.from('costos_ganaderia').insert({
        fecha, tipo, descripcion: descripcion || null,
        monto_usd: Number(monto),
        lote_feedlot_id: asociacion === 'feedlot' ? loteId : null,
        campo_id: asociacion === 'general' ? Number(campoId) : null,
        campania: asociacion === 'general' && campania ? campania : null,
        observaciones: observaciones || null,
      })
      if (eIns) throw eIns
      setExito('Costo registrado.')
      setDescripcion(''); setMonto(''); setLoteId(''); setCampoId(''); setCampania(''); setObservaciones('')
      cargarCostos()
    } catch (err: any) { setError(err?.message ?? 'Error al guardar.') }
    finally { setGuardando(false) }
  }

  const abrirEdit = (c: CostoGanaderia) => {
    setEditCosto(c); setEFecha(c.fecha); setETipo(c.tipo)
    setEDescripcion(c.descripcion ?? ''); setEMonto(String(c.monto_usd))
    setELoteId(c.lote_feedlot_id ?? ''); setECampoId(c.campo_id ? String(c.campo_id) : '')
    setECampania(c.campania ?? ''); setEObs(c.observaciones ?? '')
    setEAsociacion(c.lote_feedlot_id ? 'feedlot' : 'general')
    setEError(null)
  }

  const handleGuardarEdit = async () => {
    if (!editCosto) return; setEError(null)
    if (!eMonto || Number(eMonto) <= 0) return setEError('Ingresa un monto valido.')
    setEGuardando(true)
    try {
      const { error: eUp } = await supabase.from('costos_ganaderia').update({
        fecha: eFecha, tipo: eTipo, descripcion: eDescripcion || null,
        monto_usd: Number(eMonto),
        lote_feedlot_id: eAsociacion === 'feedlot' ? eLoteId : null,
        campo_id: eAsociacion === 'general' ? Number(eCampoId) : null,
        campania: eAsociacion === 'general' && eCampania ? eCampania : null,
        observaciones: eObs || null,
      }).eq('id', editCosto.id)
      if (eUp) throw eUp
      setEditCosto(null); cargarCostos()
    } catch (err: any) { setEError(err?.message ?? 'Error al guardar.') }
    finally { setEGuardando(false) }
  }

  const handleBorrar = async (id: string) => {
    if (!confirm('Borrar este costo?')) return
    await supabase.from('costos_ganaderia').delete().eq('id', id)
    cargarCostos()
  }

  const costosFiltrados = costos.filter((c) => {
    if (filtroTipo && c.tipo !== filtroTipo) return false
    if (filtroCampo) {
      const campoNombre = campos.find((x) => x.id === Number(filtroCampo))?.nombre
      const matchLote = c.lotes_feedlot?.campos?.nombre === campoNombre
      const matchGeneral = c.campos?.nombre === campoNombre
      if (!matchLote && !matchGeneral) return false
    }
    if (filtroCampania && c.campania !== filtroCampania) return false
    return true
  })

  const totalFiltrado = costosFiltrados.reduce((s, c) => s + c.monto_usd, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Costos</h1>
        <p className="text-sm text-stone-500">Costos del feedlot y costos generales de ganaderia por campo y campana.</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[380px_1fr]">
        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-stone-200 bg-white p-6">
          <h2 className="text-base font-semibold text-stone-900">Nuevo costo</h2>
          {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {exito && <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{exito}</div>}

          {/* Tipo de asociación */}
          <div>
            <label className={labelCls}>Asociar a</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAsociacion('feedlot')}
                className={`flex-1 rounded-md border px-3 py-2 text-sm transition ${asociacion === 'feedlot' ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 text-stone-700 hover:bg-stone-50'}`}>
                Lote feedlot
              </button>
              <button type="button" onClick={() => setAsociacion('general')}
                className={`flex-1 rounded-md border px-3 py-2 text-sm transition ${asociacion === 'general' ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 text-stone-700 hover:bg-stone-50'}`}>
                General (campo)
              </button>
            </div>
          </div>

          {/* Selector según asociación */}
          {asociacion === 'feedlot' ? (
            <div><label className={labelCls}>Lote feedlot</label>
              <select value={loteId} onChange={(e) => setLoteId(e.target.value)} className={inputCls}>
                <option value="">Seleccionar lote...</option>
                {lotesFeedlot.map((l) => (
                  <option key={l.id} value={l.id}>{l.numero_lote} — {l.campos?.nombre}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-3">
              <div><label className={labelCls}>Campo</label>
                <select value={campoId} onChange={(e) => setCampoId(e.target.value)} className={inputCls}>
                  <option value="">Seleccionar campo...</option>
                  {campos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Campana <span className="text-stone-400">(opc.)</span></label>
                <select value={campania} onChange={(e) => setCampania(e.target.value)} className={inputCls}>
                  <option value="">Sin campana</option>
                  {campanias.map((c) => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                </select>
              </div>
            </div>
          )}

          <div><label className={labelCls}>Fecha</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} /></div>

          <div><label className={labelCls}>Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>
              {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div><label className={labelCls}>Descripcion</label>
            <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: Flete Rosario 15/06" className={inputCls} /></div>

          <div><label className={labelCls}>Monto (USD)</label>
            <input type="number" min={0} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} className={inputCls} /></div>

          <div><label className={labelCls}>Observaciones</label>
            <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} className={inputCls} /></div>

          <button type="submit" disabled={guardando} className="w-full rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Registrar costo'}
          </button>
        </form>

        {/* Historial */}
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 className="text-base font-semibold text-stone-900">Historial</h2>
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="rounded-md border border-stone-300 px-2 py-1 text-sm">
              <option value="">Todos los tipos</option>
              {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select value={filtroCampo} onChange={(e) => setFiltroCampo(e.target.value)} className="rounded-md border border-stone-300 px-2 py-1 text-sm">
              <option value="">Todos los campos</option>
              {campos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <select value={filtroCampania} onChange={(e) => setFiltroCampania(e.target.value)} className="rounded-md border border-stone-300 px-2 py-1 text-sm">
              <option value="">Todas las campanas</option>
              {campanias.map((c) => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
            </select>
          </div>

          {cargando && <p className="text-sm text-stone-500">Cargando...</p>}
          {!cargando && costosFiltrados.length === 0 && <p className="text-sm text-stone-500">Sin costos registrados.</p>}
          {!cargando && costosFiltrados.length > 0 && (
            <>
              <div className="overflow-x-auto rounded-lg border border-stone-200">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                    <th className="px-3 py-2 font-medium">Fecha</th>
                    <th className="px-3 py-2 font-medium">Tipo</th>
                    <th className="px-3 py-2 font-medium">Descripcion</th>
                    <th className="px-3 py-2 font-medium">Asociado a</th>
                    <th className="px-3 py-2 text-right font-medium">Monto USD</th>
                    <th className="px-3 py-2" />
                  </tr></thead>
                  <tbody>
                    {costosFiltrados.map((c) => (
                      <tr key={c.id} className="border-t border-stone-100">
                        <td className="px-3 py-2 text-stone-600">{new Date(c.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                        <td className="px-3 py-2 text-stone-700">{TIPOS.find((t) => t.value === c.tipo)?.label ?? c.tipo}</td>
                        <td className="px-3 py-2 text-stone-700">{c.descripcion ?? '—'}</td>
                        <td className="px-3 py-2">
                          {c.lotes_feedlot ? (
                            <div>
                              <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 font-medium">Feedlot</span>
                              <span className="ml-1 text-xs text-stone-500">{c.lotes_feedlot.numero_lote} · {c.lotes_feedlot.campos?.nombre}</span>
                            </div>
                          ) : (
                            <div>
                              <span className="inline-block rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600 font-medium">General</span>
                              <span className="ml-1 text-xs text-stone-500">{c.campos?.nombre}{c.campania ? ' · ' + c.campania : ''}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-stone-900">USD {Number(c.monto_usd).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => abrirEdit(c)} className="text-xs text-stone-500 hover:text-stone-900 underline">Editar</button>
                            <button onClick={() => handleBorrar(c.id)} className="text-xs text-red-500 hover:text-red-700 underline">Borrar</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-stone-200 bg-stone-50">
                      <td colSpan={4} className="px-3 py-2 text-sm font-semibold text-stone-900">Total</td>
                      <td className="px-3 py-2 text-right font-bold text-stone-900">USD {totalFiltrado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {editCosto && (
        <Modal title="Editar costo" onClose={() => setEditCosto(null)}>
          {eError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{eError}</div>}

          <div>
            <label className={labelCls}>Asociar a</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEAsociacion('feedlot')}
                className={`flex-1 rounded-md border px-3 py-2 text-sm transition ${eAsociacion === 'feedlot' ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 text-stone-700 hover:bg-stone-50'}`}>
                Lote feedlot
              </button>
              <button type="button" onClick={() => setEAsociacion('general')}
                className={`flex-1 rounded-md border px-3 py-2 text-sm transition ${eAsociacion === 'general' ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 text-stone-700 hover:bg-stone-50'}`}>
                General (campo)
              </button>
            </div>
          </div>

          {eAsociacion === 'feedlot' ? (
            <div><label className={labelCls}>Lote feedlot</label>
              <select value={eLoteId} onChange={(e) => setELoteId(e.target.value)} className={inputCls}>
                <option value="">Seleccionar lote...</option>
                {lotesFeedlot.map((l) => <option key={l.id} value={l.id}>{l.numero_lote} — {l.campos?.nombre}</option>)}
              </select>
            </div>
          ) : (
            <div className="space-y-3">
              <div><label className={labelCls}>Campo</label>
                <select value={eCampoId} onChange={(e) => setECampoId(e.target.value)} className={inputCls}>
                  <option value="">Seleccionar campo...</option>
                  {campos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Campana <span className="text-stone-400">(opc.)</span></label>
                <select value={eCampania} onChange={(e) => setECampania(e.target.value)} className={inputCls}>
                  <option value="">Sin campana</option>
                  {campanias.map((c) => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                </select>
              </div>
            </div>
          )}

          <div><label className={labelCls}>Fecha</label>
            <input type="date" value={eFecha} onChange={(e) => setEFecha(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Tipo</label>
            <select value={eTipo} onChange={(e) => setETipo(e.target.value)} className={inputCls}>
              {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div><label className={labelCls}>Descripcion</label>
            <input value={eDescripcion} onChange={(e) => setEDescripcion(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Monto (USD)</label>
            <input type="number" min={0} step="0.01" value={eMonto} onChange={(e) => setEMonto(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Observaciones</label>
            <textarea value={eObs} onChange={(e) => setEObs(e.target.value)} rows={2} className={inputCls} /></div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setEditCosto(null)} className="flex-1 rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">Cancelar</button>
            <button onClick={handleGuardarEdit} disabled={eGuardando} className="flex-1 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50">
              {eGuardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
