'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

type Lote = {
  id: string
  nombre: string
  establecimiento: string
  hectareas: number
}

type Cultivo = {
  id: string
  nombre: string
}

type Campana = {
  id: number
  nombre: string
}

export default function NuevoCicloPage() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const loteId = searchParams.get('lote')

  const [lote, setLote] = useState<Lote | null>(null)
  const [cultivos, setCultivos] = useState<Cultivo[]>([])
  const [campanas, setCampanas] = useState<Campana[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    campana_id: '',
    cultivo_id: '',
    sup_sembrada: '',
    propiedad: '',
    antecesor_1: '',
    antecesor_2: '',
    observaciones: '',
  })

  useEffect(() => {
    if (!loteId) return
    cargar()
  }, [loteId])

  async function cargar() {
    setLoading(true)
    const [{ data: loteData }, { data: cultivosData }, { data: campanasData }] = await Promise.all([
      supabase.from('lotes').select('*').eq('id', loteId).single(),
      supabase.from('cultivos').select('*').order('nombre'),
      supabase.from('campanas').select('*').order('nombre', { ascending: false }),
    ])

    setLote(loteData ?? null)
    setCultivos(cultivosData ?? [])
    setCampanas(campanasData ?? [])

    // Asignar propiedad automática según campo
    const propiedad = loteData?.establecimiento === 'La Media Luna' ? 'Propio' : 'No Propio'

    // Campaña más reciente por defecto
    const campanaDefault = (campanasData ?? [])[0]?.id?.toString() ?? ''

    setForm(f => ({
      ...f,
      campana_id: campanaDefault,
      propiedad,
      sup_sembrada: loteData?.hectareas?.toString() ?? '',
    }))

    setLoading(false)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit() {
    setError(null)

    if (!form.campana_id || !form.cultivo_id || !form.sup_sembrada) {
      setError('Campaña, cultivo y superficie son obligatorios.')
      return
    }

    setSaving(true)

    const { data, error: err } = await supabase
      .from('sa_ciclos')
      .insert({
        campana_id: Number(form.campana_id),
        lote_id: loteId,
        cultivo_id: form.cultivo_id,
        sup_sembrada: Number(form.sup_sembrada),
        propiedad: form.propiedad || null,
        antecesor_1: form.antecesor_1 || null,
        antecesor_2: form.antecesor_2 || null,
        observaciones: form.observaciones || null,
      })
      .select('id')
      .single()

    setSaving(false)

    if (err) {
      setError(`Error al crear ciclo: ${err.message}`)
      return
    }

    // Redirigir a la ficha del ciclo recién creado
    router.push(`/seguimiento/lotes/${data.id}`)
  }

  if (loading) return <div className="text-center text-campo-400 py-20">Cargando...</div>
  if (!lote) return <div className="text-center text-campo-400 py-20">Lote no encontrado</div>

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <div className="mb-1">
          <Link href="/seguimiento/lotes" className="text-sm text-campo-400 hover:text-campo-700">← Lotes</Link>
        </div>
        <h1 className="text-2xl font-bold text-campo-900">Nuevo ciclo</h1>
        <p className="text-campo-500 text-sm mt-0.5">
          {lote.nombre} · {lote.establecimiento} · {lote.hectareas} ha
        </p>
      </div>

      {/* Formulario */}
      <div className="card p-6 space-y-5">

        {/* Campaña */}
        <div>
          <label className="block text-sm font-medium text-campo-700 mb-1">Campaña *</label>
          <select
            name="campana_id"
            value={form.campana_id}
            onChange={handleChange}
            className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400"
          >
            <option value="">Seleccionar campaña...</option>
            {campanas.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>

        {/* Cultivo */}
        <div>
          <label className="block text-sm font-medium text-campo-700 mb-1">Cultivo *</label>
          <select
            name="cultivo_id"
            value={form.cultivo_id}
            onChange={handleChange}
            className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400"
          >
            <option value="">Seleccionar cultivo...</option>
            {cultivos.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>

        {/* Superficie */}
        <div>
          <label className="block text-sm font-medium text-campo-700 mb-1">Superficie sembrada (ha) *</label>
          <input
            type="number"
            name="sup_sembrada"
            value={form.sup_sembrada}
            onChange={handleChange}
            step="0.01"
            min="0"
            className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400"
          />
          <p className="text-xs text-campo-400 mt-1">Superficie total del lote: {lote.hectareas} ha</p>
        </div>

        {/* Propiedad */}
        <div>
          <label className="block text-sm font-medium text-campo-700 mb-1">Propiedad</label>
          <div className="flex gap-4">
            {['Propio', 'No Propio'].map(op => (
              <label key={op} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="propiedad"
                  value={op}
                  checked={form.propiedad === op}
                  onChange={handleChange}
                  className="accent-lime-600"
                />
                <span className="text-sm text-campo-700">{op}</span>
              </label>
            ))}
          </div>
          {lote.establecimiento === 'La Media Luna' && (
            <p className="text-xs text-lime-700 mt-1">✓ Asignado automáticamente como Propio</p>
          )}
        </div>

        {/* Antecesor 1 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Antecesor 1</label>
            <input
              type="text"
              name="antecesor_1"
              value={form.antecesor_1}
              onChange={handleChange}
              placeholder="Ej: Soja, Maíz..."
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Antecesor 2</label>
            <input
              type="text"
              name="antecesor_2"
              value={form.antecesor_2}
              onChange={handleChange}
              placeholder="Ej: Soja, Maíz..."
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400"
            />
          </div>
        </div>

        {/* Observaciones */}
        <div>
          <label className="block text-sm font-medium text-campo-700 mb-1">Observaciones</label>
          <textarea
            name="observaciones"
            value={form.observaciones}
            onChange={handleChange}
            rows={3}
            placeholder="Notas adicionales..."
            className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400 resize-none"
          />
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
            {saving ? 'Creando ciclo...' : 'Crear ciclo'}
          </button>
          <Link
            href="/seguimiento/lotes"
            className="px-4 py-2.5 text-sm font-medium text-campo-600 hover:text-campo-900 hover:bg-campo-100 rounded-lg transition-colors"
          >
            Cancelar
          </Link>
        </div>

      </div>
    </div>
  )
}
