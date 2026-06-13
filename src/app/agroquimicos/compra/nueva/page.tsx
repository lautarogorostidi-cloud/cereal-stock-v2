'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Producto = {
  id: string
  nombre: string
  tipo: string
  unidad: string
  marca: string | null
}

type Proveedor = {
  id: string
  nombre: string
}

export default function NuevaCompraAgroquimicoPage() {
  const supabase = createClient()
  const router = useRouter()

  const [productos, setProductos] = useState<Producto[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    producto_id: '',
    fecha: new Date().toISOString().split('T')[0],
    cantidad: '',
    precio_unitario: '',
    proveedor_id: '',
    lote: '',
    numero_remito: '',
    numero_factura: '',
    observaciones: '',
  })

  useEffect(() => {
    async function cargar() {
      const [{ data: prods }, { data: provs }] = await Promise.all([
        supabase.from('agroquimicos_productos').select('id, nombre, tipo, unidad, marca').eq('activo', true).order('tipo').order('nombre'),
        supabase.from('proveedores').select('id, nombre').eq('activo', true).order('nombre'),
      ])
      setProductos(prods ?? [])
      setProveedores(provs ?? [])
      setLoading(false)
    }
    cargar()
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  const productoSeleccionado = productos.find(p => p.id === form.producto_id)
  const costoTotal = Number(form.cantidad || 0) * Number(form.precio_unitario || 0)
  const fmtUsd = (n: number) => n > 0 ? `USD ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''

  // Agrupar productos por tipo
  const productosPorTipo = productos.reduce((acc: Record<string, Producto[]>, p) => {
    if (!acc[p.tipo]) acc[p.tipo] = []
    acc[p.tipo].push(p)
    return acc
  }, {})

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.producto_id) { setError('Seleccioná un producto.'); return }
    if (!form.cantidad) { setError('La cantidad es obligatoria.'); return }
    if (!form.fecha) { setError('La fecha es obligatoria.'); return }
    setSaving(true)

    const payload: any = {
      producto_id: form.producto_id,
      tipo: 'compra',
      fecha: form.fecha,
      cantidad: Number(form.cantidad),
      precio_unitario: form.precio_unitario ? Number(form.precio_unitario) : null,
      proveedor_id: form.proveedor_id || null,
      lote: form.lote || null,
      numero_remito: form.numero_remito || null,
      numero_factura: form.numero_factura || null,
      observaciones: form.observaciones || null,
    }

    const { error: err } = await supabase.from('agroquimicos_movimientos').insert(payload)
    if (err) { setError(`Error: ${err.message}`); setSaving(false); return }

    setSuccess(true)
    setTimeout(() => router.push('/dashboard/agroquimicos'), 1500)
  }

  if (loading) return <div className="text-center text-campo-400 py-20">Cargando...</div>

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/agroquimicos" className="text-campo-500 hover:text-campo-700 text-sm">← Volver</Link>
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Registrar Compra</h1>
          <p className="text-campo-500 text-sm">Ingreso de agroquímicos al stock</p>
        </div>
      </div>

      {success && <div className="rounded-lg bg-campo-100 border border-campo-300 px-4 py-3 text-campo-700 font-medium">✅ Compra registrada. Redirigiendo...</div>}
      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">❌ {error}</div>}

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">

        {/* Producto */}
        <div>
          <label className="block text-sm font-medium text-campo-700 mb-1">Producto *</label>
          <select name="producto_id" value={form.producto_id} onChange={handleChange}
            className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400">
            <option value="">Seleccionar producto...</option>
            {Object.entries(productosPorTipo).map(([tipo, prods]) => (
              <optgroup key={tipo} label={tipo.charAt(0).toUpperCase() + tipo.slice(1)}>
                {prods.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}{p.marca ? ` — ${p.marca}` : ''}</option>
                ))}
              </optgroup>
            ))}
          </select>
          {productoSeleccionado && (
            <p className="text-xs text-campo-400 mt-1">
              Tipo: {productoSeleccionado.tipo} · Unidad: {productoSeleccionado.unidad}
            </p>
          )}
        </div>

        {/* Fecha y Proveedor */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Fecha *</label>
            <input type="date" name="fecha" value={form.fecha} onChange={handleChange}
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Proveedor</label>
            <select name="proveedor_id" value={form.proveedor_id} onChange={handleChange}
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400">
              <option value="">Sin proveedor</option>
              {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
        </div>

        {/* Cantidad y Precio */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">
              Cantidad *{productoSeleccionado ? ` (${productoSeleccionado.unidad})` : ''}
            </label>
            <input type="number" name="cantidad" value={form.cantidad} onChange={handleChange}
              step="0.01" min="0" placeholder="0"
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">
              Precio unitario (USD/{productoSeleccionado?.unidad ?? 'u'})
            </label>
            <input type="number" name="precio_unitario" value={form.precio_unitario} onChange={handleChange}
              step="0.001" min="0" placeholder="0.00"
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
            {costoTotal > 0 && <p className="text-xs text-campo-400 mt-1">Total: {fmtUsd(costoTotal)}</p>}
          </div>
        </div>

        {/* Lote, Remito, Factura */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Lote</label>
            <input type="text" name="lote" value={form.lote} onChange={handleChange}
              placeholder="Ej: L240501"
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">N° Remito</label>
            <input type="text" name="numero_remito" value={form.numero_remito} onChange={handleChange}
              placeholder="0001-00012345"
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">N° Factura</label>
            <input type="text" name="numero_factura" value={form.numero_factura} onChange={handleChange}
              placeholder="0001-00012345"
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-campo-700 mb-1">Observaciones</label>
          <textarea name="observaciones" value={form.observaciones} onChange={handleChange}
            rows={2} placeholder="Notas adicionales..."
            className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400 resize-none" />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="flex-1 bg-lime-600 hover:bg-lime-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors">
            {saving ? 'Guardando...' : 'Registrar compra'}
          </button>
          <Link href="/dashboard/agroquimicos"
            className="px-4 py-2.5 text-sm font-medium text-campo-600 hover:text-campo-900 hover:bg-campo-100 rounded-lg transition-colors">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
