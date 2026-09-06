'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// =====================================================================
// Tipos compartidos
// =====================================================================
type Campo = { id: number; nombre: string }
type Lote = { id: string; nombre: string; establecimiento: string }
type CategoriaHacienda = { id: string; nombre: string; orden: number }
type Campania = { id: number; nombre: string }
type ProductoVeterinario = { id: string; nombre: string; tipo: string; unidad: string; precio_usd: number | null }
type LoteFeedlot = { id: string; campania: string; categorias_hacienda: { nombre: string } }

type CostoGanaderia = {
  id: string; fecha: string; tipo: string; descripcion: string | null
  monto_usd: number; lote_feedlot_id: string | null; campo_id: number | null
  campania: string | null; categoria_id: string | null; observaciones: string | null
  feedlot_ingresos: { campania: string; categorias_hacienda: { nombre: string } } | null
  campos: { nombre: string } | null
  categorias_hacienda: { nombre: string } | null
}

type SanidadRow = {
  id: string; campo_id: number; lote_id: string | null; categoria_id: string | null
  campania_id: number | null; fecha: string; cantidad_animales: number
  dosis_por_animal: number; total_producto: number
  precio_unitario_usd: number | null; costo_total_usd: number | null
  monto_usd: number | null; lote_feedlot_id: string | null
  observaciones: string | null
  productos_veterinarios: { nombre: string; unidad: string }
  lotes: { nombre: string } | null
  categorias_hacienda: { nombre: string } | null
  campos: { nombre: string }
  campanas: { nombre: string } | null
}

type AsociacionTipo = 'feedlot' | 'general'
type Tab = 'costos' | 'sanidad'

const TIPOS_COSTO = [
  { value: 'sanidad', label: 'Sanidad' },
  { value: 'racion', label: 'Ración' },
  { value: 'flete', label: 'Flete' },
  { value: 'guia_senasa', label: 'Guía SENASA' },
  { value: 'caravanas', label: 'Caravanas' },
  { value: 'arrendamiento', label: 'Arrendamiento' },
  { value: 'mano_obra', label: 'Mano de obra' },
  { value: 'otro', label: 'Otro' },
]
const TIPOS_PRODUCTO = ['vacuna', 'antiparasitario', 'antibiotico', 'vitamina', 'otro']
const UNIDADES_PRODUCTO = ['ml', 'cc', 'comprimido', 'dosis', 'g', 'otro']
const TIPO_LABELS: Record<string, string> = {
  sanidad: 'Sanidad', racion: 'Ración', flete: 'Flete', guia_senasa: 'Guía SENASA',
  caravanas: 'Caravanas', arrendamiento: 'Arrendamiento', mano_obra: 'Mano de obra', otro: 'Otro'
}

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

function fmt(n: number, dec = 2) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

