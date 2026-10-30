'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Campana = { id: number; nombre: string }

type CuotaForm = { fecha: string; monto: string; pagado: boolean }

type CostoGeneral = {
  id: number
  categoria: string
  concepto: string
  proveedor: string | null
  monto_total_usd: number
  observaciones: string | null
  costos_generales_campanas: { campana_id: number; porcentaje: number }[]
  costos_generales_cuotas: { id: number; nro: number; fecha: string; monto_usd: number; pagado: boolean }[]
}

const PERIODICIDADES = [
  { value: 1, label: 'Mensual' },
  { value: 2, label: 'Bimestral' },
  { value: 3, label: 'Trimestral' },
  { value: 4, label: 'Cuatrimestral' },
  { value: 6, label: 'Semestral' },
  { value: 12, label: 'Anual' },
]

const inputCls = 'w-full rounded-lg border border-campo-200 px-3 py-1.5 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400'
const labelCls = 'block text-xs font-medium text-campo-600 mb-1'

function hoy() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function sumarMeses(fecha: string, meses: number): string {
  const [y, m, d] = fecha.split('-').map(Number)
  const total = (m - 1) + meses
  const ny = y + Math.floor(total / 12)
  const nm = ((total % 12) + 12) % 12
  const ultimo = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate()
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}`
}

function fmt(n: number) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function generarCuotas(total: number, n: number, primera: string, cada: number): CuotaForm[] {
  if (!primera || n < 1 || !(total >= 0)) return []
  const base = Math.floor((total / n) * 100) / 100
  const res: CuotaForm[] = []
  let acum = 0
  for (let i = 0; i < n; i++) {
    const monto = i === n - 1 ? Math.round((total - acum) * 100) / 100 : base
    acum += monto
    res.push({ fecha: sumarMeses(primera, i * cada), monto: monto.toFixed(2), pagado: false })
  }
  return res
}

// ───────────────────────── Formulario (alta / edición) ─────────────────────────

function FormularioCosto({
  campanas, categorias, editando, onCerrar, onGuardado,
}: {
  campanas: Campana[]
  categorias: string[]
  editando: CostoGeneral | null
  onCerrar: () => void
  onGuardado: () => void
}) {
  const supabase = createClient()
  const [categoria, setCategoria] = useState(editando?.categoria ?? '')
  const [categoriaNueva, setCategoriaNueva] = useState('')
  const [concepto, setConcepto] = useState(editando?.concepto ?? '')
  const [proveedor, setProveedor] = useState(editando?.proveedor ?? '')
  const [observaciones, setObservaciones] = useState(editando?.observaciones ?? '')
  const [total, setTotal] = useState(editando ? String(editando.monto_total_usd) : '')
  const [pagoUnico, setPagoUnico] = useState(editando ? editando.costos_generales_cuotas.length <= 1 : true)
  const [nCuotas, setNCuotas] = useState(editando ? Math.max(editando.costos_generales_cuotas.length, 2) : 3)
  const [cada, setCada] = useState(1)
  const [primera, setPrimera] = useState(
    editando
      ? [...editando.costos_generales_cuotas].sort((a, b) => a.fecha.localeCompare(b.fecha))[0]?.fecha ?? hoy()
      : hoy()
  )
  const [cuotas, setCuotas] = useState<CuotaForm[]>(
    editando
      ? [...editando.costos_generales_cuotas]
          .sort((a, b) => a.fecha.localeCompare(b.fecha))
          .map(c => ({ fecha: c.fecha, monto: String(c.monto_usd), pagado: c.pagado }))
      : []
  )
  const [porc, setPorc] = useState<Record<number, string>>(() => {
    const o: Record<number, string> = {}
    editando?.costos_generales_campanas.forEach(c => { o[c.campana_id] = String(c.porcentaje) })
    return o
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [regenerar, setRegenerar] = useState(!editando)

  const totalNum = Number(total) || 0

  // Regenera las cuotas cuando cambian los parámetros (en edición, solo si el usuario lo pide)
  useEffect(() => {
    if (!regenerar) return
    setCuotas(generarCuotas(totalNum, pagoUnico ? 1 : nCuotas, primera, cada))
  }, [totalNum, pagoUnico, nCuotas, primera, cada, regenerar])

  const seleccionadas = campanas.filter(c => porc[c.id] !== undefined)
  const sumaPorc = seleccionadas.reduce((s, c) => s + (Number(porc[c.id]) || 0), 0)
  const sumaCuotas = cuotas.reduce((s, c) => s + (Number(c.monto) || 0), 0)

  function alternarCampana(id: number) {
    setPorc(p => {
      const nuevo = { ...p }
      if (nuevo[id] !== undefined) delete nuevo[id]
      else nuevo[id] = '0'
      const ids = Object.keys(nuevo).map(Number)
      const parte = ids.length ? Math.floor((100 / ids.length) * 1000) / 1000 : 0
      ids.forEach((k, i) => {
        nuevo[k] = String(i === ids.length - 1 ? Math.round((100 - parte * (ids.length - 1)) * 1000) / 1000 : parte)
      })
      return nuevo
    })
  }

  function repartirIgual() {
    setPorc(p => {
      const ids = Object.keys(p).map(Number)
      const parte = ids.length ? Math.floor((100 / ids.length) * 1000) / 1000 : 0
      const nuevo: Record<number, string> = {}
      ids.forEach((k, i) => {
        nuevo[k] = String(i === ids.length - 1 ? Math.round((100 - parte * (ids.length - 1)) * 1000) / 1000 : parte)
      })
      return nuevo
    })
  }

  function ajustarUltimaCuota() {
    if (cuotas.length === 0) return
    const resto = totalNum - cuotas.slice(0, -1).reduce((s, c) => s + (Number(c.monto) || 0), 0)
    setCuotas(cs => cs.map((c, i) => i === cs.length - 1 ? { ...c, monto: (Math.round(resto * 100) / 100).toFixed(2) } : c))
  }

  async function guardar() {
    setError(null)
    const cat = (categoria === '__nueva__' ? categoriaNueva : categoria).trim()
    if (!cat) return setError('Elegí una categoría.')
    if (!concepto.trim()) return setError('Poné un concepto (ej: "Cuota crédito Banco Nación").')
    if (!(totalNum > 0)) return setError('Ingresá el monto total en USD.')
    if (seleccionadas.length === 0) return setError('Elegí al menos una campaña.')
    if (Math.abs(sumaPorc - 100) > 0.01) return setError(`Los porcentajes de las campañas suman ${sumaPorc.toFixed(2)}%, tienen que sumar 100%.`)
    if (cuotas.length === 0 || cuotas.some(c => !c.fecha || !(Number(c.monto) >= 0))) return setError('Revisá las fechas y montos de los pagos.')
    if (Math.abs(sumaCuotas - totalNum) > 0.01) return setError(`Los pagos suman USD ${fmt(sumaCuotas)} y el total es USD ${fmt(totalNum)}. Usá "Ajustar última cuota".`)

    setGuardando(true)
    try {
      if (categoria === '__nueva__') {
        await supabase.from('costos_generales_categorias').upsert({ nombre: cat, orden: 500 }, { onConflict: 'nombre' })
      }
      let costoId = editando?.id
      const cabecera = {
        categoria: cat,
        concepto: concepto.trim(),
        proveedor: proveedor.trim() || null,
        monto_total_usd: totalNum,
        observaciones: observaciones.trim() || null,
      }
      if (costoId) {
        const { error: e } = await supabase.from('costos_generales').update(cabecera).eq('id', costoId)
        if (e) throw e
        const { error: e1 } = await supabase.from('costos_generales_campanas').delete().eq('costo_id', costoId)
        if (e1) throw e1
        const { error: e2 } = await supabase.from('costos_generales_cuotas').delete().eq('costo_id', costoId)
        if (e2) throw e2
      } else {
        const { data, error: e } = await supabase.from('costos_generales').insert(cabecera).select('id').single()
        if (e) throw e
        costoId = data.id as number
      }
      const { error: e3 } = await supabase.from('costos_generales_campanas').insert(
        seleccionadas.map(c => ({ costo_id: costoId, campana_id: c.id, porcentaje: Number(porc[c.id]) }))
      )
      if (e3) throw e3
      const { error: e4 } = await supabase.from('costos_generales_cuotas').insert(
        cuotas.map((c, i) => ({ costo_id: costoId, nro: i + 1, fecha: c.fecha, monto_usd: Number(c.monto), pagado: c.pagado }))
      )
      if (e4) throw e4
      onGuardado()
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo guardar.')
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl my-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-campo-100">
          <h2 className="text-lg font-bold text-campo-900">{editando ? 'Editar costo' : 'Nuevo costo'}</h2>
          <button onClick={onCerrar} className="text-campo-400 hover:text-campo-800 text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Categoría *</label>
              <select value={categoria} onChange={e => setCategoria(e.target.value)} className={inputCls}>
                <option value="">Elegir…</option>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="__nueva__">➕ Crear categoría nueva…</option>
              </select>
              {categoria === '__nueva__' && (
                <input value={categoriaNueva} onChange={e => setCategoriaNueva(e.target.value)}
                  placeholder="Nombre de la categoría" className={inputCls + ' mt-2'} />
              )}
            </div>
            <div>
              <label className={labelCls}>Monto total (USD) *</label>
              <input type="number" step="0.01" min="0" value={total} onChange={e => setTotal(e.target.value)}
                placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Concepto *</label>
              <input value={concepto} onChange={e => setConcepto(e.target.value)}
                placeholder='Ej: Crédito Banco Nación, Honorarios contador' className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Proveedor / acreedor</label>
              <input value={proveedor} onChange={e => setProveedor(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Campañas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-campo-600">Campañas a las que se asocia *</label>
              {seleccionadas.length > 1 && (
                <button type="button" onClick={repartirIgual} className="text-xs text-emerald-700 underline">Repartir en partes iguales</button>
              )}
            </div>
            <div className="space-y-2">
              {campanas.map(c => {
                const activa = porc[c.id] !== undefined
                return (
                  <div key={c.id} className="flex items-center gap-3">
                    <label className="flex items-center gap-2 w-40 text-sm text-campo-900 cursor-pointer">
                      <input type="checkbox" checked={activa} onChange={() => alternarCampana(c.id)} />
                      Campaña {c.nombre}
                    </label>
                    {activa && (
                      <>
                        <input type="number" step="0.001" min="0" max="100" value={porc[c.id]}
                          onChange={e => setPorc(p => ({ ...p, [c.id]: e.target.value }))}
                          className="w-24 rounded-lg border border-campo-200 px-2 py-1 text-sm text-right" />
                        <span className="text-sm text-campo-500">%</span>
                        <span className="text-xs text-campo-400">USD {fmt(totalNum * (Number(porc[c.id]) || 0) / 100)}</span>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
            {seleccionadas.length > 0 && (
              <p className={`text-xs mt-2 ${Math.abs(sumaPorc - 100) > 0.01 ? 'text-red-600' : 'text-campo-400'}`}>
                Suma: {sumaPorc.toFixed(2)}% {Math.abs(sumaPorc - 100) > 0.01 ? '(debe ser 100%)' : '✓'}
              </p>
            )}
          </div>

          {/* Pagos */}
          <div>
            <label className="text-xs font-medium text-campo-600">Pagos *</label>
            <div className="flex flex-wrap items-end gap-4 mt-2">
              <div className="flex rounded-lg border border-campo-200 overflow-hidden text-sm">
                <button type="button" onClick={() => { setPagoUnico(true); setRegenerar(true) }}
                  className={`px-3 py-1.5 ${pagoUnico ? 'bg-emerald-700 text-white' : 'bg-white text-campo-700'}`}>Pago único</button>
                <button type="button" onClick={() => { setPagoUnico(false); setRegenerar(true) }}
                  className={`px-3 py-1.5 ${!pagoUnico ? 'bg-emerald-700 text-white' : 'bg-white text-campo-700'}`}>En cuotas</button>
              </div>
              <div>
                <label className={labelCls}>{pagoUnico ? 'Fecha' : 'Fecha de la 1ª cuota'}</label>
                <input type="date" value={primera} onChange={e => { setPrimera(e.target.value); setRegenerar(true) }} className={inputCls} />
              </div>
              {!pagoUnico && (
                <>
                  <div className="w-24">
                    <label className={labelCls}>Cuotas</label>
                    <input type="number" min="2" max="120" value={nCuotas}
                      onChange={e => { setNCuotas(Math.max(2, Number(e.target.value) || 2)); setRegenerar(true) }} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Periodicidad</label>
                    <select value={cada} onChange={e => { setCada(Number(e.target.value)); setRegenerar(true) }} className={inputCls}>
                      {PERIODICIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>

            {cuotas.length > 0 && (
              <div className="mt-3 border border-campo-100 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-campo-50 text-campo-600 text-xs">
                    <tr>
                      <th className="text-left px-3 py-1.5 w-10">#</th>
                      <th className="text-left px-3 py-1.5">Fecha</th>
                      <th className="text-right px-3 py-1.5">Monto USD</th>
                      <th className="text-center px-3 py-1.5">Pagado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuotas.map((c, i) => (
                      <tr key={i} className="border-t border-campo-100">
                        <td className="px-3 py-1 text-campo-400">{i + 1}</td>
                        <td className="px-3 py-1">
                          <input type="date" value={c.fecha}
                            onChange={e => { setRegenerar(false); setCuotas(cs => cs.map((x, j) => j === i ? { ...x, fecha: e.target.value } : x)) }}
                            className="rounded border border-campo-200 px-2 py-0.5 text-sm" />
                        </td>
                        <td className="px-3 py-1 text-right">
                          <input type="number" step="0.01" value={c.monto}
                            onChange={e => { setRegenerar(false); setCuotas(cs => cs.map((x, j) => j === i ? { ...x, monto: e.target.value } : x)) }}
                            className="w-32 rounded border border-campo-200 px-2 py-0.5 text-sm text-right" />
                        </td>
                        <td className="px-3 py-1 text-center">
                          <input type="checkbox" checked={c.pagado}
                            onChange={e => setCuotas(cs => cs.map((x, j) => j === i ? { ...x, pagado: e.target.checked } : x))} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-campo-200 bg-campo-50">
                      <td colSpan={2} className="px-3 py-1.5 text-xs text-campo-500">
                        Las fechas y montos se pueden editar a mano.
                        {Math.abs(sumaCuotas - totalNum) > 0.01 && (
                          <button type="button" onClick={ajustarUltimaCuota} className="ml-2 text-emerald-700 underline">Ajustar última cuota</button>
                        )}
                      </td>
                      <td className={`px-3 py-1.5 text-right font-semibold ${Math.abs(sumaCuotas - totalNum) > 0.01 ? 'text-red-600' : 'text-campo-800'}`}>
                        {fmt(sumaCuotas)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>Observaciones</label>
            <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2} className={inputCls} />
          </div>

          {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-campo-100">
          <button onClick={onCerrar} className="px-4 py-2 rounded-lg text-sm bg-white border border-campo-200 text-campo-700 hover:bg-campo-50">Cancelar</button>
          <button onClick={guardar} disabled={guardando}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50">
            {guardando ? 'Guardando…' : 'Guardar costo'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ───────────────────────── Botón + listado ─────────────────────────

export default function CostosGenerales({ onCambio }: { onCambio: () => void }) {
  const supabase = createClient()
  const [campanas, setCampanas] = useState<Campana[]>([])
  const [categorias, setCategorias] = useState<string[]>([])
  const [costos, setCostos] = useState<CostoGeneral[]>([])
  const [formAbierto, setFormAbierto] = useState(false)
  const [editando, setEditando] = useState<CostoGeneral | null>(null)
  const [listaAbierta, setListaAbierta] = useState(false)
  const [errorLista, setErrorLista] = useState<string | null>(null)

  async function cargar() {
    const [{ data: cps }, { data: cats }, { data: cgs, error }] = await Promise.all([
      supabase.from('campanas').select('id, nombre').eq('activo', true).order('nombre'),
      supabase.from('costos_generales_categorias').select('nombre').order('orden').order('nombre'),
      supabase.from('costos_generales')
        .select('id, categoria, concepto, proveedor, monto_total_usd, observaciones, costos_generales_campanas(campana_id, porcentaje), costos_generales_cuotas(id, nro, fecha, monto_usd, pagado)')
        .order('created_at', { ascending: false }),
    ])
    setCampanas((cps ?? []) as Campana[])
    setCategorias((cats ?? []).map((c: any) => c.nombre))
    setCostos(((cgs ?? []) as any[]).map(c => ({
      ...c,
      monto_total_usd: Number(c.monto_total_usd),
      costos_generales_campanas: (c.costos_generales_campanas ?? []).map((x: any) => ({ ...x, porcentaje: Number(x.porcentaje) })),
      costos_generales_cuotas: (c.costos_generales_cuotas ?? []).map((x: any) => ({ ...x, monto_usd: Number(x.monto_usd) })),
    })))
    setErrorLista(error ? error.message : null)
  }

  useEffect(() => { cargar() }, [])

  const nombreCampana = useMemo(() => new Map(campanas.map(c => [c.id, c.nombre])), [campanas])

  async function eliminar(c: CostoGeneral) {
    if (!window.confirm(`¿Eliminar "${c.concepto}" (USD ${fmt(c.monto_total_usd)})? Se quita de todas las campañas.`)) return
    const { error } = await supabase.from('costos_generales').delete().eq('id', c.id)
    if (error) { setErrorLista(error.message); return }
    await cargar()
    onCambio()
  }

  async function alternarPagado(costo: CostoGeneral, cuotaId: number, pagado: boolean) {
    const { error } = await supabase.from('costos_generales_cuotas').update({ pagado }).eq('id', cuotaId)
    if (error) { setErrorLista(error.message); return }
    await cargar()
    onCambio()
  }

  return (
    <>
      <div className="flex gap-2">
        <button onClick={() => { setEditando(null); setFormAbierto(true) }}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-lime-500 text-campo-900 hover:bg-lime-400 transition-colors">
          ➕ Nuevo costo
        </button>
        <button onClick={() => setListaAbierta(v => !v)}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-campo-200 text-campo-700 hover:bg-campo-50 transition-colors">
          {listaAbierta ? 'Ocultar' : 'Ver'} costos cargados{costos.length ? ` (${costos.length})` : ''}
        </button>
      </div>

      {formAbierto && (
        <FormularioCosto
          campanas={campanas}
          categorias={categorias}
          editando={editando}
          onCerrar={() => setFormAbierto(false)}
          onGuardado={async () => { setFormAbierto(false); setListaAbierta(true); await cargar(); onCambio() }}
        />
      )}

      {listaAbierta && (
        <div className="card p-4 basis-full w-full order-last">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-campo-900">Costos generales cargados desde acá</h2>
            <span className="text-xs text-campo-400">Créditos, honorarios, gastos generales, etc.</span>
          </div>
          {errorLista && <div className="text-sm text-red-600 mb-2">{errorLista}</div>}
          {costos.length === 0 ? (
            <p className="text-sm text-campo-400 py-4">Todavía no cargaste ninguno. Usá "➕ Nuevo costo".</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-campo-500 border-b border-campo-100">
                  <tr>
                    <th className="text-left py-1.5 pr-3">Categoría</th>
                    <th className="text-left py-1.5 pr-3">Concepto</th>
                    <th className="text-right py-1.5 pr-3">Total USD</th>
                    <th className="text-left py-1.5 pr-3">Campañas</th>
                    <th className="text-left py-1.5 pr-3">Pagos</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {costos.map(c => {
                    const cuotas = [...c.costos_generales_cuotas].sort((a, b) => a.fecha.localeCompare(b.fecha))
                    return (
                      <tr key={c.id} className="border-b border-campo-50 align-top">
                        <td className="py-2 pr-3 text-campo-700">{c.categoria}</td>
                        <td className="py-2 pr-3 text-campo-900">
                          {c.concepto}
                          {c.proveedor && <div className="text-xs text-campo-400">{c.proveedor}</div>}
                        </td>
                        <td className="py-2 pr-3 text-right font-medium">{fmt(c.monto_total_usd)}</td>
                        <td className="py-2 pr-3 text-campo-700">
                          {c.costos_generales_campanas.map(x => (
                            <div key={x.campana_id}>{nombreCampana.get(x.campana_id) ?? x.campana_id}: {x.porcentaje}%</div>
                          ))}
                        </td>
                        <td className="py-2 pr-3">
                          {cuotas.map(q => (
                            <label key={q.id} className="flex items-center gap-2 text-xs text-campo-700 cursor-pointer">
                              <input type="checkbox" checked={q.pagado} onChange={e => alternarPagado(c, q.id, e.target.checked)} />
                              {q.fecha.split('-').reverse().join('/')} · USD {fmt(q.monto_usd)}
                            </label>
                          ))}
                        </td>
                        <td className="py-2 text-right whitespace-nowrap">
                          <button onClick={() => { setEditando(c); setFormAbierto(true) }} className="text-xs text-emerald-700 underline mr-3">Editar</button>
                          <button onClick={() => eliminar(c)} className="text-xs text-red-600 underline">Eliminar</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  )
}
