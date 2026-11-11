'use client'

import { Fragment, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { guardarMezclaMovimientos } from '@/lib/variedades'

type AcopioAgrupado = { nombre: string; total: number }

type VariedadRow = {
  variedad_id: string
  variedad: string
  es_comun: boolean
  ton_ingresadas: number
  ton_entregadas: number
  stock_fisico: number
  stock_campo: number
  stock_acopio: number
  comprometido: number
}

type VariedadCat = { id: string; cultivo_id: string; nombre: string; es_comun: boolean }

type DestinoVariedad = {
  variedad_id: string
  ubicacion: 'campo' | 'acopio'
  acopio_cliente_id: string | null
  acopio_nombre: string | null
  stock_actual: number
}

type StockRow = {
  campania: string
  cultivo: string
  cultivo_codigo: string
  ton_cosechadas: number
  ton_entregadas: number
  ton_comprometidas_real: number
  stock_fisico: number
  margen: number
  stock_campo: number
  stock_acopio: number
  silosCampo: any[]
  acopiosAgrupados: AcopioAgrupado[]
  variedades: VariedadRow[]
  compSinVariedad: number
  destinosVariedad: DestinoVariedad[]
}

function fmt(n: number | null | undefined) {
  const num = Number(n ?? 0)
  return isNaN(num) ? '0,0' : num.toLocaleString('es-AR', { minimumFractionDigits: 1 })
}

export default function StockClient({
  rows,
  campanias,
  campaniasIds,
  variedadesCat,
}: {
  rows: StockRow[]
  campanias: string[]
  campaniasIds: Record<string, string>
  variedadesCat: VariedadCat[]
}) {
  const router = useRouter()
  const [campaniaSel, setCampaniaSel] = useState<string>(campanias[0] ?? 'todas')
  const [reclasificando, setReclasificando] = useState<StockRow | null>(null)

  const filtradas = useMemo(
    () => (campaniaSel === 'todas' ? rows : rows.filter(r => r.campania === campaniaSel)),
    [rows, campaniaSel]
  )

  const totalCampo = filtradas.reduce((s, r) => s + r.stock_campo, 0)
  const totalAcopio = filtradas.reduce((s, r) => s + r.stock_acopio, 0)
  const totalFisico = filtradas.reduce((s, r) => s + r.stock_fisico, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Stock de Cereal</h1>
          <p className="text-campo-500 text-sm mt-0.5">Posición física y disponible por cultivo</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {filtradas.some(r => r.variedades.length > 0) && variedadesCat.length > 1 && (
            <button
              type="button"
              onClick={() => setReclasificando(filtradas.find(r => r.variedades.length > 0) ?? null)}
              className="btn-secondary"
            >
              Reclasificar variedad
            </button>
          )}
          <label className="text-sm font-medium text-campo-700">Campaña</label>
          <select
            value={campaniaSel}
            onChange={e => setCampaniaSel(e.target.value)}
            className="input-field w-auto"
          >
            <option value="todas">Todas las campañas</option>
            {campanias.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Resumen de ubicación */}
      {(totalCampo > 0 || totalAcopio > 0) && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-4 text-center">
            <p className="text-xs font-semibold text-campo-500 uppercase tracking-wide mb-1">En campo</p>
            <p className="text-2xl font-bold text-campo-900">{fmt(totalCampo)} tn</p>
            <p className="text-xs text-campo-400 mt-0.5">Embolsado / silo propio</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">En acopio</p>
            <p className="text-2xl font-bold text-blue-700">{fmt(totalAcopio)} tn</p>
            <p className="text-xs text-campo-400 mt-0.5">Almacenado en terceros</p>
          </div>
          <div className="card p-4 text-center border-2 border-campo-200">
            <p className="text-xs font-semibold text-campo-700 uppercase tracking-wide mb-1">Total físico</p>
            <p className="text-2xl font-bold text-campo-900">{fmt(totalFisico)} tn</p>
            <p className="text-xs text-campo-400 mt-0.5">Campo + Acopio</p>
          </div>
        </div>
      )}

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-campo-100 bg-campo-50">
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Campaña</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Cultivo</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Ingreso</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Stock Físico</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">En campo / silos</th>
                <th className="text-left px-5 py-3 font-semibold text-blue-600">En acopio</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Entregado</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Comprometido</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Margen</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((r, i) => (
                <Fragment key={i}>
                <tr className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                  <td className="px-5 py-3 text-campo-600">{r.campania}</td>
                  <td className="px-5 py-3">
                    <span className="font-medium text-campo-900">{r.cultivo}</span>
                    <span className="ml-2 text-xs text-campo-400">{r.cultivo_codigo}</span>
                  </td>
                  <td className="px-5 py-3 text-right text-campo-700">{fmt(r.ton_cosechadas)}</td>
                  <td className="px-5 py-3 text-right font-medium text-campo-900">{fmt(r.stock_fisico)}</td>

                  {/* Silos en campo */}
                  <td className="px-5 py-3">
                    {r.silosCampo.length === 0 ? (
                      r.stock_campo > 0
                        ? <span className="text-campo-700">{fmt(r.stock_campo)}</span>
                        : <span className="text-campo-300">—</span>
                    ) : (
                      <div className="space-y-0.5">
                        {r.silosCampo.map((s: any, j: number) => (
                          <div key={j} className="flex items-center justify-between gap-3">
                            <span className="text-xs text-campo-500">{s.silo_nombre || 'Campo'}</span>
                            <span className="font-medium text-campo-900">{fmt(Number(s.stock_actual))}</span>
                          </div>
                        ))}
                        {r.silosCampo.length > 1 && (
                          <div className="flex items-center justify-between border-t border-campo-100 pt-0.5">
                            <span className="text-xs text-campo-400">Total campo</span>
                            <span className="text-xs font-semibold text-campo-700">{fmt(r.stock_campo)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Acopios: una línea por acopio (Fedea, Morero, etc.), sumando
                      todas sus cargas/lotes en un solo total */}
                  <td className="px-5 py-3">
                    {r.acopiosAgrupados.length === 0 ? (
                      r.stock_acopio > 0
                        ? <span className="text-blue-600">{fmt(r.stock_acopio)}</span>
                        : <span className="text-campo-300">—</span>
                    ) : (
                      <div className="space-y-0.5">
                        {r.acopiosAgrupados.map((a, j: number) => (
                          <div key={j} className="flex items-center gap-2">
                            <span className="font-medium text-blue-600">{fmt(a.total)}</span>
                            <span className="text-xs text-blue-500">{a.nombre}</span>
                          </div>
                        ))}
                        {r.acopiosAgrupados.length > 1 && (
                          <div className="flex items-center justify-between border-t border-blue-100 pt-0.5">
                            <span className="text-xs text-campo-400">Total acopio</span>
                            <span className="text-xs font-semibold text-blue-700">{fmt(r.stock_acopio)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </td>

                  <td className="px-5 py-3 text-right text-campo-700">{fmt(r.ton_entregadas)}</td>
                  <td className="px-5 py-3 text-right text-orange-600 font-medium">{fmt(r.ton_comprometidas_real)}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={`font-semibold ${r.margen >= 0 ? 'text-campo-600' : 'text-red-500'}`}>
                      {fmt(r.margen)}
                    </span>
                  </td>
                </tr>

                {/* Desglose por variedad / tecnología (ej. soja común, DM 40E25, DM 47E23) */}
                {r.variedades.length > 0 && r.variedades.map(v => (
                  <tr key={v.variedad_id} className="border-b border-campo-50 bg-campo-50/40 text-xs">
                    <td className="px-5 py-2"></td>
                    <td className="px-5 py-2 pl-8 text-campo-700">
                      <span className="text-campo-400 mr-1">↳</span>
                      <span className={`font-medium ${v.es_comun ? 'text-campo-700' : 'text-emerald-700'}`}>{v.variedad}</span>
                    </td>
                    <td className="px-5 py-2 text-right text-campo-600">{fmt(v.ton_ingresadas)}</td>
                    <td className="px-5 py-2 text-right font-semibold text-campo-800">{fmt(v.stock_fisico)}</td>
                    <td className="px-5 py-2 text-campo-600">{v.stock_campo > 0.0001 ? fmt(v.stock_campo) : <span className="text-campo-300">—</span>}</td>
                    <td className="px-5 py-2 text-blue-600">{v.stock_acopio > 0.0001 ? fmt(v.stock_acopio) : <span className="text-campo-300">—</span>}</td>
                    <td className="px-5 py-2 text-right text-campo-600">{fmt(v.ton_entregadas)}</td>
                    <td className="px-5 py-2 text-right text-orange-600">{v.comprometido > 0 ? fmt(v.comprometido) : <span className="text-campo-300">—</span>}</td>
                    <td className="px-5 py-2"></td>
                  </tr>
                ))}
                {r.variedades.length > 0 && r.compSinVariedad > 0.0001 && (
                  <tr className="border-b border-campo-50 bg-campo-50/40 text-xs">
                    <td colSpan={7}></td>
                    <td className="px-5 py-2 text-right text-orange-600">{fmt(r.compSinVariedad)}</td>
                    <td className="px-5 py-2 text-campo-400">contratos sin variedad definida</td>
                  </tr>
                )}
                </Fragment>
              ))}
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-campo-400">
                    No hay stock registrado para esta campaña
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {reclasificando && (
        <ReclasificarModal
          row={reclasificando}
          rows={filtradas.filter(r => r.variedades.length > 0)}
          campaniasIds={campaniasIds}
          variedadesCat={variedadesCat}
          onClose={() => setReclasificando(null)}
          onDone={() => { setReclasificando(null); router.refresh() }}
        />
      )}
    </div>
  )
}

/**
 * Pasa toneladas de una variedad a otra (ej. de soja común a DM 40E25) sin
 * cambiar el total: crea dos ajustes de stock, uno negativo en la variedad de
 * origen y uno positivo en la de destino, en el mismo lugar (campo o acopio).
 */
function ReclasificarModal({
  row, rows, campaniasIds, variedadesCat, onClose, onDone,
}: {
  row: StockRow
  rows: StockRow[]
  campaniasIds: Record<string, string>
  variedadesCat: VariedadCat[]
  onClose: () => void
  onDone: () => void
}) {
  const supabase = createClient()
  const [rowSel, setRowSel] = useState<StockRow>(row)
  const cat = useMemo(() => {
    const primera = rowSel.variedades[0]
    const cultivoId = variedadesCat.find(c => c.id === primera?.variedad_id)?.cultivo_id
    return variedadesCat.filter(c => c.cultivo_id === cultivoId)
  }, [rowSel, variedadesCat])

  const comun = cat.find(c => c.es_comun)
  const [origenId, setOrigenId] = useState<string>(comun?.id ?? cat[0]?.id ?? '')
  const [destinoId, setDestinoId] = useState<string>(cat.find(c => !c.es_comun)?.id ?? '')
  const [lugar, setLugar] = useState<string>('')
  const [tn, setTn] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Lugares (campo / acopios) donde la variedad de origen tiene stock
  const lugares = useMemo(
    () => rowSel.destinosVariedad.filter(d => d.variedad_id === origenId && Number(d.stock_actual) > 0.0001),
    [rowSel, origenId]
  )
  const claveLugar = (d: DestinoVariedad) => `${d.ubicacion}|${d.acopio_cliente_id ?? ''}`
  const lugarSel = lugares.find(d => claveLugar(d) === lugar) ?? lugares[0]
  const disponible = Number(lugarSel?.stock_actual ?? 0)
  const nombreCat = (id: string) => cat.find(c => c.id === id)?.nombre ?? ''

  async function guardar() {
    setError(null)
    const cantidad = Number(tn)
    if (!origenId || !destinoId || origenId === destinoId) { setError('Elegí dos variedades distintas.'); return }
    if (!(cantidad > 0)) { setError('Ingresá las toneladas a pasar.'); return }
    if (!lugarSel) { setError('La variedad de origen no tiene stock para pasar.'); return }
    if (cantidad > disponible + 0.0001) { setError(`Sólo hay ${fmt(disponible)} tn de ${nombreCat(origenId)} en ese lugar.`); return }
    const campaniaId = campaniasIds[rowSel.campania]
    const cultivoId = cat[0]?.cultivo_id
    if (!campaniaId || !cultivoId) { setError('No se pudo identificar la campaña o el cultivo.'); return }

    setGuardando(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Sin sesión'); setGuardando(false); return }

    const base = {
      tipo: 'ajuste',
      fecha,
      campania_id: campaniaId,
      cultivo_id: cultivoId,
      usuario_id: session.user.id,
      ubicacion: lugarSel.ubicacion,
      acopio_cliente_id: lugarSel.ubicacion === 'acopio' ? lugarSel.acopio_cliente_id : null,
    }
    const desc = `Reclasificación de variedad: ${nombreCat(origenId)} → ${nombreCat(destinoId)}`

    const { data: movSale, error: e1 } = await supabase
      .from('movimientos_cereal').insert({ ...base, toneladas: -cantidad, descripcion_movimiento: desc }).select('id').single()
    if (e1) { setError(e1.message); setGuardando(false); return }
    const { data: movEntra, error: e2 } = await supabase
      .from('movimientos_cereal').insert({ ...base, toneladas: cantidad, descripcion_movimiento: desc }).select('id').single()
    if (e2) { setError(`Se registró la salida pero falló la entrada: ${e2.message}. Avisame para corregirlo.`); setGuardando(false); return }

    const r1 = await guardarMezclaMovimientos(supabase, [{ id: movSale.id, toneladas: cantidad }], { [origenId]: String(cantidad) })
    const r2 = await guardarMezclaMovimientos(supabase, [{ id: movEntra.id, toneladas: cantidad }], { [destinoId]: String(cantidad) })
    if (r1.error || r2.error) { setError(`No se pudo guardar la variedad: ${r1.error ?? r2.error}`); setGuardando(false); return }

    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-campo-900">Reclasificar stock por variedad</h2>
          <p className="text-sm text-campo-500 mt-0.5">
            Pasa toneladas de una variedad a otra. El stock total no cambia.
          </p>
        </div>

        {rows.length > 1 && (
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Campaña / cultivo</label>
            <select
              className="input-field"
              value={`${rowSel.campania}|${rowSel.cultivo}`}
              onChange={e => {
                const r = rows.find(x => `${x.campania}|${x.cultivo}` === e.target.value)
                if (r) setRowSel(r)
              }}
            >
              {rows.map(r => <option key={`${r.campania}|${r.cultivo}`} value={`${r.campania}|${r.cultivo}`}>{r.cultivo} — {r.campania}</option>)}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Sacar de</label>
            <select className="input-field" value={origenId} onChange={e => { setOrigenId(e.target.value); setLugar('') }}>
              {cat.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Pasar a</label>
            <select className="input-field" value={destinoId} onChange={e => setDestinoId(e.target.value)}>
              <option value="">Elegí</option>
              {cat.filter(c => c.id !== origenId).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Lugar</label>
            <select className="input-field" value={lugarSel ? claveLugar(lugarSel) : ''} onChange={e => setLugar(e.target.value)}>
              {lugares.length === 0 && <option value="">Sin stock</option>}
              {lugares.map(d => (
                <option key={claveLugar(d)} value={claveLugar(d)}>
                  {d.ubicacion === 'acopio' ? (d.acopio_nombre ?? 'Acopio') : 'Campo / silo propio'} — {fmt(d.stock_actual)} tn
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Toneladas</label>
            <input type="number" step="0.001" min="0" className="input-field" value={tn} onChange={e => setTn(e.target.value)} placeholder="0" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-campo-700 mb-1">Fecha</label>
          <input type="date" className="input-field" value={fecha} onChange={e => setFecha(e.target.value)} />
        </div>

        {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={guardando}>Cancelar</button>
          <button type="button" onClick={guardar} className="btn-primary" disabled={guardando}>{guardando ? 'Guardando...' : 'Reclasificar'}</button>
        </div>
      </div>
    </div>
  )
}
