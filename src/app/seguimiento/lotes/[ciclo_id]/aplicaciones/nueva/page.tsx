'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type CicloInfo = {
  lote: string
  campo: string
  campana: string
  cultivo: string
  sup_sembrada: number
  hectareas: number
}

type Producto = {
  tipo_insumo: string
  producto: string
  unidad: string
  dosis_ha: string
  costo_unitario: string
}

type InsumoTarifario = {
  tipo_insumo: string
  insumo: string
  unidad: string | null
  precio_usd: number
  fecha_vigencia: string
}

const TIPOS_APLICACION = [
  { value: 'barbecho', label: 'Barbecho' },
  { value: 'pre_siembra', label: 'Pre-siembra incorporado' },
  { value: 'pre_emergente', label: 'Pre-Emergente' },
  { value: 'post_emergente_temprano', label: 'Post-Emergente Temprano' },
  { value: 'post_emergente', label: 'Post-Emergente' },
  { value: 'rescate', label: 'Aplicación de Rescate' },
  { value: 'desecacion', label: 'Desecación Pre-cosecha' },
  { value: 'insecticida', label: 'Insecticida' },
  { value: 'fungicida', label: 'Fungicida' },
]

const TIPOS_INSUMO = ['Herbicida', 'Fungicida', 'Insecticida', 'Coadyuvante']

const PRODUCTO_VACIO: Producto = { tipo_insumo: '', producto: '', unidad: 'L', dosis_ha: '', costo_unitario: '' }

