'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type Producto = {
  id?: number
  producto: string
  unidad: string
  dosis_ha: string
  costo_unitario: string
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

const PRODUCTO_VACIO: Producto = { producto: '', unidad: 'L', dosis_ha: '', costo_unitario: '' }

export default function EditarAplicacionPage() {
  const { ciclo_id, aplicacion_id } = useParams<{ ciclo_id: string; aplicacion_id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [cicloInfo, setCicloInfo] = useState<{ lote: string; campo: string; campana: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    tipo: '',
    fecha: '',
    superficie_ha: '',
    costo_servicio_usd_ha: '',
  })

  const [productos, setProductos] = useState<Producto[]>([{ ...PRODUCTO_VACIO }])

  useEffect(() => {
    if (!ciclo_id || !aplicacion_id) return
    cargar()
  }, [ciclo_id, aplicacion_id])

  async function cargar() {
    setLoading(true)

    const [{ data: cicloData }, { data: aplData }, { data: prodsData }] = await Promise.all([
      supabase.from('vw_sa_resumen_ciclo').select('lote, campo, campana').eq('ciclo_id', Number(ciclo_id)).single(),
      supabase.from('sa_aplicaciones').select('*').eq('id', Number(aplicacion_id)).single(),
      supabase.from('sa_aplicacion_productos').select('*').eq('aplicacion_id', Number(aplicacion_id)),
    ])

    setCicloInfo(cicloData ?? null)

    if (aplData) {
      setForm({
        tipo: aplData.tipo ?? '',
        fecha: aplData.fecha ?? '',
        superficie_ha: aplData.superficie_ha?.toString() ?? '',
        costo_servicio_usd_ha: aplData.costo_servicio_usd_ha?.toString() ?? '',
      })
    }

    if (prodsData && prodsData.length > 0) {
      setProductos(prodsData.map((p: any) => ({
        id: p.id,
        producto: p.producto ?? '',
        unidad: p.unidad ?? 'L',
        dosis_ha: p.dosis_ha?.toString() ?? '',
        costo_unitario: p.costo_unitario?.toString() ?? '',
      })))
    }

    setLoading(false)
  }

  function handleFormChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  function handleProductoChange(index: number, field: keyof Producto, value: string) {
    setProductos(ps => ps.map((p, i) => i === index ? { ...p, [field]: value } : p))
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
      setError('Agregá al menos un producto.')
      return
    }

    setSaving(true)

    // Actualizar aplicación
    const { error: aplErr } = await supabase
      .from('sa_aplicaciones')
      .update({
        tipo: form.tipo,
        fecha: form.fecha || null,
        superficie_ha: Number(form.superficie_ha),
        costo_servicio_usd_ha: form.costo_servicio_usd_ha ? Number(form.costo_servicio_usd_ha) : null,
      })
      .eq('id', Number(aplicacion_id))

    if (aplErr) {
      setSaving(false)
      setError(`Error al actualizar: ${aplErr.message}`)
      return
    }

    // Borrar productos existentes y reinsertar
    await supabase.from('sa_aplicacion_productos').delete().eq('aplicacion_id', Number(aplicacion_id))

    const productosInsert = productosValidos.map(p => ({
      aplicacion_id: Number(aplicacion_id),
      producto: p.producto.trim(),
      unidad: p.unidad,
      dosis_ha: Number(p.dosis_ha),
      costo_unitario: Number(p.costo_unitario),
    }))

    const { error: prodErr } = await supabase.from('sa_aplicacion_productos').insert(productosInsert)

    setSaving(false)

    if (prodErr) {
      setError(`Error al guardar productos: ${prodErr.message}`)
      return
    }

    window.close()
  }

  if (loading) return <div className="text-center text-campo-400 py-20">Cargando...</div>

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      <div>
        <div className="mb-1">
          <Link href={`/seguimiento/lotes/${ciclo_id}`} className="text-sm text-campo-400 hover:text-campo-700">
            ← {cicloInfo?.lote ?? 'Volver'}
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-campo-900">Editar aplicación</h1>
        {cicloInfo && (
          <p className="text-campo-500 text-sm mt-0.5">
            {cicloInfo.lote} · {cicloInfo.campo} · {cicloInfo.campana}
          </p>
        )}
      </div>

      <div className="card p-6 space-y-5">

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Tipo de aplicación *</label>
            <select
              name="tipo"
              value={form.tipo}
              onChange={handleFormChange}
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400"
            >
              <option value="">Seleccionar tipo...</option>
              {TIPOS_APLICACION.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Fecha</label>
            <input
              type="date"
              name="fecha"
              value={form.fecha}
              onChange={handleFormChange}
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Superficie (ha) *</label>
            <input
              type="number"
              name="superficie_ha"
              value={form.superficie_ha}
              onChange={handleFormChange}
              step="0.01"
              min="0"
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Costo servicio (USD/ha)</label>
            <input
              type="number"
              name="costo_servicio_usd_ha"
              value={form.costo_servicio_usd_ha}
              onChange={handleFormChange}
              step="0.01"
              min="0"
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-campo-700">Productos aplicados *</label>
            <button
              onClick={agregarProducto}
              className="text-xs text-lime-700 hover:text-lime-600 font-medium"
            >
              + Agregar producto
            </button>
          </div>

          <div className="space-y-3">
            {productos.map((p, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4">
                  {i === 0 && <div className="text-xs text-campo-500 mb-1">Producto</div>}
                  <input
                    type="text"
                    value={p.producto}
                    onChange={e => handleProductoChange(i, 'producto', e.target.value)}
                    placeholder="Ej: Glifosato LT Platinum"
                    className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400"
                  />
                </div>
                <div className="col-span-2">
                  {i === 0 && <div className="text-xs text-campo-500 mb-1">Unidad</div>}
                  <select
                    value={p.unidad}
                    onChange={e => handleProductoChange(i, 'unidad', e.target.value)}
                    className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400"
                  >
                    <option value="L">L</option>
                    <option value="kg">kg</option>
                    <option value="cc">cc</option>
                    <option value="g">g</option>
                  </select>
                </div>
                <div className="col-span-2">
                  {i === 0 && <div className="text-xs text-campo-500 mb-1">Dosis/ha</div>}
                  <input
                    type="number"
                    value={p.dosis_ha}
                    onChange={e => handleProductoChange(i, 'dosis_ha', e.target.value)}
                    step="0.001"
                    min="0"
                    placeholder="0.00"
                    className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400"
                  />
                </div>
                <div className="col-span-3">
                  {i === 0 && <div className="text-xs text-campo-500 mb-1">Costo USD/{p.unidad}</div>}
                  <input
                    type="number"
                    value={p.costo_unitario}
                    onChange={e => handleProductoChange(i, 'costo_unitario', e.target.value)}
                    step="0.001"
                    min="0"
                    placeholder="0.00"
                    className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400"
                  />
                </div>
                <div className="col-span-1 flex justify-center">
                  {i === 0 && <div className="text-xs text-campo-500 mb-1 invisible">x</div>}
                  <button
                    onClick={() => quitarProducto(i)}
                    disabled={productos.length <= 1}
                    className="text-campo-300 hover:text-red-400 disabled:opacity-0 transition-colors text-lg leading-none pb-2"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>

          {form.superficie_ha && productos.some(p => p.dosis_ha && p.costo_unitario) && (
            <div className="mt-3 pt-3 border-t border-campo-100 text-xs text-campo-500">
              Total insumos estimado:{' '}
              <span className="font-semibold text-campo-900">
                USD {productos
                  .filter(p => p.dosis_ha && p.costo_unitario)
                  .reduce((acc, p) => acc + Number(p.dosis_ha) * Number(form.superficie_ha) * Number(p.costo_unitario), 0)
                  .toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 bg-lime-600 hover:bg-lime-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
          <button
            onClick={() => window.close()}
            className="px-4 py-2.5 text-sm font-medium text-campo-600 hover:text-campo-900 hover:bg-campo-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
        </div>

      </div>
    </div>
  )
}
