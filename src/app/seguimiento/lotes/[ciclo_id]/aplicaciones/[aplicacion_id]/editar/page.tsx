'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type Producto = {
  id?: number
  tipo_insumo: string
  producto: string
  unidad: string
  dosis_ha: string
  costo_unitario: string
}

type ProductoCatalogo = {
  id: number
  nombre: string
  tipo: string
  unidad: string
  ultimo_precio: number | null
  precio_tarifario: number | null
}

type PrecioInsumo = {
  producto: string
  precio_usd: number
  fecha_vigencia: string
  fuente: string
  producto_id: number | null
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

const TIPOS_INSUMO = ['herbicida', 'fungicida', 'insecticida', 'coadyuvante', 'curasemilla', 'acaricida', 'otro']

const TIPO_LABELS: Record<string, string> = {
  herbicida: 'Herbicida',
  fungicida: 'Fungicida',
  insecticida: 'Insecticida',
  coadyuvante: 'Coadyuvante',
  curasemilla: 'Curasemilla',
  acaricida: 'Acaricida',
  otro: 'Otro',
}

const PRODUCTO_VACIO: Producto = { tipo_insumo: '', producto: '', unidad: 'L', dosis_ha: '', costo_unitario: '' }

export default function EditarAplicacionPage() {
  const { ciclo_id, aplicacion_id } = useParams<{ ciclo_id: string; aplicacion_id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [cicloInfo, setCicloInfo] = useState<{ lote: string; campo: string; campana: string; cultivo: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [catalogo, setCatalogo] = useState<ProductoCatalogo[]>([])
  const [precios, setPrecios] = useState<PrecioInsumo[]>([])
  const [tarifarioServicios, setTarifarioServicios] = useState<any[]>([])

  const [form, setForm] = useState({
    tipo: '',
    fecha: '',
    superficie_ha: '',
    costo_servicio_usd_ha: '',
    proveedor: '',
    observaciones: '',
  })

  const [productos, setProductos] = useState<Producto[]>([{ ...PRODUCTO_VACIO }])

  useEffect(() => {
    if (!ciclo_id || !aplicacion_id) return
    cargar()
  }, [ciclo_id, aplicacion_id])

  async function cargar() {
    setLoading(true)

    const [{ data: cicloData }, { data: aplData }, { data: prodsData }, { data: productosData }, { data: preciosData }, { data: servicios }] = await Promise.all([
      supabase.from('vw_sa_resumen_ciclo').select('lote, campo, campana, cultivo').eq('ciclo_id', Number(ciclo_id)).single(),
      supabase.from('sa_aplicaciones').select('*').eq('id', Number(aplicacion_id)).single(),
      supabase.from('sa_aplicacion_productos').select('*').eq('aplicacion_id', Number(aplicacion_id)),
      supabase.from('agroquimicos_productos').select('id, nombre, tipo, unidad').eq('activo', true).order('nombre'),
      supabase.from('vw_precios_insumos').select('producto, precio_usd, fecha_vigencia, fuente, producto_id').order('fecha_vigencia', { ascending: false }),
      supabase.from('tarifario_servicios').select('*').order('vigencia_desde', { ascending: false }),
    ])

    setCicloInfo(cicloData ?? null)
    setTarifarioServicios(servicios ?? [])
    setPrecios(preciosData ?? [])

    // Armar catálogo con precios
    const ultimoPrecioMap: Record<string, { precio: number; fuente: string }> = {}
    ;(preciosData ?? []).forEach((p: any) => {
      const nombre = p.producto?.trim().toLowerCase()
      if (!nombre) return
      const existing = ultimoPrecioMap[nombre]
      if (!existing) {
        ultimoPrecioMap[nombre] = { precio: p.precio_usd, fuente: p.fuente }
      } else if (p.fuente === 'compra' && existing.fuente === 'tarifario') {
        ultimoPrecioMap[nombre] = { precio: p.precio_usd, fuente: p.fuente }
      }
    })

    const catalogoConPrecio: ProductoCatalogo[] = (productosData ?? []).map((p: any) => {
      const nombreNorm = p.nombre?.trim().toLowerCase()
      const precioInfo = ultimoPrecioMap[nombreNorm]
      return {
        id: p.id,
        nombre: p.nombre,
        tipo: p.tipo,
        unidad: p.unidad,
        ultimo_precio: precioInfo?.fuente === 'compra' ? precioInfo.precio : null,
        precio_tarifario: precioInfo?.fuente === 'tarifario' ? precioInfo.precio : null,
      }
    })
    setCatalogo(catalogoConPrecio)

    if (aplData) {
      setForm({
        tipo: aplData.tipo ?? '',
        fecha: aplData.fecha ?? '',
        superficie_ha: aplData.superficie_ha?.toString() ?? '',
        costo_servicio_usd_ha: aplData.costo_servicio_usd_ha?.toString() ?? '',
        proveedor: aplData.proveedor ?? '',
        observaciones: aplData.observaciones ?? '',
      })
    }

    if (prodsData && prodsData.length > 0) {
      // Para cada producto, buscar su tipo en el catálogo
      setProductos(prodsData.map((p: any) => {
        const enCatalogo = catalogoConPrecio.find(c => c.nombre.toLowerCase().trim() === (p.producto ?? '').toLowerCase().trim())
        return {
          id: p.id,
          tipo_insumo: enCatalogo?.tipo ?? '',
          producto: p.producto ?? '',
          unidad: p.unidad ?? 'L',
          dosis_ha: p.dosis_ha?.toString() ?? '',
          costo_unitario: p.costo_unitario?.toString() ?? '',
        }
      }))
    }

    setLoading(false)
  }

  function getPrecioVigenteParaFecha(nombreProducto: string, fecha: string): number | null {
    if (!nombreProducto) return null
    const nombreNorm = nombreProducto.trim().toLowerCase()
    const candidatos = precios
      .filter(p => p.producto?.trim().toLowerCase() === nombreNorm)
      .filter(p => !fecha || p.fecha_vigencia <= fecha)
      .sort((a, b) => {
        if (b.fecha_vigencia !== a.fecha_vigencia) return b.fecha_vigencia.localeCompare(a.fecha_vigencia)
        return a.fuente === 'compra' ? -1 : 1
      })
    return candidatos.length > 0 ? candidatos[0].precio_usd : null
  }

  function getCostoServicioVigente(fecha: string): number | null {
    if (!fecha || !cicloInfo) return null
    const registros = tarifarioServicios
      .filter(s =>
        s.tipo_servicio?.toLowerCase().includes('pulveriz') &&
        (!s.cultivo || s.cultivo === cicloInfo.cultivo) &&
        s.vigencia_desde <= fecha
      )
      .sort((a: any, b: any) => b.vigencia_desde.localeCompare(a.vigencia_desde))
    if (registros.length === 0) return null
    return registros[0].costo_usd_ha
  }

  function handleFormChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    if (name === 'fecha' && value) {
      // Recalcular precios de productos según la nueva fecha
      setProductos(ps => ps.map(p => {
        if (!p.producto) return p
        const precio = getPrecioVigenteParaFecha(p.producto, value)
        if (precio) return { ...p, costo_unitario: precio.toString() }
        return p
      }))
    }
  }

  function handleProductoChange(index: number, field: keyof Producto, value: string) {
    setProductos(ps => ps.map((p, i) => {
      if (i !== index) return p
      const updated = { ...p, [field]: value }
      if (field === 'tipo_insumo') {
        return { ...updated, producto: '', costo_unitario: '' }
      }
      if (field === 'producto' && value) {
        const prod = catalogo.find(c => c.nombre === value)
        if (prod) {
          const precio = getPrecioVigenteParaFecha(value, form.fecha)
          return {
            ...updated,
            unidad: prod.unidad ?? 'L',
            costo_unitario: precio?.toString() ?? prod.ultimo_precio?.toString() ?? prod.precio_tarifario?.toString() ?? '',
          }
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
      setError('Agregá al menos un producto.')
      return
    }

    setSaving(true)

    // ── VALIDACIÓN DE STOCK ──────────────────────────────────────────
    // Al editar, primero "devolvemos" virtualmente el stock que esta
    // misma aplicación ya tenía descontado (sus movimientos viejos, que
    // vamos a borrar y reemplazar), y recién sobre ese stock disponible
    // corregido validamos si alcanza para las cantidades nuevas.
    //
    // Ojo: las aplicaciones cargadas antes de que existiera el descuento
    // automático de stock (aprox. antes del 9/7/2026) NUNCA generaron un
    // movimiento en agroquímicos — ese consumo ya pasó en la realidad,
    // pero el sistema no tiene ningún registro que "devolver". Si a esas
    // igual les exigiéramos el stock completo de nuevo, cualquier edición
    // (aunque sea solo cambiar el proveedor o las hectáreas) quedaría
    // bloqueada por "stock insuficiente" de forma incorrecta. Por eso, si
    // la aplicación no tiene ningún movimiento propio, la tratamos como
    // "legacy": se guardan los datos normalmente, sin validar ni tocar
    // stock. Si sí tiene movimientos (las cargadas/editadas desde el
    // 9/7 en adelante), seguimos validando y recalculando el stock como
    // corresponde.
    const catalogoPorProducto: Record<string, ProductoCatalogo> = {}
    const errores: string[] = []

    const { data: movimientosViejos } = await supabase
      .from('agroquimicos_movimientos')
      .select('producto_id, cantidad')
      .eq('aplicacion_id', Number(aplicacion_id))
      .eq('tipo', 'aplicacion')

    const esAplicacionLegacy = (movimientosViejos ?? []).length === 0

    const stockDevueltoPorProducto: Record<number, number> = {}
    ;(movimientosViejos ?? []).forEach((m: any) => {
      stockDevueltoPorProducto[m.producto_id] = (stockDevueltoPorProducto[m.producto_id] ?? 0) + Number(m.cantidad)
    })

    if (!esAplicacionLegacy) {
      for (const p of productosValidos) {
        const prodCatalogo = catalogo.find(c => c.nombre === p.producto)
        if (!prodCatalogo) {
          errores.push(`"${p.producto}" no está en el catálogo de agroquímicos.`)
          continue
        }
        catalogoPorProducto[p.producto] = prodCatalogo

        const { data: stockData, error: stockErr } = await supabase
          .from('vw_stock_agroquimicos')
          .select('stock_actual')
          .eq('producto_id', prodCatalogo.id)
          .maybeSingle()

        if (stockErr) {
          errores.push(`No se pudo verificar el stock de "${p.producto}": ${stockErr.message}`)
          continue
        }

        const stockActual = Number(stockData?.stock_actual ?? 0)
        const stockDevuelto = stockDevueltoPorProducto[prodCatalogo.id] ?? 0
        const stockDisponible = stockActual + stockDevuelto
        const cantidadNecesaria = Number(p.dosis_ha) * Number(form.superficie_ha)

        if (stockDisponible < cantidadNecesaria) {
          errores.push(
            `Stock insuficiente de "${p.producto}": necesitás ${cantidadNecesaria.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ${p.unidad}, disponible: ${stockDisponible.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ${p.unidad}.`
          )
        }
      }

      if (errores.length > 0) {
        setError(errores.join(' · '))
        setSaving(false)
        return
      }
    }

    // ── ACTUALIZAR APLICACIÓN ────────────────────────────────────────
    const { error: aplErr } = await supabase
      .from('sa_aplicaciones')
      .update({
        tipo: form.tipo,
        fecha: form.fecha || null,
        superficie_ha: Number(form.superficie_ha),
        costo_servicio_usd_ha: form.costo_servicio_usd_ha ? Number(form.costo_servicio_usd_ha) : null,
        proveedor: form.proveedor || null,
        observaciones: form.observaciones || null,
      })
      .eq('id', Number(aplicacion_id))

    if (aplErr) {
      setSaving(false)
      setError(`Error al actualizar: ${aplErr.message}`)
      return
    }

    await supabase.from('sa_aplicacion_productos').delete().eq('aplicacion_id', Number(aplicacion_id))

    const productosInsert = productosValidos.map(p => ({
      aplicacion_id: Number(aplicacion_id),
      producto: p.producto.trim(),
      unidad: p.unidad,
      dosis_ha: Number(p.dosis_ha),
      costo_unitario: Number(p.costo_unitario),
    }))

    const { error: prodErr } = await supabase.from('sa_aplicacion_productos').insert(productosInsert)

    if (prodErr) {
      setSaving(false)
      setError(`Error al guardar productos: ${prodErr.message}`)
      return
    }

    // ── RECALCULAR STOCK: borrar movimientos viejos de esta aplicación
    // e insertar los nuevos con las cantidades actualizadas ───────────
    // Si es una aplicación "legacy" (nunca tuvo movimiento propio), no
    // tocamos agroquímicos en absoluto: ese consumo ya ocurrió en la
    // realidad y no hay que descontarlo recién ahora.
    if (esAplicacionLegacy) {
      setSaving(false)
      router.push(`/seguimiento/lotes/${ciclo_id}`)
      return
    }

    const { error: delMovErr } = await supabase
      .from('agroquimicos_movimientos')
      .delete()
      .eq('aplicacion_id', Number(aplicacion_id))
      .eq('tipo', 'aplicacion')

    if (delMovErr) {
      setSaving(false)
      setError(`La aplicación se actualizó, pero no se pudo recalcular el stock: ${delMovErr.message}`)
      return
    }

    function normalizarCultivo(c: string | null | undefined): string {
      const n = (c ?? '').trim().toLowerCase()
      if (n.startsWith('maiz') || n.startsWith('maíz')) return 'maiz'
      if (n.startsWith('soja')) return 'soja'
      if (n.startsWith('trigo')) return 'trigo'
      if (n.startsWith('girasol')) return 'girasol'
      if (n.startsWith('centeno')) return 'centeno'
      if (n.startsWith('cebada')) return 'cebada'
      if (n.startsWith('sorgo')) return 'sorgo'
      return 'otro'
    }

    const movimientosNuevos = productosValidos.map(p => {
      const prodCatalogo = catalogoPorProducto[p.producto]
      return {
        producto_id: prodCatalogo.id,
        tipo: 'aplicacion',
        fecha: form.fecha || new Date().toISOString().split('T')[0],
        cantidad: Number(p.dosis_ha) * Number(form.superficie_ha),
        lote: cicloInfo?.lote ?? null,
        cultivo: normalizarCultivo(cicloInfo?.cultivo),
        campaña: cicloInfo?.campana ?? null,
        ciclo_id: Number(ciclo_id),
        aplicacion_id: Number(aplicacion_id),
        precio_unitario: Number(p.costo_unitario),
        observaciones: `Aplicación ${TIPOS_APLICACION.find(t => t.value === form.tipo)?.label ?? form.tipo} (editada) — ${cicloInfo?.lote} ${cicloInfo?.campana}`,
      }
    })

    const { error: movErr } = await supabase.from('agroquimicos_movimientos').insert(movimientosNuevos)

    setSaving(false)

    if (movErr) {
      setError(`La aplicación se actualizó, pero el stock NO se recalculó: ${movErr.message}. Revisá Agroquímicos → Movimientos.`)
      return
    }

    router.push(`/seguimiento/lotes/${ciclo_id}`)
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
              step="0.01" min="0"
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
              step="0.01" min="0"
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-campo-700 mb-1">Proveedor</label>
          <input type="text" name="proveedor" value={form.proveedor} onChange={handleFormChange}
            placeholder="Ej: Juan Pérez"
            className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
        </div>

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

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs text-campo-500 mb-1">Tipo</div>
                    <select value={p.tipo_insumo} onChange={e => handleProductoChange(i, 'tipo_insumo', e.target.value)}
                      className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400">
                      <option value="">Seleccionar tipo...</option>
                      {TIPOS_INSUMO.map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-campo-500 mb-1">
                      Producto
                      {p.costo_unitario && p.producto && (
                        <span className="ml-1 text-lime-600">✓ precio cargado</span>
                      )}
                    </div>
                    <ProductoSelector
                      tipo={p.tipo_insumo}
                      value={p.producto}
                      catalogo={catalogo}
                      onChange={val => handleProductoChange(i, 'producto', val)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-xs text-campo-500 mb-1">Unidad</div>
                    <select value={p.unidad} onChange={e => handleProductoChange(i, 'unidad', e.target.value)}
                      className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400">
                      <option value="L">L</option>
                      <option value="kg">kg</option>
                      <option value="cc">cc</option>
                      <option value="g">g</option>
                      <option value="caja">caja</option>
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

                {p.dosis_ha && p.costo_unitario && form.superficie_ha && (
                  <div className="text-xs text-campo-400">
                    Subtotal: <span className="font-semibold text-campo-700">
                      USD {(Number(p.dosis_ha) * Number(form.superficie_ha) * Number(p.costo_unitario)).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )}
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

        <div>
          <label className="block text-sm font-medium text-campo-700 mb-1">Observaciones</label>
          <textarea name="observaciones" value={form.observaciones} onChange={handleFormChange}
            rows={2} placeholder="Notas adicionales..."
            className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400 resize-none" />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 bg-lime-600 hover:bg-lime-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors">
            {saving ? 'Guardando...' : 'Guardar cambios'}
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

function ProductoSelector({ tipo, value, catalogo, onChange }: {
  tipo: string
  value: string
  catalogo: ProductoCatalogo[]
  onChange: (val: string) => void
}) {
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState(false)

  const productosFiltrados = catalogo
    .filter(p => !tipo || p.tipo === tipo)
    .filter(p => !busqueda || p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

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
      {abierto && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-campo-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {productosFiltrados.map(p => (
            <button key={p.id} onMouseDown={() => { onChange(p.nombre); setBusqueda(''); setAbierto(false) }}
              className="w-full text-left px-3 py-2 text-sm text-campo-900 hover:bg-lime-50 hover:text-lime-800 flex justify-between items-center">
              <span>{p.nombre}</span>
              {(p.ultimo_precio ?? p.precio_tarifario) && (
                <span className="text-xs text-campo-400 ml-2">
                  USD {(p.ultimo_precio ?? p.precio_tarifario)}/{p.unidad}
                  {!p.ultimo_precio && p.precio_tarifario && <span className="text-amber-500 ml-1">(tarifario)</span>}
                </span>
              )}
            </button>
          ))}
          {productosFiltrados.length === 0 && (
            <div className="px-3 py-2 text-sm text-campo-400">Sin resultados</div>
          )}
        </div>
      )}
    </div>
  )
}
