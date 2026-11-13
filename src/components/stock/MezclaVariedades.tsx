'use client'

import { useEffect, useState } from 'react'
import type { MezclaVariedades as Mezcla, Variedad } from '@/lib/variedades'
import { totalMezcla } from '@/lib/variedades'

type Props = {
  variedades: Variedad[]
  value: Mezcla
  onChange: (m: Mezcla) => void
  /** Toneladas que debe sumar la mezcla (ej: toneladas de origen de la carta de porte). */
  esperado?: number
  titulo?: string
}

type Fila = { id: string; variedadId: string; tn: string }

function fmt(n: number) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })
}

function recordDe(filas: Fila[]): Mezcla {
  const m: Mezcla = {}
  for (const f of filas) {
    if (f.variedadId && f.tn !== '') m[f.variedadId] = String((Number(m[f.variedadId]) || 0) + (Number(f.tn) || 0))
  }
  return m
}

function igual(a: Mezcla, b: Mezcla) {
  const ka = Object.keys(a).filter(k => Number(a[k]) > 0).sort()
  const kb = Object.keys(b).filter(k => Number(b[k]) > 0).sort()
  if (ka.length !== kb.length) return false
  return ka.every((k, i) => k === kb[i] && Math.abs(Number(a[k]) - Number(b[k])) < 1e-9)
}

let contador = 0
const nuevoId = () => `f${Date.now()}_${contador++}`

/**
 * Carga de las variedades de soja de una carga (Soja, DM 40E25, DM 47E23...).
 * Se puede cargar una sola variedad o varias: cada fila es una variedad con sus
 * toneladas, y el sistema valida que la suma coincida con las toneladas de la carga.
 */
export default function MezclaVariedades({ variedades, value, onChange, esperado, titulo = 'Variedades de soja de esta carga' }: Props) {
  const [filas, setFilas] = useState<Fila[]>([])

  const comun = variedades.find(v => v.es_comun) ?? variedades[0]

  // Sincroniza las filas con el valor que viene de afuera (carga de una carta existente, cambio de cultivo)
  useEffect(() => {
    if (variedades.length === 0) return
    if (filas.length > 0 && igual(recordDe(filas), value)) return
    const desdeValor = Object.entries(value)
      .filter(([, tn]) => Number(tn) > 0)
      .map(([variedadId, tn]) => ({ id: nuevoId(), variedadId, tn }))
    setFilas(desdeValor.length > 0 ? desdeValor : [{ id: nuevoId(), variedadId: comun?.id ?? '', tn: '' }])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, variedades])

  if (variedades.length === 0) return null

  function actualizar(nuevas: Fila[]) {
    setFilas(nuevas)
    onChange(recordDe(nuevas))
  }

  function cambiarFila(id: string, cambios: Partial<Fila>) {
    actualizar(filas.map(f => (f.id === id ? { ...f, ...cambios } : f)))
  }

  function quitarFila(id: string) {
    const resto = filas.filter(f => f.id !== id)
    actualizar(resto.length > 0 ? resto : [{ id: nuevoId(), variedadId: comun?.id ?? '', tn: '' }])
  }

  function agregarFila() {
    const usadas = new Set(filas.map(f => f.variedadId))
    const libre = variedades.find(v => !usadas.has(v.id))
    if (!libre) return
    actualizar([...filas, { id: nuevoId(), variedadId: libre.id, tn: '' }])
  }

  const total = totalMezcla(recordDe(filas))
  const hayEsperado = esperado != null && esperado > 0
  const diff = hayEsperado ? Math.round((total - (esperado as number)) * 1000) / 1000 : 0
  const ok = !hayEsperado || Math.abs(diff) < 0.01
  const sinCargar = total === 0
  const puedeAgregar = filas.length < variedades.length

  function completarConComun() {
    if (!comun || !hayEsperado) return
    const otros = filas
      .filter(f => f.variedadId !== comun.id)
      .reduce((s, f) => s + (Number(f.tn) || 0), 0)
    const resto = String(Math.max(0, Math.round(((esperado as number) - otros) * 1000) / 1000))
    const hay = filas.some(f => f.variedadId === comun.id)
    actualizar(hay
      ? filas.map(f => (f.variedadId === comun.id ? { ...f, tn: resto } : f))
      : [...filas, { id: nuevoId(), variedadId: comun.id, tn: resto }])
  }

  return (
    <div className="rounded-xl border border-campo-200 bg-campo-50/50 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-semibold text-campo-800">{titulo}</p>
          <p className="text-xs text-campo-500">Podés cargar más de una variedad en la misma carga (ej. 20 tn de Soja y 10 tn de DM 40E25).</p>
        </div>
        {hayEsperado && comun && (
          <button type="button" onClick={completarConComun} className="text-xs text-campo-600 hover:text-campo-800 underline">
            Completar el resto con {comun.nombre}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {filas.map(f => {
          const usadasEnOtras = new Set(filas.filter(x => x.id !== f.id).map(x => x.variedadId))
          return (
            <div key={f.id} className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-campo-600 mb-1">Variedad</label>
                <select
                  value={f.variedadId}
                  onChange={e => cambiarFila(f.id, { variedadId: e.target.value })}
                  className="input-field"
                >
                  {variedades.filter(v => !usadasEnOtras.has(v.id)).map(v => (
                    <option key={v.id} value={v.id}>{v.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="w-40">
                <label className="block text-xs font-medium text-campo-600 mb-1">Toneladas</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={f.tn}
                  onChange={e => cambiarFila(f.id, { tn: e.target.value })}
                  className="input-field"
                  placeholder="0"
                />
              </div>
              {filas.length > 1 && (
                <button type="button" onClick={() => quitarFila(f.id)} className="text-red-400 hover:text-red-600 text-lg leading-none mb-2" title="Quitar variedad">×</button>
              )}
            </div>
          )
        })}
      </div>

      {puedeAgregar && (
        <button type="button" onClick={agregarFila} className="text-sm font-medium text-campo-600 hover:text-campo-800 underline">
          + Agregar otra variedad
        </button>
      )}

      <div className="text-xs">
        {sinCargar ? (
          <span className="text-campo-500">Si no cargás nada, se toma toda la carga como {comun?.nombre ?? 'Soja'}.</span>
        ) : ok ? (
          <span className="text-campo-600">
            Total: <b>{fmt(total)} tn</b>{hayEsperado ? ' — coincide con la carga' : ''}
          </span>
        ) : (
          <span className="text-red-600 font-medium">
            Suman {fmt(total)} tn y la carga es de {fmt(esperado as number)} tn ({diff > 0 ? 'sobran' : 'faltan'} {fmt(Math.abs(diff))} tn)
          </span>
        )}
      </div>
    </div>
  )
}

/** true si la mezcla es válida para guardar (vacía = todo común; si tiene datos tiene que sumar lo esperado). */
export function mezclaValida(value: Mezcla, esperado?: number): boolean {
  const total = totalMezcla(value)
  if (total === 0) return true
  if (!esperado || esperado <= 0) return true
  return Math.abs(total - esperado) < 0.01
}
