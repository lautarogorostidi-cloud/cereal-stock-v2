'use client'

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

function fmt(n: number) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })
}

/**
 * Carga de toneladas por tipo de soja (común / con tecnología). Sirve para un
 * camión mezclado: se pone cuántas toneladas hay de cada tipo y el sistema
 * valida que la suma coincida con las toneladas de la carga.
 */
export default function MezclaVariedades({ variedades, value, onChange, esperado, titulo = 'Tipo de soja' }: Props) {
  if (variedades.length === 0) return null

  const total = totalMezcla(value)
  const hayEsperado = esperado != null && esperado > 0
  const diff = hayEsperado ? Math.round((total - (esperado as number)) * 1000) / 1000 : 0
  const ok = !hayEsperado || Math.abs(diff) < 0.01
  const sinCargar = total === 0

  function setTn(id: string, v: string) {
    onChange({ ...value, [id]: v })
  }

  function completarConComun() {
    const comun = variedades.find(x => x.es_comun)
    if (!comun || !hayEsperado) return
    const otros = variedades.filter(x => !x.es_comun).reduce((s, x) => s + (Number(value[x.id]) || 0), 0)
    const resto = Math.max(0, Math.round(((esperado as number) - otros) * 1000) / 1000)
    onChange({ ...value, [comun.id]: String(resto) })
  }

  return (
    <div className="rounded-xl border border-campo-200 bg-campo-50/50 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm font-semibold text-campo-800">{titulo}</p>
        {hayEsperado && (
          <button type="button" onClick={completarConComun} className="text-xs text-campo-600 hover:text-campo-800 underline">
            Completar el resto con Soja
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {variedades.map(v => (
          <div key={v.id}>
            <label className="block text-xs font-medium text-campo-600 mb-1">{v.nombre} (tn)</label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={value[v.id] ?? ''}
              onChange={e => setTn(v.id, e.target.value)}
              className="input-field"
              placeholder="0"
            />
          </div>
        ))}
      </div>

      <div className="text-xs">
        {sinCargar ? (
          <span className="text-campo-500">Si no cargás nada, se toma toda la carga como Soja (sin tecnología).</span>
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