export default function CostosSanidadPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('costos')

  // Catálogos compartidos
  const [campos, setCampos] = useState<Campo[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [categorias, setCategorias] = useState<CategoriaHacienda[]>([])
  const [campanias, setCampanias] = useState<Campania[]>([])
  const [lotesFeedlot, setLotesFeedlot] = useState<LoteFeedlot[]>([])
  const [productosVet, setProductosVet] = useState<ProductoVeterinario[]>([])

  // ---- COSTOS ----
  const [costos, setCostos] = useState<CostoGanaderia[]>([])
  const [cargandoCostos, setCargandoCostos] = useState(true)
  const [asociacion, setAsociacion] = useState<AsociacionTipo>('general')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [tipo, setTipo] = useState('flete')
  const [descripcion, setDescripcion] = useState('')
  const [tipoOtroDesc, setTipoOtroDesc] = useState('')
  const [monto, setMonto] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [loteId, setLoteId] = useState('')
  const [campoId, setCampoId] = useState('')
  const [campania, setCampania] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [cGuardando, setCGuardando] = useState(false)
  const [cError, setCError] = useState<string | null>(null)
  const [cExito, setCExito] = useState<string | null>(null)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroCampo, setFiltroCampo] = useState('')
  const [filtroCampania, setFiltroCampania] = useState('')
  const [editCosto, setEditCosto] = useState<CostoGanaderia | null>(null)
  const [eFecha, setEFecha] = useState('')
  const [eTipo, setETipo] = useState('')
  const [eDesc, setEDesc] = useState('')
  const [eTipoOtroDesc, setETipoOtroDesc] = useState('')
  const [eMonto, setEMonto] = useState('')
  const [eCatId, setECatId] = useState('')
  const [eLoteId, setELoteId] = useState('')
  const [eCampoId, setECampoId] = useState('')
  const [eCampania, setECampania] = useState('')
  const [eObs, setEObs] = useState('')
  const [eAsoc, setEAsoc] = useState<AsociacionTipo>('general')
  const [eGuardando, setEGuardando] = useState(false)
  const [eError, setEError] = useState<string | null>(null)

  // ---- SANIDAD ----
  const [sanidades, setSanidades] = useState<SanidadRow[]>([])
  const [cargandoSanidad, setCargandoSanidad] = useState(true)
  const [sCampoId, setSCampoId] = useState('')
  const [sLoteId, setSLoteId] = useState('')
  const [sCategoriaId, setSCategoriaId] = useState('')
  const [sCampaniaId, setSCampaniaId] = useState('')
  const [sProductoId, setSProductoId] = useState('')
  const [sLoteFeedlotId, setSLoteFeedlotId] = useState('')
  const [sFecha, setSFecha] = useState(new Date().toISOString().slice(0, 10))
  const [sCantidad, setSCantidad] = useState('')
  const [sDosis, setSsDosis] = useState('')
  const [sPrecioUnitario, setSPrecioUnitario] = useState('')
  const [sMontoUsd, setSMontoUsd] = useState('')
  const [sObs, setSsObs] = useState('')
  const [sGuardando, setSGuardando] = useState(false)
  const [sError, setSError] = useState<string | null>(null)
  const [sExito, setSExito] = useState<string | null>(null)
  const [showNuevoProd, setShowNuevoProd] = useState(false)
  const [npNombre, setNpNombre] = useState('')
  const [npTipo, setNpTipo] = useState('vacuna')
  const [npUnidad, setNpUnidad] = useState('ml')
  const [npPrecio, setNpPrecio] = useState('')
  const [npGuardando, setNpGuardando] = useState(false)
  const [filtroCampaniaSan, setFiltroCampaniaSan] = useState('')
  const [filtroCampoSan, setFiltroCampoSan] = useState('')
  const [editSan, setEditSan] = useState<SanidadRow | null>(null)
  const [esCampaniaId, setEsCampaniaId] = useState('')
  const [esCampoId, setEsCampoId] = useState('')
  const [esLoteId, setEsLoteId] = useState('')
  const [esCatId, setEsCatId] = useState('')
  const [esProductoId, setEsProductoId] = useState('')
  const [esFecha, setEsFecha] = useState('')
  const [esCantidad, setEsCantidad] = useState('')
  const [esDosis, setEsDosis] = useState('')
  const [esPrecioUnitario, setEsPrecioUnitario] = useState('')
  const [esMontoUsd, setEsMontoUsd] = useState('')
  const [esObs, setEsObs] = useState('')
  const [esGuardando, setEsGuardando] = useState(false)
  const [esError, setEsError] = useState<string | null>(null)

  // Auto-calcular monto total de sanidad (cantidad × dosis × precio unitario)
  useEffect(() => {
    const cant = Number(sCantidad)
    const dosis = Number(sDosis)
    const precio = Number(sPrecioUnitario)
    if (cant > 0 && dosis > 0 && precio > 0) {
      setSMontoUsd(String(Number((cant * dosis * precio).toFixed(2))))
    }
  }, [sCantidad, sDosis, sPrecioUnitario])

  // Igual, pero para el modal de edición
  useEffect(() => {
    const cant = Number(esCantidad)
    const dosis = Number(esDosis)
    const precio = Number(esPrecioUnitario)
    if (cant > 0 && dosis > 0 && precio > 0) {
      setEsMontoUsd(String(Number((cant * dosis * precio).toFixed(2))))
    }
  }, [esCantidad, esDosis, esPrecioUnitario])

  useEffect(() => {
    const cargar = async () => {
      const [{ data: c }, { data: l }, { data: cat }, { data: camp }, { data: lf }, { data: prod }] = await Promise.all([
        supabase.from('campos').select('id, nombre').order('nombre'),
        supabase.from('lotes').select('id, nombre, establecimiento').eq('activo', true).order('nombre'),
        supabase.from('categorias_hacienda').select('id, nombre, orden').order('orden'),
        supabase.from('campanas').select('id, nombre').order('nombre', { ascending: false }),
        supabase.from('feedlot_ingresos').select('id, campania, categorias_hacienda(nombre)').order('fecha_entrada', { ascending: false }),
        supabase.from('productos_veterinarios').select('id, nombre, tipo, unidad, precio_usd').eq('activo', true).order('nombre'),
      ])
      setCampos(c ?? [])
      setLotes(l ?? [])
      setCategorias(cat ?? [])
      setCampanias(camp ?? [])
      setLotesFeedlot((lf ?? []) as unknown as LoteFeedlot[])
      setProductosVet(prod ?? [])
    }
    cargar()
    cargarCostos()
    cargarSanidad()
  }, [])

  const cargarCostos = async () => {
    setCargandoCostos(true)
    const { data } = await supabase.from('costos_ganaderia')
      .select('*, feedlot_ingresos(campania, categorias_hacienda(nombre)), campos(nombre), categorias_hacienda(nombre)')
      .order('fecha', { ascending: false })
    setCostos((data ?? []) as unknown as CostoGanaderia[])
    setCargandoCostos(false)
  }

  const cargarSanidad = async () => {
    setCargandoSanidad(true)
    const { data } = await supabase.from('sanidad_hacienda')
      .select('*, productos_veterinarios(nombre, unidad), lotes(nombre), categorias_hacienda(nombre), campos(nombre), campanas(nombre)')
      .order('fecha', { ascending: false })
    setSanidades((data ?? []) as unknown as SanidadRow[])
    setCargandoSanidad(false)
  }

  const nombreCampo = (id: string) => campos.find(c => c.id === Number(id))?.nombre ?? ''
  const lotesPorCampo = (campoIdStr: string) =>
    campoIdStr ? lotes.filter(l => l.establecimiento === nombreCampo(campoIdStr)) : lotes

  // ---- Acciones costos ----
  const handleSubmitCosto = async (e: React.FormEvent) => {
    e.preventDefault(); setCError(null); setCExito(null)
    if (!monto || Number(monto) <= 0) return setCError('Ingresá un monto válido.')
    if (asociacion === 'feedlot' && !loteId) return setCError('Seleccioná un lote feedlot.')
    if (asociacion === 'general' && !campoId) return setCError('Seleccioná un campo.')
    setCGuardando(true)
    try {
      const { error } = await supabase.from('costos_ganaderia').insert({
        fecha, tipo,
        descripcion: tipo === 'otro' ? (tipoOtroDesc || null) : (descripcion || null),
        monto_usd: Number(monto),
        categoria_id: categoriaId || null,
        lote_feedlot_id: asociacion === 'feedlot' ? loteId : null,
        campo_id: asociacion === 'general' ? Number(campoId) : null,
        campania: asociacion === 'general' && campania ? campania : null,
        observaciones: observaciones || null,
      })
      if (error) throw error
      setCExito('Costo registrado.')
      setDescripcion(''); setTipoOtroDesc(''); setMonto(''); setCategoriaId('')
      setLoteId(''); setCampoId(''); setCampania(''); setObservaciones('')
      cargarCostos()
    } catch (err: any) { setCError(err.message) }
    finally { setCGuardando(false) }
  }

  const abrirEditCosto = (c: CostoGanaderia) => {
    setEditCosto(c); setEFecha(c.fecha); setETipo(c.tipo); setEDesc(c.descripcion ?? '')
    setETipoOtroDesc(c.tipo === 'otro' ? (c.descripcion ?? '') : '')
    setEMonto(String(c.monto_usd)); setECatId(c.categoria_id ?? '')
    setELoteId(c.lote_feedlot_id ?? ''); setECampoId(c.campo_id ? String(c.campo_id) : '')
    setECampania(c.campania ?? ''); setEObs(c.observaciones ?? '')
    setEAsoc(c.lote_feedlot_id ? 'feedlot' : 'general'); setEError(null)
  }

  const handleGuardarEditCosto = async () => {
    if (!editCosto) return; setEError(null)
    if (!eMonto || Number(eMonto) <= 0) return setEError('Ingresá un monto válido.')
    setEGuardando(true)
    try {
      const { error } = await supabase.from('costos_ganaderia').update({
        fecha: eFecha, tipo: eTipo,
        descripcion: eTipo === 'otro' ? (eTipoOtroDesc || null) : (eDesc || null),
        monto_usd: Number(eMonto), categoria_id: eCatId || null,
        lote_feedlot_id: eAsoc === 'feedlot' ? eLoteId : null,
        campo_id: eAsoc === 'general' ? Number(eCampoId) : null,
        campania: eAsoc === 'general' && eCampania ? eCampania : null,
        observaciones: eObs || null,
      }).eq('id', editCosto.id)
      if (error) throw error
      setEditCosto(null); cargarCostos()
    } catch (err: any) { setEError(err.message) }
    finally { setEGuardando(false) }
  }

  const handleBorrarCosto = async (id: string) => {
    if (!confirm('¿Borrar este costo?')) return
    await supabase.from('costos_ganaderia').delete().eq('id', id)
    cargarCostos()
  }

  // ---- Acciones sanidad ----
  const handleSelectProducto = (id: string) => {
    setSProductoId(id)
    const p = productosVet.find(x => x.id === id)
    setSPrecioUnitario(p?.precio_usd ? String(p.precio_usd) : '')
  }

  const handleSubmitSanidad = async (e: React.FormEvent) => {
    e.preventDefault(); setSError(null); setSExito(null)
    if (!sCampoId) return setSError('Seleccioná un campo.')
    if (!sProductoId) return setSError('Seleccioná un producto.')
    if (!sCantidad || Number(sCantidad) <= 0) return setSError('Ingresá la cantidad de animales.')
    if (!sDosis || Number(sDosis) <= 0) return setSError('Ingresá la dosis por animal.')
    setSGuardando(true)
    try {
      const { error } = await supabase.from('sanidad_hacienda').insert({
        campo_id: Number(sCampoId), lote_id: sLoteId || null, categoria_id: sCategoriaId || null,
        campania_id: sCampaniaId ? Number(sCampaniaId) : null,
        producto_id: sProductoId, fecha: sFecha,
        cantidad_animales: Number(sCantidad), dosis_por_animal: Number(sDosis),
        precio_unitario_usd: sPrecioUnitario ? Number(sPrecioUnitario) : null,
        lote_feedlot_id: sLoteFeedlotId || null,
        monto_usd: sMontoUsd ? Number(sMontoUsd) : null,
        observaciones: sObs || null,
      })
      if (error) throw error
      setSExito('Aplicación registrada.')
      setSLoteId(''); setSCategoriaId(''); setSProductoId(''); setSCantidad('')
      setSsDosis(''); setSPrecioUnitario(''); setSMontoUsd(''); setSsObs('')
      setSLoteFeedlotId('')
      cargarSanidad()
    } catch (err: any) { setSError(err.message) }
    finally { setSGuardando(false) }
  }

  const handleGuardarProducto = async () => {
    if (!npNombre.trim()) return
    setNpGuardando(true)
    const { data, error } = await supabase.from('productos_veterinarios')
      .insert({ nombre: npNombre.trim(), tipo: npTipo, unidad: npUnidad, precio_usd: npPrecio ? Number(npPrecio) : null })
      .select('id, nombre, tipo, unidad, precio_usd').single()
    if (!error && data) {
      setProductosVet(prev => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      setSProductoId(data.id)
      if (data.precio_usd) setSPrecioUnitario(String(data.precio_usd))
      setNpNombre(''); setNpTipo('vacuna'); setNpUnidad('ml'); setNpPrecio('')
      setShowNuevoProd(false)
    }
    setNpGuardando(false)
  }

  const abrirEditSan = (s: SanidadRow) => {
    setEditSan(s); setEsCampaniaId(s.campania_id ? String(s.campania_id) : '')
    setEsCampoId(String(s.campo_id)); setEsLoteId(s.lote_id ?? '')
    setEsCatId(s.categoria_id ?? ''); setEsProductoId(''); setEsFecha(s.fecha)
    setEsCantidad(String(s.cantidad_animales)); setEsDosis(String(s.dosis_por_animal))
    setEsPrecioUnitario(s.precio_unitario_usd ? String(s.precio_unitario_usd) : '')
    setEsMontoUsd(s.monto_usd ? String(s.monto_usd) : ''); setEsObs(s.observaciones ?? '')
    setEsError(null)
  }

  const handleGuardarEditSan = async () => {
    if (!editSan) return; setEsError(null)
    setEsGuardando(true)
    try {
      const updateData: Record<string, any> = {
        campo_id: Number(esCampoId), lote_id: esLoteId || null, categoria_id: esCatId || null,
        campania_id: esCampaniaId ? Number(esCampaniaId) : null,
        fecha: esFecha, cantidad_animales: Number(esCantidad), dosis_por_animal: Number(esDosis),
        precio_unitario_usd: esPrecioUnitario ? Number(esPrecioUnitario) : null,
        monto_usd: esMontoUsd ? Number(esMontoUsd) : null,
        observaciones: esObs || null,
      }
      if (esProductoId) updateData.producto_id = esProductoId
      const { error } = await supabase.from('sanidad_hacienda').update(updateData).eq('id', editSan.id)
      if (error) throw error
      setEditSan(null); cargarSanidad()
    } catch (err: any) { setEsError(err.message) }
    finally { setEsGuardando(false) }
  }

  const handleBorrarSan = async (id: string) => {
    if (!confirm('¿Borrar este registro de sanidad?')) return
    await supabase.from('sanidad_hacienda').delete().eq('id', id)
    cargarSanidad()
  }

  // Totales y filtros
  const costosFiltrados = costos.filter(c => {
    if (filtroTipo && c.tipo !== filtroTipo) return false
    if (filtroCampo) {
      const cn = campos.find(x => x.id === Number(filtroCampo))?.nombre
      if (c.campos?.nombre !== cn) return false
    }
    if (filtroCampania && c.campania !== filtroCampania) return false
    return true
  })
  const totalCostos = costosFiltrados.reduce((s, c) => s + c.monto_usd, 0)

  const sanidadesFiltradas = sanidades.filter(s => {
    if (filtroCampaniaSan && s.campanas?.nombre !== filtroCampaniaSan) return false
    if (filtroCampoSan && s.campo_id !== Number(filtroCampoSan)) return false
    return true
  })
  const totalSanidad = sanidadesFiltradas.reduce((s, x) => s + (x.monto_usd ?? 0), 0)

  const productoSel = productosVet.find(p => p.id === sProductoId)
  const totalProducto = Number(sCantidad) * Number(sDosis)
  const costoTotalSan = totalProducto * Number(sPrecioUnitario)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Costos y Sanidad</h1>
        <p className="text-sm text-stone-500">Registro de costos ganaderos y aplicaciones sanitarias.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-stone-200">
        {([['costos', '💰 Costos'], ['sanidad', '💉 Sanidad']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${tab === t ? 'border-b-2 border-stone-900 text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* =============== TAB COSTOS =============== */}
      {tab === 'costos' && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[380px_1fr]">
          <form onSubmit={handleSubmitCosto} className="space-y-4 rounded-lg border border-stone-200 bg-white p-6">
            <h2 className="text-base font-semibold text-stone-900">Nuevo costo</h2>
            {cError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{cError}</div>}
            {cExito && <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{cExito}</div>}

            {/* Asociación */}
            <div>
              <label className={labelCls}>Asociar a</label>
              <div className="flex gap-2">
                {(['feedlot', 'general'] as AsociacionTipo[]).map(a => (
                  <button key={a} type="button" onClick={() => setAsociacion(a)}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm transition ${asociacion === a ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 text-stone-700 hover:bg-stone-50'}`}>
                    {a === 'feedlot' ? 'Lote feedlot' : 'General (campo)'}
                  </button>
                ))}
              </div>
            </div>

            {asociacion === 'feedlot' ? (
              <div><label className={labelCls}>Lote feedlot</label>
                <select value={loteId} onChange={e => setLoteId(e.target.value)} className={inputCls}>
                  <option value="">Seleccionar lote...</option>
                  {lotesFeedlot.map(l => <option key={l.id} value={l.id}>{(l as any).campania} · {(l as any).categorias_hacienda?.nombre}</option>)}
                </select></div>
            ) : (
              <div className="space-y-3">
                <div><label className={labelCls}>Campo</label>
                  <select value={campoId} onChange={e => setCampoId(e.target.value)} className={inputCls}>
                    <option value="">Seleccionar campo...</option>
                    {campos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select></div>
                <div><label className={labelCls}>Campaña <span className="text-stone-400">(opc.)</span></label>
                  <select value={campania} onChange={e => setCampania(e.target.value)} className={inputCls}>
                    <option value="">Sin campaña</option>
                    {campanias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                  </select></div>
              </div>
            )}

            <div><label className={labelCls}>Categoría <span className="text-stone-400">(opc.)</span></label>
              <select value={categoriaId} onChange={e => setCategoriaId(e.target.value)} className={inputCls}>
                <option value="">Todas las categorías</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select></div>

            <div><label className={labelCls}>Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} /></div>

            <div><label className={labelCls}>Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)} className={inputCls}>
                {TIPOS_COSTO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select></div>

            {tipo === 'otro' ? (
              <div><label className={labelCls}>Descripción del costo</label>
                <input value={tipoOtroDesc} onChange={e => setTipoOtroDesc(e.target.value)} placeholder="Ej: Caravanas SENASA, Reparación alambrado..." className={inputCls} /></div>
            ) : (
              <div><label className={labelCls}>Descripción <span className="text-stone-400">(opc.)</span></label>
                <input value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Ej: Flete Rosario 15/06" className={inputCls} /></div>
            )}

            <div><label className={labelCls}>Monto (USD)</label>
              <input type="number" min={0} step="0.01" value={monto} onChange={e => setMonto(e.target.value)} className={inputCls} /></div>

            <div><label className={labelCls}>Observaciones</label>
              <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2} className={inputCls} /></div>

            <button type="submit" disabled={cGuardando} className="w-full rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50">
              {cGuardando ? 'Guardando...' : 'Registrar costo'}
            </button>
          </form>

          <div>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <h2 className="text-base font-semibold text-stone-900">Historial</h2>
              <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="rounded-md border border-stone-300 px-2 py-1 text-sm">
                <option value="">Todos los tipos</option>
                {TIPOS_COSTO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <select value={filtroCampo} onChange={e => setFiltroCampo(e.target.value)} className="rounded-md border border-stone-300 px-2 py-1 text-sm">
                <option value="">Todos los campos</option>
                {campos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <select value={filtroCampania} onChange={e => setFiltroCampania(e.target.value)} className="rounded-md border border-stone-300 px-2 py-1 text-sm">
                <option value="">Todas las campañas</option>
                {campanias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
              </select>
            </div>
            {cargandoCostos && <p className="text-sm text-stone-500">Cargando...</p>}
            {!cargandoCostos && costosFiltrados.length === 0 && <p className="text-sm text-stone-500">Sin costos registrados.</p>}
            {!cargandoCostos && costosFiltrados.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-stone-200">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                    <th className="px-3 py-2 font-medium">Fecha</th>
                    <th className="px-3 py-2 font-medium">Tipo</th>
                    <th className="px-3 py-2 font-medium">Descripción</th>
                    <th className="px-3 py-2 font-medium">Asociado a</th>
                    <th className="px-3 py-2 text-right font-medium">USD</th>
                    <th className="px-3 py-2" />
                  </tr></thead>
                  <tbody>
                    {costosFiltrados.map(c => (
                      <tr key={c.id} className="border-t border-stone-100">
                        <td className="px-3 py-2 text-stone-600">{new Date(c.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                        <td className="px-3 py-2 text-stone-700">{TIPO_LABELS[c.tipo] ?? c.tipo}</td>
                        <td className="px-3 py-2 text-stone-700">{c.descripcion ?? '—'}</td>
                        <td className="px-3 py-2">
                          {c.feedlot_ingresos
                            ? <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Feedlot · {c.feedlot_ingresos.campania} · {c.feedlot_ingresos.categorias_hacienda?.nombre}</span>
                            : <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">{c.campos?.nombre}{c.campania ? ' · ' + c.campania : ''}</span>}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-stone-900">USD {fmt(c.monto_usd)}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => abrirEditCosto(c)} className="text-xs text-stone-500 hover:text-stone-900 underline">Editar</button>
                            <button onClick={() => handleBorrarCosto(c.id)} className="text-xs text-red-500 hover:text-red-700 underline">Borrar</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className="border-t-2 border-stone-200 bg-stone-50">
                    <td colSpan={4} className="px-3 py-2 font-semibold text-stone-900">Total</td>
                    <td className="px-3 py-2 text-right font-bold text-stone-900">USD {fmt(totalCostos)}</td>
                    <td />
                  </tr></tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =============== TAB SANIDAD =============== */}
      {tab === 'sanidad' && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[380px_1fr]">
          <div className="space-y-4">
            <form onSubmit={handleSubmitSanidad} className="space-y-4 rounded-lg border border-stone-200 bg-white p-6">
              <h2 className="text-base font-semibold text-stone-900">Nueva aplicación sanitaria</h2>
              {sError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{sError}</div>}
              {sExito && <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{sExito}</div>}

              <div><label className={labelCls}>Campaña</label>
                <select value={sCampaniaId} onChange={e => setSCampaniaId(e.target.value)} className={inputCls}>
                  <option value="">Seleccionar campaña...</option>
                  {campanias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select></div>

              <div><label className={labelCls}>Campo</label>
                <select value={sCampoId} onChange={e => { setSCampoId(e.target.value); setSLoteId('') }} className={inputCls}>
                  <option value="">Seleccionar campo...</option>
                  {campos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select></div>

              <div><label className={labelCls}>Lote <span className="text-stone-400">(opc.)</span></label>
                <select value={sLoteId} onChange={e => setSLoteId(e.target.value)} disabled={!sCampoId} className={`${inputCls} disabled:opacity-50`}>
                  <option value="">Todo el campo</option>
                  {lotesPorCampo(sCampoId).map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                </select></div>

              <div><label className={labelCls}>Categoría <span className="text-stone-400">(opc.)</span></label>
                <select value={sCategoriaId} onChange={e => setSCategoriaId(e.target.value)} className={inputCls}>
                  <option value="">Todas las categorías</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select></div>

              <div><label className={labelCls}>Lote feedlot <span className="text-stone-400">(opc.)</span></label>
                <select value={sLoteFeedlotId} onChange={e => setSLoteFeedlotId(e.target.value)} className={inputCls}>
                  <option value="">Sin vincular al feedlot</option>
                  {lotesFeedlot.map(l => <option key={l.id} value={l.id}>{(l as any).campania} · {(l as any).categorias_hacienda?.nombre}</option>)}
                </select></div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-sm font-medium text-stone-700">Producto</label>
                  <button type="button" onClick={() => setShowNuevoProd(v => !v)} className="text-xs text-stone-500 underline hover:text-stone-700">
                    {showNuevoProd ? 'Cancelar' : '+ Nuevo producto'}
                  </button>
                </div>
                {showNuevoProd ? (
                  <div className="space-y-2 rounded-md border border-stone-200 bg-stone-50 p-3">
                    <input placeholder="Nombre del producto" value={npNombre} onChange={e => setNpNombre(e.target.value)} className={inputCls} />
                    <select value={npTipo} onChange={e => setNpTipo(e.target.value)} className={inputCls}>
                      {TIPOS_PRODUCTO.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                    </select>
                    <select value={npUnidad} onChange={e => setNpUnidad(e.target.value)} className={inputCls}>
                      {UNIDADES_PRODUCTO.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <div>
                      <label className="mb-1 block text-xs text-stone-600">Precio (USD / {npUnidad})</label>
                      <input type="number" min={0} step="0.01" value={npPrecio} onChange={e => setNpPrecio(e.target.value)} className={inputCls} />
                    </div>
                    <button type="button" onClick={handleGuardarProducto} disabled={npGuardando || !npNombre.trim()} className="w-full rounded-md bg-stone-800 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
                      {npGuardando ? 'Guardando...' : 'Guardar producto'}
                    </button>
                  </div>
                ) : (
                  <select value={sProductoId} onChange={e => handleSelectProducto(e.target.value)} className={inputCls}>
                    <option value="">Seleccionar producto...</option>
                    {productosVet.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.tipo})</option>)}
                  </select>
                )}
              </div>

              <div><label className={labelCls}>Fecha</label>
                <input type="date" value={sFecha} onChange={e => setSFecha(e.target.value)} className={inputCls} /></div>

              <div><label className={labelCls}>Cantidad de animales</label>
                <input type="number" min={1} value={sCantidad} onChange={e => setSCantidad(e.target.value)} className={inputCls} /></div>

              <div>
                <label className={labelCls}>Dosis por animal {productoSel ? `(${productoSel.unidad})` : ''}</label>
                <input type="number" min={0} step="0.001" value={sDosis} onChange={e => setSsDosis(e.target.value)} className={inputCls} />
                {sCantidad && sDosis && totalProducto > 0 && (
                  <p className="mt-1 text-xs text-stone-500">Total: {totalProducto.toLocaleString('es-AR', { maximumFractionDigits: 3 })} {productoSel?.unidad}</p>
                )}
              </div>

              <div>
                <label className={labelCls}>Precio por {productoSel?.unidad ?? 'unidad'} (USD)</label>
                <input type="number" min={0} step="0.01" value={sPrecioUnitario} onChange={e => setSPrecioUnitario(e.target.value)} className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Monto total (USD) <span className="text-stone-400">(opc. — se usa en el resumen)</span></label>
                <input type="number" min={0} step="0.01" placeholder={costoTotalSan > 0 ? String(costoTotalSan.toFixed(2)) : '0.00'} value={sMontoUsd} onChange={e => setSMontoUsd(e.target.value)} className={inputCls} />
                {costoTotalSan > 0 && !sMontoUsd && (
                  <p className="mt-1 text-xs text-stone-400">Calculado: USD {fmt(costoTotalSan)} · <button type="button" className="underline" onClick={() => setSMontoUsd(costoTotalSan.toFixed(2))}>usar este valor</button></p>
                )}
              </div>

              <div><label className={labelCls}>Observaciones</label>
                <textarea value={sObs} onChange={e => setSsObs(e.target.value)} rows={2} className={inputCls} /></div>

              <button type="submit" disabled={sGuardando} className="w-full rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50">
                {sGuardando ? 'Guardando...' : 'Registrar aplicación'}
              </button>
            </form>

            {/* Catálogo productos */}
            <details className="rounded-lg border border-stone-200 bg-white p-4">
              <summary className="text-sm font-semibold text-stone-900 cursor-pointer">Catálogo de productos</summary>
              <div className="mt-3 space-y-2">
                {productosVet.length === 0 && <p className="text-xs text-stone-500">Sin productos cargados.</p>}
                {productosVet.map(p => (
                  <div key={p.id} className="flex items-center justify-between rounded-md border border-stone-100 px-3 py-2">
                    <div>
                      <span className="text-sm font-medium text-stone-900">{p.nombre}</span>
                      <span className="ml-2 text-xs text-stone-500">{p.tipo} · {p.unidad}</span>
                      {p.precio_usd && <span className="ml-2 text-xs text-stone-500">USD {fmt(p.precio_usd)}/{p.unidad}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </div>

          <div>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <h2 className="text-base font-semibold text-stone-900">Historial de sanidad</h2>
              <select value={filtroCampaniaSan} onChange={e => setFiltroCampaniaSan(e.target.value)} className="rounded-md border border-stone-300 px-2 py-1 text-sm">
                <option value="">Todas las campañas</option>
                {campanias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
              </select>
              <select value={filtroCampoSan} onChange={e => setFiltroCampoSan(e.target.value)} className="rounded-md border border-stone-300 px-2 py-1 text-sm">
                <option value="">Todos los campos</option>
                {campos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              {totalSanidad > 0 && <span className="ml-auto text-sm font-medium text-stone-700">Total: USD {fmt(totalSanidad)}</span>}
            </div>
            {cargandoSanidad && <p className="text-sm text-stone-500">Cargando...</p>}
            {!cargandoSanidad && sanidadesFiltradas.length === 0 && <p className="text-sm text-stone-500">Sin aplicaciones registradas.</p>}
            {!cargandoSanidad && sanidadesFiltradas.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-stone-200">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                    <th className="px-3 py-2 font-medium">Campaña</th>
                    <th className="px-3 py-2 font-medium">Fecha</th>
                    <th className="px-3 py-2 font-medium">Campo / Lote</th>
                    <th className="px-3 py-2 font-medium">Categoría</th>
                    <th className="px-3 py-2 font-medium">Producto</th>
                    <th className="px-3 py-2 text-right font-medium">Animales</th>
                    <th className="px-3 py-2 text-right font-medium">Total prod.</th>
                    <th className="px-3 py-2 text-right font-medium">Costo USD</th>
                    <th className="px-3 py-2" />
                  </tr></thead>
                  <tbody>
                    {sanidadesFiltradas.map(s => (
                      <tr key={s.id} className="border-t border-stone-100">
                        <td className="px-3 py-2 text-stone-600">{s.campanas?.nombre ?? '—'}</td>
                        <td className="px-3 py-2 text-stone-600">{new Date(s.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                        <td className="px-3 py-2"><div className="font-medium text-stone-900">{s.campos?.nombre}</div><div className="text-xs text-stone-500">{s.lotes?.nombre ?? 'Todo el campo'}</div></td>
                        <td className="px-3 py-2 text-stone-700">{s.categorias_hacienda?.nombre ?? 'Todas'}</td>
                        <td className="px-3 py-2 text-stone-700">{s.productos_veterinarios?.nombre}</td>
                        <td className="px-3 py-2 text-right text-stone-900">{s.cantidad_animales.toLocaleString('es-AR')}</td>
                        <td className="px-3 py-2 text-right text-stone-900">{Number(s.total_producto).toLocaleString('es-AR', { maximumFractionDigits: 3 })} {s.productos_veterinarios?.unidad}</td>
                        <td className="px-3 py-2 text-right font-medium text-stone-900">{s.monto_usd ? `USD ${fmt(s.monto_usd)}` : '—'}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => abrirEditSan(s)} className="text-xs text-stone-500 hover:text-stone-900 underline">Editar</button>
                            <button onClick={() => handleBorrarSan(s.id)} className="text-xs text-red-500 hover:text-red-700 underline">Borrar</button>
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
      )}

      {/* Modal editar costo */}
      {editCosto && (
        <Modal title="Editar costo" onClose={() => setEditCosto(null)}>
          {eError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{eError}</div>}
          <div>
            <label className={labelCls}>Asociar a</label>
            <div className="flex gap-2">
              {(['feedlot', 'general'] as AsociacionTipo[]).map(a => (
                <button key={a} type="button" onClick={() => setEAsoc(a)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm transition ${eAsoc === a ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 text-stone-700 hover:bg-stone-50'}`}>
                  {a === 'feedlot' ? 'Lote feedlot' : 'General (campo)'}
                </button>
              ))}
            </div>
          </div>
          {eAsoc === 'feedlot' ? (
            <div><label className={labelCls}>Lote feedlot</label>
              <select value={eLoteId} onChange={e => setELoteId(e.target.value)} className={inputCls}>
                <option value="">Seleccionar lote...</option>
                {lotesFeedlot.map(l => <option key={l.id} value={l.id}>{(l as any).campania} · {(l as any).categorias_hacienda?.nombre}</option>)}
              </select></div>
          ) : (
            <div className="space-y-3">
              <div><label className={labelCls}>Campo</label>
                <select value={eCampoId} onChange={e => setECampoId(e.target.value)} className={inputCls}>
                  <option value="">Seleccionar campo...</option>
                  {campos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select></div>
              <div><label className={labelCls}>Campaña</label>
                <select value={eCampania} onChange={e => setECampania(e.target.value)} className={inputCls}>
                  <option value="">Sin campaña</option>
                  {campanias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                </select></div>
            </div>
          )}
          <div><label className={labelCls}>Fecha</label>
            <input type="date" value={eFecha} onChange={e => setEFecha(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Tipo</label>
            <select value={eTipo} onChange={e => setETipo(e.target.value)} className={inputCls}>
              {TIPOS_COSTO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select></div>
          {eTipo === 'otro' ? (
            <div><label className={labelCls}>Descripción del costo</label>
              <input value={eTipoOtroDesc} onChange={e => setETipoOtroDesc(e.target.value)} className={inputCls} /></div>
          ) : (
            <div><label className={labelCls}>Descripción</label>
              <input value={eDesc} onChange={e => setEDesc(e.target.value)} className={inputCls} /></div>
          )}
          <div><label className={labelCls}>Monto (USD)</label>
            <input type="number" min={0} step="0.01" value={eMonto} onChange={e => setEMonto(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Observaciones</label>
            <textarea value={eObs} onChange={e => setEObs(e.target.value)} rows={2} className={inputCls} /></div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setEditCosto(null)} className="flex-1 rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">Cancelar</button>
            <button onClick={handleGuardarEditCosto} disabled={eGuardando} className="flex-1 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50">
              {eGuardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal editar sanidad */}
      {editSan && (
        <Modal title="Editar aplicación sanitaria" onClose={() => setEditSan(null)}>
          {esError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{esError}</div>}
          <div><label className={labelCls}>Campaña</label>
            <select value={esCampaniaId} onChange={e => setEsCampaniaId(e.target.value)} className={inputCls}>
              <option value="">Sin campaña</option>
              {campanias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select></div>
          <div><label className={labelCls}>Campo</label>
            <select value={esCampoId} onChange={e => { setEsCampoId(e.target.value); setEsLoteId('') }} className={inputCls}>
              {campos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select></div>
          <div><label className={labelCls}>Lote <span className="text-stone-400">(opc.)</span></label>
            <select value={esLoteId} onChange={e => setEsLoteId(e.target.value)} className={inputCls}>
              <option value="">Todo el campo</option>
              {lotesPorCampo(esCampoId).map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select></div>
          <div><label className={labelCls}>Categoría <span className="text-stone-400">(opc.)</span></label>
            <select value={esCatId} onChange={e => setEsCatId(e.target.value)} className={inputCls}>
              <option value="">Todas las categorías</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select></div>
          <div><label className={labelCls}>Producto</label>
            <select value={esProductoId} onChange={e => setEsProductoId(e.target.value)} className={inputCls}>
              <option value="">— mismo producto ({editSan.productos_veterinarios?.nombre}) —</option>
              {productosVet.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.tipo})</option>)}
            </select></div>
          <div><label className={labelCls}>Fecha</label>
            <input type="date" value={esFecha} onChange={e => setEsFecha(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Cantidad de animales</label>
            <input type="number" min={1} value={esCantidad} onChange={e => setEsCantidad(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Dosis por animal</label>
            <input type="number" min={0} step="0.001" value={esDosis} onChange={e => setEsDosis(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Precio por unidad (USD)</label>
            <input type="number" min={0} step="0.01" value={esPrecioUnitario} onChange={e => setEsPrecioUnitario(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Monto total (USD)</label>
            <input type="number" min={0} step="0.01" value={esMontoUsd} onChange={e => setEsMontoUsd(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Observaciones</label>
            <textarea value={esObs} onChange={e => setEsObs(e.target.value)} rows={2} className={inputCls} /></div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setEditSan(null)} className="flex-1 rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">Cancelar</button>
            <button onClick={handleGuardarEditSan} disabled={esGuardando} className="flex-1 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50">
              {esGuardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