export default function NuevaAplicacionPage() {
  const { ciclo_id } = useParams<{ ciclo_id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [ciclo, setCiclo] = useState<CicloInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Tarifario de insumos y servicios
  const [tarifarioInsumos, setTarifarioInsumos] = useState<InsumoTarifario[]>([])
  const [tarifarioServicios, setTarifarioServicios] = useState<any[]>([])

  const [form, setForm] = useState({
    tipo: '',
    fecha: '',
    superficie_ha: '',
    costo_servicio_usd_ha: '',
  })

  const [productos, setProductos] = useState<Producto[]>([{ ...PRODUCTO_VACIO }])

  useEffect(() => {
    if (!ciclo_id) return
    cargar()
  }, [ciclo_id])

  async function cargar() {
    setLoading(true)
    const [{ data: cicloData }, { data: insumos }, { data: servicios }] = await Promise.all([
      supabase.from('vw_sa_resumen_ciclo').select('lote, campo, campana, cultivo, sup_sembrada, hectareas').eq('ciclo_id', Number(ciclo_id)).single(),
      supabase.from('tarifario_insumos').select('tipo_insumo, insumo, unidad, precio_usd, fecha_vigencia').in('tipo_insumo', TIPOS_INSUMO).order('insumo').order('fecha_vigencia', { ascending: false }),
      supabase.from('tarifario_servicios').select('*').order('vigencia_desde', { ascending: false }),
    ])
    setCiclo(cicloData ?? null)
    setTarifarioInsumos(insumos ?? [])
    setTarifarioServicios(servicios ?? [])
    const supDefault = cicloData?.sup_sembrada ?? cicloData?.hectareas ?? 0
    setForm(f => ({ ...f, superficie_ha: supDefault.toString() }))
    setLoading(false)
  }

  // Obtener productos únicos por tipo de insumo
  function getProductosPorTipo(tipo: string): string[] {
    const productos = tarifarioInsumos
      .filter(t => {
        // Mapear tipo a tipo_insumo del tarifario
        const tipoMap: Record<string, string> = {
          'Herbicida': 'Herbicida',
          'Fungicida': 'Fungicida',
          'Insecticida': 'Insecticida',
          'Coadyuvante': 'Coadyuvante',
        }
        return t.insumo !== undefined
      })
    // Filtrar por tipo buscando en la BD
    return Array.from(new Set(
      tarifarioInsumos
        .filter(t => getTipoInsumo(t) === tipo)
        .map(t => t.insumo)
    )).sort()
  }

  function getTipoInsumo(insumo: InsumoTarifario): string {
    // La BD no devuelve tipo_insumo en esta query — necesitamos buscarlo
    return ''
  }

  // Obtener precio vigente para un producto a una fecha dada
  function getPrecioVigente(nombreProducto: string, fecha: string): { precio: number; unidad: string } | null {
    if (!fecha || !nombreProducto) return null
    const registros = tarifarioInsumos
      .filter(t => t.insumo === nombreProducto && t.fecha_vigencia <= fecha)
      .sort((a, b) => b.fecha_vigencia.localeCompare(a.fecha_vigencia))
    if (registros.length === 0) return null
    return { precio: registros[0].precio_usd, unidad: registros[0].unidad ?? 'L' }
  }

  // Obtener costo servicio vigente
  function getCostoServicioVigente(fecha: string): number | null {
    if (!fecha || !ciclo) return null
    const registros = tarifarioServicios
      .filter(s =>
        s.tipo_servicio?.toLowerCase().includes('pulveriz') &&
        (!s.cultivo || s.cultivo === ciclo.cultivo) &&
        s.vigencia_desde <= fecha
      )
      .sort((a, b) => b.vigencia_desde.localeCompare(a.vigencia_desde))
    if (registros.length === 0) return null
    return registros[0].costo_usd_ha
  }

  function handleFormChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))

    // Auto-completar costo servicio cuando cambia la fecha
    if (name === 'fecha' && value) {
      const costoServicio = getCostoServicioVigente(value)
      if (costoServicio) {
        setForm(f => ({ ...f, [name]: value, costo_servicio_usd_ha: costoServicio.toString() }))
      }
      // También actualizar precios de productos ya cargados
      setProductos(ps => ps.map(p => {
        if (!p.producto) return p
        const precioData = getPrecioVigente(p.producto, value)
        if (precioData) return { ...p, costo_unitario: precioData.precio.toString(), unidad: precioData.unidad }
        return p
      }))
    }
  }

  function handleProductoChange(index: number, field: keyof Producto, value: string) {
    setProductos(ps => ps.map((p, i) => {
      if (i !== index) return p
      const updated = { ...p, [field]: value }

      // Si cambió el tipo de insumo, limpiar el producto
      if (field === 'tipo_insumo') {
        return { ...updated, producto: '', costo_unitario: '' }
      }

      // Si cambió el producto, buscar precio en tarifario
      if (field === 'producto' && value && form.fecha) {
        const precioData = getPrecioVigente(value, form.fecha)
        if (precioData) {
          return { ...updated, costo_unitario: precioData.precio.toString(), unidad: precioData.unidad }
        }
      }

      return updated
    }))
  }

  function agregarProducto() {
    setProductos(ps => [...ps, { ...PRODUCTO_VACIO }])
  }

  function quitarProducto(index: number) {
    if (productos.length <= 1) return
    setProductos(ps => ps.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    setError(null)
    if (!form.tipo || !form.superficie_ha) {
      setError('Tipo de aplicación y superficie son obligatorios.')
      return
    }
    const productosValidos = productos.filter(p => p.producto && p.dosis_ha && p.costo_unitario)
    if (productosValidos.length === 0) {
      setError('Agregá al menos un producto con nombre, dosis y costo.')
      return
    }
    setSaving(true)

    const { data: existing } = await supabase
      .from('sa_aplicaciones').select('numero').eq('ciclo_id', Number(ciclo_id)).eq('tipo', form.tipo)
      .order('numero', { ascending: false }).limit(1)
    const numero = existing && existing.length > 0 ? existing[0].numero + 1 : 1

    const { data: aplData, error: aplErr } = await supabase
      .from('sa_aplicaciones')
      .insert({
        ciclo_id: Number(ciclo_id),
        tipo: form.tipo,
        numero,
        fecha: form.fecha || null,
        superficie_ha: Number(form.superficie_ha),
        costo_servicio_usd_ha: form.costo_servicio_usd_ha ? Number(form.costo_servicio_usd_ha) : null,
      })
      .select('id').single()

    if (aplErr || !aplData) {
      setSaving(false)
      setError(`Error al guardar aplicación: ${aplErr?.message}`)
      return
    }

    const productosInsert = productosValidos.map(p => ({
      aplicacion_id: aplData.id,
      producto: p.producto.trim(),
      unidad: p.unidad,
      dosis_ha: Number(p.dosis_ha),
      costo_unitario: Number(p.costo_unitario),
    }))

    const { error: prodErr } = await supabase.from('sa_aplicacion_productos').insert(productosInsert)
    setSaving(false)
    if (prodErr) { setError(`Error al guardar productos: ${prodErr.message}`); return }
    router.push(`/seguimiento/lotes/${ciclo_id}`)
  }

  if (loading) return <div className="text-center text-campo-400 py-20">Cargando...</div>
  if (!ciclo) return <div className="text-center text-campo-400 py-20">Ciclo no encontrado</div>

  // Agrupar insumos por tipo para el selector
  const insumosPorTipo: Record<string, string[]> = {}
  TIPOS_INSUMO.forEach(t => { insumosPorTipo[t] = [] })
  // Como no tenemos tipo_insumo en la query, hacemos una query separada por tipo

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <div className="mb-1">
          <Link href={`/seguimiento/lotes/${ciclo_id}`} className="text-sm text-campo-400 hover:text-campo-700">
            ← {ciclo.lote}
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-campo-900">Nueva aplicación</h1>
        <p className="text-campo-500 text-sm mt-0.5">{ciclo.lote} · {ciclo.campo} · {ciclo.campana} · {ciclo.cultivo}</p>
      </div>

      <div className="card p-6 space-y-5">

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Tipo de aplicación *</label>
            <select name="tipo" value={form.tipo} onChange={handleFormChange}
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400">
              <option value="">Seleccionar tipo...</option>
              {TIPOS_APLICACION.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Fecha</label>
            <input type="date" name="fecha" value={form.fecha} onChange={handleFormChange}
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Superficie (ha) *</label>
            <input type="number" name="superficie_ha" value={form.superficie_ha} onChange={handleFormChange}
              step="0.01" min="0" placeholder="0.00"
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">
              Costo servicio (USD/ha)
              {form.fecha && getCostoServicioVigente(form.fecha) && (
                <span className="ml-2 text-xs text-lime-600 font-normal">✓ del tarifario</span>
              )}
            </label>
            <input type="number" name="costo_servicio_usd_ha" value={form.costo_servicio_usd_ha} onChange={handleFormChange}
              step="0.01" min="0" placeholder="0.00"
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
          </div>
        </div>

        {/* Productos */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-campo-700">Productos aplicados *</label>
            <button onClick={agregarProducto} className="text-xs text-lime-700 hover:text-lime-600 font-medium">
              + Agregar producto
            </button>
          </div>

          <div className="space-y-4">
            {productos.map((p, i) => (
              <div key={i} className="space-y-2 p-3 rounded-lg bg-campo-50/50 border border-campo-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-campo-600">Producto {i + 1}</span>
                  <button onClick={() => quitarProducto(i)} disabled={productos.length <= 1}
                    className="text-campo-300 hover:text-red-400 disabled:opacity-0 text-lg leading-none">×</button>
                </div>

                {/* Tipo de insumo + Selector de producto */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs text-campo-500 mb-1">Tipo</div>
                    <select value={p.tipo_insumo} onChange={e => handleProductoChange(i, 'tipo_insumo', e.target.value)}
                      className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400">
                      <option value="">Seleccionar tipo...</option>
                      {TIPOS_INSUMO.map(t => <option key={t} value={t}>{t}</option>)}
                      <option value="otro">Otro (ingresar manualmente)</option>
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-campo-500 mb-1">
                      Producto
                      {p.costo_unitario && p.producto && <span className="ml-1 text-lime-600">✓ precio del tarifario</span>}
                    </div>
                    {p.tipo_insumo && p.tipo_insumo !== 'otro' ? (
                      <ProductoSelector
                        tipo={p.tipo_insumo}
                        value={p.producto}
                        tarifario={tarifarioInsumos}
                        onChange={val => handleProductoChange(i, 'producto', val)}
                      />
                    ) : (
                      <input type="text" value={p.producto} onChange={e => handleProductoChange(i, 'producto', e.target.value)}
                        placeholder="Nombre del producto"
                        className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
                    )}
                  </div>
                </div>

                {/* Unidad + Dosis + Costo */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-xs text-campo-500 mb-1">Unidad</div>
                    <select value={p.unidad} onChange={e => handleProductoChange(i, 'unidad', e.target.value)}
                      className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400">
                      <option value="L">L</option>
                      <option value="kg">kg</option>
                      <option value="cc">cc</option>
                      <option value="g">g</option>
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-campo-500 mb-1">Dosis/ha</div>
                    <input type="number" value={p.dosis_ha} onChange={e => handleProductoChange(i, 'dosis_ha', e.target.value)}
                      step="0.001" min="0" placeholder="0.00"
                      className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
                  </div>
                  <div>
                    <div className="text-xs text-campo-500 mb-1">Costo USD/{p.unidad}</div>
                    <input type="number" value={p.costo_unitario} onChange={e => handleProductoChange(i, 'costo_unitario', e.target.value)}
                      step="0.001" min="0" placeholder="0.00"
                      className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
                  </div>
                </div>

                {/* Subtotal por producto */}
                {p.dosis_ha && p.costo_unitario && form.superficie_ha && (
                  <div className="text-xs text-campo-400">
                    Subtotal: <span className="font-semibold text-campo-700">
                      USD {(Number(p.dosis_ha) * Number(form.superficie_ha) * Number(p.costo_unitario)).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                    <span className="ml-1">({p.dosis_ha} {p.unidad}/ha × {form.superficie_ha} ha × USD {p.costo_unitario}/{p.unidad})</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Total estimado */}
          {form.superficie_ha && productos.some(p => p.dosis_ha && p.costo_unitario) && (
            <div className="mt-3 pt-3 border-t border-campo-100 text-xs text-campo-500">
              Total insumos:{' '}
              <span className="font-semibold text-campo-900">
                USD {productos.filter(p => p.dosis_ha && p.costo_unitario)
                  .reduce((acc, p) => acc + Number(p.dosis_ha) * Number(form.superficie_ha) * Number(p.costo_unitario), 0)
                  .toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
          )}
        </div>

        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="flex gap-3 pt-2">
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 bg-lime-600 hover:bg-lime-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors">
            {saving ? 'Guardando...' : 'Guardar aplicación'}
          </button>
          <Link href={`/seguimiento/lotes/${ciclo_id}`}
            className="px-4 py-2.5 text-sm font-medium text-campo-600 hover:text-campo-900 hover:bg-campo-100 rounded-lg transition-colors">
            Cancelar
          </Link>
        </div>
      </div>
    </div>
  )
}

// Componente selector de producto con búsqueda
function ProductoSelector({ tipo, value, tarifario, onChange }: {
  tipo: string
  value: string
  tarifario: InsumoTarifario[]
  onChange: (val: string) => void
}) {
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState(false)

  const productosDelTipo = Array.from(new Set(
    tarifario.filter(t => t.tipo_insumo === tipo).map(t => t.insumo)
  )).sort()

  const filtrados = productosDelTipo.filter(p =>
    p.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="relative">
      <input
        type="text"
        value={value || busqueda}
        onChange={e => { setBusqueda(e.target.value); setAbierto(true); if (!e.target.value) onChange('') }}
        onFocus={() => { setBusqueda(''); setAbierto(true) }}
        onBlur={() => setTimeout(() => setAbierto(false), 200)}
        placeholder="Buscar producto..."
        className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400"
      />
      {abierto && (filtrados.length > 0 || busqueda) && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-campo-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtrados.map(p => (
            <button key={p} onMouseDown={() => { onChange(p); setBusqueda(''); setAbierto(false) }}
              className="w-full text-left px-3 py-2 text-sm text-campo-900 hover:bg-lime-50 hover:text-lime-800">
              {p}
            </button>
          ))}
          {filtrados.length === 0 && busqueda && (
            <div className="px-3 py-2 text-sm text-campo-400">Sin resultados — ingresalo manualmente</div>
          )}
        </div>
      )}
    </div>
  )
}
