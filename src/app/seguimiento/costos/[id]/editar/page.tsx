'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

type Campana = { id: number; nombre: string }

const TIPOS = [
  { value: 'arrendamiento', label: 'Arrendamiento' },
  { value: 'seguro', label: 'Seguro' },
  { value: 'indemnizacion_seguro', label: 'Indemnización seguro' },
  { value: 'asesoramiento', label: 'Asesoramiento' },
  { value: 'impuesto', label: 'Impuesto' },
  { value: 'costo_oportunidad', label: 'Costo de oportunidad' },
  { value: 'otro', label: 'Otro' },
]

const PERIODOS = [
  { value: 'mensual', label: 'Mensual', cuotas: 12 },
  { value: 'trimestral', label: 'Trimestral', cuotas: 4 },
  { value: 'cuatrimestral', label: 'Cuatrimestral', cuotas: 3 },
  { value: 'semestral', label: 'Semestral', cuotas: 2 },
  { value: 'anual', label: 'Anual', cuotas: 1 },
]

type Vencimiento = {
  id?: number
  fecha: string
  monto: string
  es_estimado: boolean
  pagado: boolean
}

export default function EditarCostoPage() {
  const supabase = createClient()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [campanas, setCampanas] = useState<Campana[]>([])
  const [establecimientos, setEstablecimientos] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    establecimiento: '',
    campana_id: '',
    tipo: '',
    periodo: '',
    monto_total: '',
    observaciones: '',
  })

  const [vencimientos, setVencimientos] = useState<Vencimiento[]>([])

  useEffect(() => { cargar() }, [id])

  async function cargar() {
    setLoading(true)
    const [{ data: camps }, { data: lotes }, { data: costoData }, { data: vencData }] = await Promise.all([
      supabase.from('campanas').select('id, nombre').order('nombre', { ascending: false }),
      supabase.from('lotes').select('establecimiento').eq('activo', true),
      supabase.from('costos_fijos_campo').select('*').eq('id', Number(id)).single(),
      supabase.from('costos_fijos_vencimientos').select('*').eq('costo_id', Number(id)).order('fecha_vencimiento'),
    ])

    setCampanas(camps ?? [])
    const establs = Array.from(new Set((lotes ?? []).map((l: any) => l.establecimiento))).sort() as string[]
    setEstablecimientos(establs)

    if (costoData) {
      setForm({
        establecimiento: costoData.establecimiento ?? '',
        campana_id: costoData.campana_id?.toString() ?? '',
        tipo: costoData.tipo ?? '',
        periodo: costoData.periodo ?? '',
        monto_total: costoData.monto_total?.toString() ?? '',
        observaciones: costoData.observaciones ?? '',
      })
    }

    setVencimientos((vencData ?? []).map((v: any) => ({
      id: v.id,
      fecha: v.fecha_vencimiento,
      monto: v.monto?.toString() ?? '',
      es_estimado: v.es_estimado ?? true,
      pagado: v.pagado ?? false,
    })))

    setLoading(false)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  function handleVencimiento(idx: number, field: 'fecha' | 'monto', value: string) {
    setVencimientos(prev => prev.map((v, i) => i === idx ? { ...v, [field]: value } : v))
  }

  function handleVencimientoEstimado(idx: number, value: boolean) {
    setVencimientos(prev => prev.map((v, i) => i === idx ? { ...v, es_estimado: value } : v))
  }

  function handleVencimientoPagado(idx: number, value: boolean) {
    setVencimientos(prev => prev.map((v, i) => i === idx ? { ...v, pagado: value } : v))
  }

  function agregarVencimiento() {
    setVencimientos(prev => [...prev, { fecha: '', monto: '', es_estimado: true, pagado: false }])
  }

  function eliminarVencimiento(idx: number) {
    setVencimientos(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit() {
    setError(null)
    if (!form.establecimiento || !form.campana_id || !form.tipo || !form.periodo || !form.monto_total) {
      setError('Todos los campos marcados con * son obligatorios.')
      return
    }
    if (vencimientos.length === 0) {
      setError('Agregá al menos un vencimiento.')
      return
    }
    if (vencimientos.some(v => !v.fecha || !v.monto)) {
      setError('Completá fecha y monto de todos los vencimientos.')
      return
    }

    setSaving(true)

    // Actualizar costo principal
    const { error: errCosto } = await supabase
      .from('costos_fijos_campo')
      .update({
        establecimiento: form.establecimiento,
        campana_id: Number(form.campana_id),
        tipo: form.tipo,
        periodo: form.periodo,
        monto_total: Number(form.monto_total),
        observaciones: form.observaciones || null,
      })
      .eq('id', Number(id))

    if (errCosto) {
      setSaving(false)
      setError(`Error al actualizar: ${errCosto.message}`)
      return
    }

    // Eliminar todos los vencimientos existentes y reinsertarlos
    await supabase.from('costos_fijos_vencimientos').delete().eq('costo_id', Number(id))

    const { error: errVenc } = await supabase
      .from('costos_fijos_vencimientos')
      .insert(vencimientos.map(v => ({
        costo_id: Number(id),
        fecha_vencimiento: v.fecha,
        monto: Number(v.monto),
        pagado: v.pagado,
        es_estimado: v.es_estimado,
      })))

    setSaving(false)
    if (errVenc) {
      setError(`Error al guardar vencimientos: ${errVenc.message}`)
      return
    }

    router.push('/seguimiento/costos')
  }

  const fmtUsd = (n: number) => `USD ${Math.round(n).toLocaleString('es-AR')}`
  const totalVencimientos = vencimientos.reduce((acc, v) => acc + (parseFloat(v.monto) || 0), 0)

  if (loading) return <div className="text-center text-campo-400 py-20">Cargando...</div>

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <div className="mb-1">
          <Link href="/seguimiento/costos" className="text-sm text-campo-400 hover:text-campo-700">← Costos</Link>
        </div>
        <h1 className="text-2xl font-bold text-campo-900">Editar costo fijo</h1>
        <p className="text-campo-500 text-sm mt-0.5">Modificá el costo y sus vencimientos</p>
      </div>

      <div className="card p-6 space-y-5">

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Campo *</label>
            <select name="establecimiento" value={form.establecimiento} onChange={handleChange}
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400">
              <option value="">Seleccionar campo...</option>
              {establecimientos.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Campaña *</label>
            <select name="campana_id" value={form.campana_id} onChange={handleChange}
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400">
              {campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Tipo *</label>
            <select name="tipo" value={form.tipo} onChange={handleChange}
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400">
              <option value="">Seleccionar tipo...</option>
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Período *</label>
            <select name="periodo" value={form.periodo} onChange={handleChange}
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400">
              <option value="">Seleccionar período...</option>
              {PERIODOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-campo-700 mb-1">Monto total (USD) *</label>
          <input type="number" name="monto_total" value={form.monto_total} onChange={handleChange}
            step="0.01" min="0" placeholder="0.00"
            className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
        </div>

        <div>
          <label className="block text-sm font-medium text-campo-700 mb-1">Observaciones</label>
          <textarea name="observaciones" value={form.observaciones} onChange={handleChange}
            rows={2} placeholder="Notas adicionales..."
            className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400 resize-none" />
        </div>

        {/* Vencimientos */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-campo-700">
              Vencimientos {vencimientos.length > 0 && <span className="text-campo-400 font-normal">— Total: {fmtUsd(totalVencimientos)}</span>}
            </label>
            <button onClick={agregarVencimiento} type="button"
              className="text-xs text-lime-700 hover:text-lime-600 font-medium">
              + Agregar vencimiento
            </button>
          </div>

          <div className="space-y-2">
            {vencimientos.map((v, idx) => (
              <div key={idx} className={`flex gap-2 items-center p-2 rounded-lg ${v.pagado ? 'bg-emerald-50 border border-emerald-200' : v.es_estimado ? 'bg-amber-50 border border-amber-200' : 'bg-campo-50 border border-campo-200'}`}>
                <div className="flex-1">
                  <input type="date" value={v.fecha} onChange={e => handleVencimiento(idx, 'fecha', e.target.value)}
                    className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400 bg-white" />
                </div>
                <div className="flex-1">
                  <input type="number" value={v.monto} onChange={e => handleVencimiento(idx, 'monto', e.target.value)}
                    step="0.01" min="0" placeholder="Monto USD"
                    className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400 bg-white" />
                </div>
                <label className="flex items-center gap-1 cursor-pointer shrink-0">
                  <input type="checkbox" checked={v.es_estimado}
                    onChange={e => handleVencimientoEstimado(idx, e.target.checked)}
                    className="accent-amber-500 w-4 h-4" />
                  <span className={`text-xs font-medium ${v.es_estimado ? 'text-amber-600' : 'text-campo-500'}`}>
                    {v.es_estimado ? '⚠️ Est.' : '✓ Real'}
                  </span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer shrink-0">
                  <input type="checkbox" checked={v.pagado}
                    onChange={e => handleVencimientoPagado(idx, e.target.checked)}
                    className="accent-emerald-500 w-4 h-4" />
                  <span className={`text-xs font-medium ${v.pagado ? 'text-emerald-600' : 'text-campo-400'}`}>
                    {v.pagado ? '✓ Pagado' : 'Pagar'}
                  </span>
                </label>
                <button onClick={() => eliminarVencimiento(idx)} type="button"
                  className="text-red-400 hover:text-red-600 text-sm px-1">✕</button>
              </div>
            ))}
          </div>

          {vencimientos.length > 0 && Math.abs(totalVencimientos - parseFloat(form.monto_total || '0')) > 0.01 && (
            <p className="text-xs text-amber-600 mt-2">⚠️ La suma de vencimientos ({fmtUsd(totalVencimientos)}) no coincide con el monto total ({fmtUsd(parseFloat(form.monto_total || '0'))})</p>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 bg-lime-600 hover:bg-lime-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors">
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
          <Link href="/seguimiento/costos"
            className="px-4 py-2.5 text-sm font-medium text-campo-600 hover:text-campo-900 hover:bg-campo-100 rounded-lg transition-colors">
            Cancelar
          </Link>
        </div>

      </div>
    </div>
  )
}
