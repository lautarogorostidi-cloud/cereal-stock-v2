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
}

type Producto = {
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

export default function NuevaAplicacionPage() {
  const { ciclo_id } = useParams<{ ciclo_id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [ciclo, setCiclo] = useState<CicloInfo | null>(null)
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
    if (!ciclo_id) return
    cargar()
  }, [ciclo_id])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('vw_sa_resumen_ciclo')
      .select('lote, campo, campana, cultivo')
      .eq('ciclo_id', Number(ciclo_id))
      .single()
    setCiclo(data ?? null)
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

    // Obtener el número siguiente para este tipo
    const { data: existing } = await supabase
      .from('sa_aplicaciones')
      .select('numero')
      .eq('ciclo_id', Number(ciclo_id))
      .eq('tipo', form.tipo)
      .order('numero', { ascending: false })
      .limit(1)

    const numero = existing && existing.length > 0 ? existing[0].numero + 1 : 1

    // Insertar aplicación
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
      .select('id')
      .single()

    if (aplErr || !aplData) {
      setSaving(false)
      setError(`Error al guardar aplicación: ${aplErr?.message}`)
      return
    }

    // Insertar productos
    const productosInsert = productosValidos.map(p => ({
      aplicacion_id: aplData.id,
      producto: p.producto.trim(),
      unidad: p.unidad,
      dosis_ha: Number(p.dosis_ha),
      costo_unitario: Number(p.costo_unitario),
    }))

    const { error: prodErr } = await supabase
      .from('sa_aplicacion_productos')
      .insert(productosInsert)

    setSaving(false)

    if (prodErr) {
      setError(`Error al guardar productos: ${prodErr.message}`)
      return
    }

    router.push(`/seguimiento/lotes/${ciclo_id}`)
  }

  if (loading) return <div className="text-center text-campo-400 py-20">Cargando...</div>
  if (!ciclo) return <div className="text-center text-campo-400 py-20">Ciclo no encontrado</div>

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <div className="mb-1">
          <Link href={`/seguimiento/lotes/${ciclo_id}`} className="text-sm text-campo-400 hover:text-campo-700">
            ← {ciclo.lote}
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-campo-900">Nueva aplicación</h1>
        <p className="text-campo-500 text-sm mt-0.5">
          {ciclo.lote} · {ciclo.campo} · {ciclo.campana} · {ciclo.cultivo}
        </p>
      </div>

      <div className="card p-6 space-y-5">

        {/* Tipo + Fecha */}
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

        {/* Superficie + Costo servicio */}
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
              placeholder="0.00"
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
              placeholder="0.00"
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400"
            />
          </div>
        </div>

        {/* Productos */}
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
                {/* Nombre */}
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
                {/* Unidad */}
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
                {/* Dosis */}
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
                {/* Costo unitario */}
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
                {/* Quitar */}
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

          {/* Total estimado */}
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

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 bg-lime-600 hover:bg-lime-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors"
          >
            {saving ? 'Guardando...' : 'Guardar aplicación'}
          </button>
          <Link
            href={`/seguimiento/lotes/${ciclo_id}`}
            className="px-4 py-2.5 text-sm font-medium text-campo-600 hover:text-campo-900 hover:bg-campo-100 rounded-lg transition-colors"
          >
            Cancelar
          </Link>
        </div>

      </div>
    </div>
  )
}