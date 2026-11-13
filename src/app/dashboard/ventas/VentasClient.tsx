'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const TIPOS_OTROS = ['otro_ingreso', 'otro_egreso', 'recepcion_cliente', 'consumo_hacienda', 'merma']
const TIPOS_EGRESO = ['entrega', 'otro_egreso', 'consumo_hacienda', 'merma']

const ETIQUETA_TIPO: Record<string, string> = {
  entrega: 'Venta',
  compra: 'Compra',
  cosecha: 'Cosecha',
  ajuste: 'Ajuste',
  otro_ingreso: 'Otro ingreso',
  otro_egreso: 'Otro egreso',
  recepcion_cliente: 'Recepción de cliente',
  consumo_hacienda: 'Consumo hacienda',
  merma: 'Merma',
}

const VISTAS = [
  { id: 'ventas', label: 'Ventas' },
  { id: 'compras', label: 'Compras' },
  { id: 'ajustes', label: 'Ajustes' },
  { id: 'otros', label: 'Otros movimientos' },
  { id: 'cosecha', label: 'Cosecha' },
  { id: 'todos', label: 'Todos' },
] as const
type VistaId = typeof VISTAS[number]['id']

function perteneceAVista(tipo: string, vista: VistaId) {
  if (vista === 'todos') return true
  if (vista === 'ventas') return tipo === 'entrega'
  if (vista === 'compras') return tipo === 'compra'
  if (vista === 'ajustes') return tipo === 'ajuste'
  if (vista === 'cosecha') return tipo === 'cosecha'
  return TIPOS_OTROS.includes(tipo)
}

// Toneladas con signo: + suma stock, − resta stock (los ajustes ya vienen con signo)
function toneladasConSigno(e: any) {
  const tn = Number(e.toneladas ?? 0)
  return TIPOS_EGRESO.includes(e.tipo) ? -Math.abs(tn) : tn
}

function claseTipo(tipo: string) {
  if (tipo === 'compra') return 'bg-blue-100 text-blue-700'
  if (tipo === 'ajuste') return 'bg-amber-100 text-amber-700'
  if (TIPOS_EGRESO.includes(tipo) && tipo !== 'entrega') return 'bg-red-100 text-red-700'
  if (tipo === 'entrega') return 'bg-campo-100 text-campo-700'
  return 'bg-emerald-100 text-emerald-700'
}

export default function VentasClient({ ventas: ventasIniciales, contratos }: { ventas: any[], contratos: any[] }) {
  const supabase = createClient()
  const router = useRouter()
  const [ventas, setVentas] = useState(ventasIniciales)
  useEffect(() => { setVentas(ventasIniciales) }, [ventasIniciales])
  const [editMov, setEditMov] = useState<any | null>(null)
  const [formMov, setFormMov] = useState({ fecha: '', toneladas: '', humedad: '', precio_unitario: '', flete: '', secado: '', paritaria: '', otros_gastos: '', descripcion_movimiento: '', observaciones: '' })
  const [bloqueoTn, setBloqueoTn] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [vista, setVista] = useState<VistaId>('ventas')
  const [campaniasSel, setCampaniasSel] = useState<string[]>([]) // vacío = todas
  const [editando, setEditando] = useState<any | null>(null)
  const [bonifInput, setBonifInput] = useState('')
  const [vinculando, setVinculando] = useState<any | null>(null)
  const [contratoSel, setContratoSel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [eliminandoId, setEliminandoId] = useState<string | null>(null)
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null)

  const campaniasDisponibles = useMemo(
    () => Array.from(new Set(ventas.map(e => e.campania).filter(Boolean) as string[])).sort().reverse(),
    [ventas]
  )

  function toggleCampania(c: string) {
    setCampaniasSel(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }

  const porCampania = useMemo(
    () => campaniasSel.length === 0 ? ventas : ventas.filter(e => campaniasSel.includes(e.campania)),
    [ventas, campaniasSel]
  )

  const buscadas = useMemo(() => {
    if (!busqueda.trim()) return porCampania
    const q = busqueda.toLowerCase()
    return porCampania.filter(e =>
      e.fecha?.includes(q) ||
      e.ctg?.toLowerCase().includes(q) ||
      e.cultivo?.toLowerCase().includes(q) ||
      e.campania?.toLowerCase().includes(q) ||
      e.cliente?.toLowerCase().includes(q) ||
      e.lote?.toLowerCase().includes(q) ||
      (ETIQUETA_TIPO[e.tipo] ?? e.tipo)?.toLowerCase().includes(q) ||
      String(e.contrato ?? '').toLowerCase().includes(q) ||
      e.descripcion_movimiento?.toLowerCase().includes(q) ||
      e.observaciones?.toLowerCase().includes(q)
    )
  }, [porCampania, busqueda])

  const filtradas = useMemo(() => buscadas.filter(e => perteneceAVista(e.tipo, vista)), [buscadas, vista])
  const conteos = useMemo(() => Object.fromEntries(VISTAS.map(v => [v.id, buscadas.filter(e => perteneceAVista(e.tipo, v.id)).length])) as Record<VistaId, number>, [buscadas])
  const variacionNeta = filtradas.reduce((s, e) => s + toneladasConSigno(e), 0)

  const ventasFiltradas = filtradas.filter(e => e.tipo !== 'compra')
  const comprasFiltradas = filtradas.filter(e => e.tipo === 'compra')
  const totalTon = filtradas.reduce((s, e) => s + Number(e.toneladas ?? 0), 0)
  const totalVentasUSD = ventasFiltradas.reduce((s, e) => s + Number(e.total_usd ?? 0), 0)
  const totalComprasUSD = comprasFiltradas.reduce((s, e) => s + Number(e.total_usd ?? 0), 0)

  const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
  const fmtUSD = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  function abrirModalBonif(e: any) {
    setEditando(e)
    setBonifInput(e.bonificacion ? String(e.bonificacion) : '')
    setError(null)
  }

  function cerrarModalBonif() {
    setEditando(null)
    setBonifInput('')
    setError(null)
  }

  function abrirModalContrato(e: any) {
    setVinculando(e)
    setContratoSel(e.contrato_id ?? '')
    setError(null)
  }

  function cerrarModalContrato() {
    setVinculando(null)
    setContratoSel('')
    setError(null)
  }

  async function guardarBonificacion() {
    if (!editando) return
    setSaving(true)
    setError(null)

    const bonif = parseFloat(bonifInput) || 0

    // Si tiene carta de porte, guardar ahí. Si no, guardar en movimientos_cereal
    if (editando.carta_porte_id) {
      const { error } = await supabase
        .from('cartas_porte')
        .update({ bonificacion_calidad: bonif })
        .eq('id', editando.carta_porte_id)
      if (error) { setError(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase
        .from('movimientos_cereal')
        .update({ bonificacion_calidad: bonif })
        .eq('id', editando.id)
      if (error) { setError(error.message); setSaving(false); return }
    }

    const precio_base = Number(editando.precio_base ?? 0)
    const precio_plus = Number(editando.precio_plus ?? 0)
    const comision_tn = Number(editando.comision_tn ?? 0)
    const tarifa_flete = Number(editando.tarifa_flete ?? 0)
    const toneladas = Number(editando.toneladas ?? 0)
    const bonif_usd = precio_base * bonif / 100
    const total_tn = precio_base + bonif_usd + precio_plus - comision_tn - tarifa_flete
    const total_usd = total_tn * toneladas

    setVentas(prev => prev.map(v =>
      v.id === editando.id
        ? { ...v, bonificacion: bonif || null, bonif_usd: bonif_usd || null, total_tn: total_tn || null, total_usd: total_usd || null }
        : v
    ))
    setSaving(false)
    cerrarModalBonif()
  }

  async function eliminarMovimiento(e: any) {
    const etiqueta = e.ctg ? `CTG ${e.ctg}` : `${e.cultivo ?? 'movimiento'} — ${fmt(Number(e.toneladas ?? 0))} tn`
    let mensaje = `¿Eliminar este movimiento (${ETIQUETA_TIPO[e.tipo] ?? e.tipo} — ${etiqueta})? Esta acción no se puede deshacer.`
    if (e.carta_porte_id) {
      mensaje += '\n\nOjo: este movimiento se generó automáticamente desde una Carta de Porte. Si esa carta se vuelve a guardar, puede volver a crearse.'
    }
    if (!confirm(mensaje)) return

    setErrorEliminar(null)
    setEliminandoId(e.id)
    const { data, error } = await supabase.from('movimientos_cereal').delete().eq('id', e.id).select('id')
    setEliminandoId(null)

    if (error) { setErrorEliminar(error.message); return }
    if (!data || data.length === 0) {
      setErrorEliminar('No se pudo eliminar: no tenés permisos suficientes (solo un administrador puede borrar movimientos).')
      return
    }
    setVentas(prev => prev.filter(v => v.id !== e.id))
  }

  async function abrirEditarMov(e: any) {
    setError(null)
    setEditMov(e)
    const s = (v: any) => (v === null || v === undefined ? '' : String(v))
    setFormMov({
      fecha: e.fecha ?? '',
      toneladas: s(e.toneladas),
      humedad: s(e.humedad),
      precio_unitario: s(e.precio_mov),
      flete: s(e.flete_total),
      secado: s(e.secado),
      paritaria: s(e.paritaria),
      otros_gastos: s(e.otros_gastos),
      descripcion_movimiento: e.descripcion_movimiento ?? '',
      observaciones: e.observaciones ?? '',
    })
    if (e.carta_porte_id) {
      setBloqueoTn('Las toneladas vienen de la carta de porte: para cambiarlas editá la carta de porte.')
    } else if (e.tipo === 'cosecha') {
      setBloqueoTn('Las toneladas de cosecha se cargan desde Seguimiento → lote → cosecha.')
    } else {
      setBloqueoTn(null)
      const { count, error: errOr } = await supabase
        .from('movimiento_cereal_origenes')
        .select('movimiento_id', { count: 'exact', head: true })
        .eq('movimiento_id', e.id)
      if (errOr) setBloqueoTn('No pude verificar si el movimiento descuenta de silos; por seguridad las toneladas no se pueden editar acá.')
      else if ((count ?? 0) > 0) setBloqueoTn('Este movimiento descuenta de silos: para cambiar las toneladas eliminalo y cargalo de nuevo, o hacé un ajuste de stock.')
    }
  }

  function cerrarEditarMov() {
    setEditMov(null)
    setBloqueoTn(null)
    setError(null)
  }

  async function guardarEdicionMov() {
    if (!editMov) return
    setError(null)
    const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')))
    const campos = ['toneladas', 'humedad', 'precio_unitario', 'flete', 'secado', 'paritaria', 'otros_gastos'] as const
    for (const c of campos) {
      const n = num((formMov as any)[c])
      if (n !== null && !isFinite(n)) { setError(`El valor de "${c.replace('_', ' ')}" no es un número válido.`); return }
    }
    if (!formMov.fecha) { setError('La fecha es obligatoria.'); return }
    const tn = num(formMov.toneladas)
    if (!bloqueoTn && (tn === null || tn === 0)) { setError('Las toneladas no pueden estar vacías ni ser 0.'); return }
    for (const c of ['flete', 'secado', 'paritaria', 'otros_gastos'] as const) {
      const n = num(formMov[c]); if (n !== null && n < 0) { setError('Los gastos no pueden ser negativos.'); return }
    }

    const payload: Record<string, any> = {
      fecha: formMov.fecha,
      humedad: num(formMov.humedad),
      precio_unitario: num(formMov.precio_unitario),
      flete: num(formMov.flete) ?? 0,
      secado: num(formMov.secado) ?? 0,
      paritaria: num(formMov.paritaria) ?? 0,
      otros_gastos: num(formMov.otros_gastos) ?? 0,
      descripcion_movimiento: formMov.descripcion_movimiento.trim() || null,
      observaciones: formMov.observaciones.trim() || null,
    }
    if (!bloqueoTn && tn !== null) {
      payload.toneladas = editMov.tipo === 'ajuste' ? tn : Math.abs(tn)
    }

    setSaving(true)
    const { data, error: errUpd } = await supabase.from('movimientos_cereal').update(payload).eq('id', editMov.id).select('id')
    setSaving(false)
    if (errUpd) { setError(errUpd.message); return }
    if (!data || data.length === 0) { setError('No se pudo guardar: solo podés editar movimientos que cargaste vos (o ser administrador).'); return }
    cerrarEditarMov()
    router.refresh()
  }

  async function guardarContrato() {
    if (!vinculando) return
    setSaving(true)
    setError(null)

    const { error } = await supabase
      .from('movimientos_cereal')
      .update({ contrato_id: contratoSel || null })
      .eq('id', vinculando.id)

    if (error) { setError(error.message); setSaving(false); return }

    const contratoData = contratos.find(c => c.id === contratoSel)
    setVentas(prev => prev.map(v =>
      v.id === vinculando.id
        ? {
            ...v,
            contrato_id: contratoSel || null,
            contrato: contratoData?.numero ?? null,
            cliente: (contratoData?.clientes as any)?.razon_social ?? null,
          }
        : v
    ))
    setSaving(false)
    cerrarModalContrato()
  }

  return (
    <>
      <div className="space-y-4">
        <div className="card p-4 space-y-2">
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por fecha, CTG, cultivo, campaña, cliente, contrato..."
            className="input-field"
          />
          <div>
            <label className="block text-xs font-medium text-campo-600 mb-1">Campañas</label>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setCampaniasSel([])}
                className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${campaniasSel.length === 0 ? 'bg-emerald-700 border-emerald-700 text-white' : 'bg-white border-campo-200 text-campo-700 hover:bg-campo-50'}`}>
                Todas
              </button>
              {campaniasDisponibles.map(c => (
                <button key={c} type="button" onClick={() => toggleCampania(c)}
                  className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${campaniasSel.includes(c) ? 'bg-emerald-700 border-emerald-700 text-white' : 'bg-white border-campo-200 text-campo-700 hover:bg-campo-50'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          {errorEliminar && <p className="text-red-500 text-sm">❌ {errorEliminar}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          {VISTAS.map(v => (
            <button key={v.id} type="button" onClick={() => setVista(v.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${vista === v.id ? 'bg-campo-600 text-white border-campo-600' : 'bg-white text-campo-700 border-campo-200 hover:bg-campo-50'}`}>
              {v.label} <span className={`ml-1 text-xs ${vista === v.id ? 'text-white/80' : 'text-campo-400'}`}>({conteos[v.id]})</span>
            </button>
          ))}
        </div>

        {vista === 'ventas' || vista === 'compras' ? (

        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-campo-100 bg-campo-50">
                  <th className="text-left px-4 py-3 font-semibold text-campo-700">Tipo</th>
                  <th className="text-left px-4 py-3 font-semibold text-campo-700">Fecha</th>
                  <th className="text-left px-4 py-3 font-semibold text-campo-700">CTG</th>
                  <th className="text-left px-4 py-3 font-semibold text-campo-700">Cultivo</th>
                  <th className="text-left px-4 py-3 font-semibold text-campo-700">Variedad</th>
                  <th className="text-left px-4 py-3 font-semibold text-campo-700">Campaña</th>
                  <th className="text-right px-4 py-3 font-semibold text-campo-700">Toneladas</th>
                  <th className="text-left px-4 py-3 font-semibold text-campo-700">Cliente</th>
                  <th className="text-left px-4 py-3 font-semibold text-campo-700">Contrato</th>
                  <th className="text-right px-4 py-3 font-semibold text-campo-700">Precio Base</th>
                  <th className="text-right px-4 py-3 font-semibold text-campo-700">Plus</th>
                  <th className="text-right px-4 py-3 font-semibold text-campo-700">Bonificación</th>
                  <th className="text-right px-4 py-3 font-semibold text-campo-700">Comisión/tn</th>
                  <th className="text-right px-4 py-3 font-semibold text-campo-700">Flete/tn</th>
                  <th className="text-right px-4 py-3 font-semibold text-campo-700">Total/tn</th>
                  <th className="text-right px-4 py-3 font-semibold text-campo-700">Total USD</th>
                  <th className="text-left px-4 py-3 font-semibold text-campo-700">Descripción</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((e, i) => (
                  <tr key={i} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${e.tipo === 'compra' ? 'bg-blue-100 text-blue-700' : 'bg-campo-100 text-campo-700'}`}>
                        {e.tipo === 'compra' ? 'Compra' : 'Venta'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-campo-600">{e.fecha ? new Date(e.fecha).toLocaleDateString('es-AR') : '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-campo-500">{e.ctg ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-campo-900">{e.cultivo ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-emerald-700">{e.variedad ?? <span className="text-campo-300">—</span>}</td>
                    <td className="px-4 py-3 text-campo-600">{e.campania ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-campo-800">{fmt(Number(e.toneladas ?? 0))}</td>
                    <td className="px-4 py-3 text-campo-700">{e.cliente ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-campo-500">{e.contrato ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-campo-700">{e.precio_base ? `USD ${fmtUSD(e.precio_base)}` : '—'}</td>
                    <td className="px-4 py-3 text-right text-campo-700">{e.precio_plus ? `USD ${fmtUSD(e.precio_plus)}` : '—'}</td>
                    <td className="px-4 py-3 text-right text-campo-700">
                      {e.bonificacion
                        ? <span>USD {fmtUSD(e.bonif_usd)} <span className="text-xs text-campo-400">({e.bonificacion}%)</span></span>
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-red-500">{e.comision_tn ? `USD ${fmtUSD(e.comision_tn)}` : '—'}</td>
                    <td className="px-4 py-3 text-right text-red-500">{e.tarifa_flete ? `USD ${fmtUSD(e.tarifa_flete)}` : '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-campo-800">{e.total_tn ? `USD ${fmtUSD(e.total_tn)}` : '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-campo-900">{e.total_usd ? `USD ${fmtUSD(e.total_usd)}` : '—'}</td>
                    <td className="px-4 py-3 text-xs text-campo-400">{e.descripcion_movimiento || e.observaciones || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => abrirEditarMov(e)} className="text-xs text-emerald-700 hover:text-emerald-900 underline">
                          editar
                        </button>
                        <button onClick={() => abrirModalContrato(e)} className="text-xs text-campo-500 hover:text-campo-700 underline">
                          contrato
                        </button>
                        <button onClick={() => abrirModalBonif(e)} className="text-xs text-campo-500 hover:text-campo-700 underline">
                          bonif.
                        </button>
                        <button onClick={() => eliminarMovimiento(e)} disabled={eliminandoId === e.id}
                          className="text-xs text-red-500 hover:text-red-700 underline disabled:opacity-50">
                          {eliminandoId === e.id ? 'borrando...' : 'eliminar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtradas.length === 0 && (
                  <tr><td colSpan={18} className="px-4 py-10 text-center text-campo-400">Sin movimientos registrados</td></tr>
                )}
              </tbody>
              {filtradas.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-campo-200 bg-campo-50">
                    <td colSpan={6} className="px-4 py-3 font-bold text-campo-800 text-sm">Total</td>
                    <td className="px-4 py-3 text-right font-bold text-campo-800">{fmt(totalTon)}</td>
                    <td colSpan={8} />
                    <td className="px-4 py-3 text-right font-bold text-campo-900">
                      <div>Ventas: USD {fmtUSD(totalVentasUSD)}</div>
                      {comprasFiltradas.length > 0 && <div className="text-blue-700">Compras: USD {fmtUSD(totalComprasUSD)}</div>}
                    </td>
                    <td />
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
        ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-campo-100 bg-campo-50">
                  <th className="text-left px-4 py-3 font-semibold text-campo-700">Tipo</th>
                  <th className="text-left px-4 py-3 font-semibold text-campo-700">Fecha</th>
                  <th className="text-left px-4 py-3 font-semibold text-campo-700">Cultivo</th>
                  <th className="text-left px-4 py-3 font-semibold text-campo-700">Variedad</th>
                  <th className="text-left px-4 py-3 font-semibold text-campo-700">Campaña</th>
                  <th className="text-right px-4 py-3 font-semibold text-campo-700">Toneladas</th>
                  <th className="text-left px-4 py-3 font-semibold text-campo-700">Lote</th>
                  <th className="text-left px-4 py-3 font-semibold text-campo-700">Cliente</th>
                  <th className="text-left px-4 py-3 font-semibold text-campo-700">Comentario</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map(e => {
                  const tn = toneladasConSigno(e)
                  const comentario = [e.descripcion_movimiento, e.observaciones].filter(Boolean).join(' — ')
                  return (
                    <tr key={e.id} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${claseTipo(e.tipo)}`}>
                          {ETIQUETA_TIPO[e.tipo] ?? e.tipo}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-campo-600">{e.fecha ? new Date(e.fecha).toLocaleDateString('es-AR') : '—'}</td>
                      <td className="px-4 py-3 font-medium text-campo-900">{e.cultivo ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-emerald-700">{e.variedad ?? <span className="text-campo-300">—</span>}</td>
                      <td className="px-4 py-3 text-campo-600">{e.campania ?? '—'}</td>
                      <td className={`px-4 py-3 text-right font-medium ${tn < 0 ? 'text-red-600' : 'text-campo-800'}`}>
                        {tn > 0 ? '+' : ''}{fmt(tn)}
                      </td>
                      <td className="px-4 py-3 text-campo-600">{e.lote ?? '—'}</td>
                      <td className="px-4 py-3 text-campo-700">{e.cliente ?? '—'}</td>
                      <td className="px-4 py-3 text-campo-700 max-w-md">{comentario || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => abrirEditarMov(e)} className="text-xs text-emerald-700 hover:text-emerald-900 underline">
                            editar
                          </button>
                          {e.tipo !== 'cosecha' && (
                            <button onClick={() => eliminarMovimiento(e)} disabled={eliminandoId === e.id}
                              className="text-xs text-red-500 hover:text-red-700 underline disabled:opacity-50">
                              {eliminandoId === e.id ? 'borrando...' : 'eliminar'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filtradas.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-10 text-center text-campo-400">Sin movimientos registrados</td></tr>
                )}
              </tbody>
              {filtradas.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-campo-200 bg-campo-50">
                    <td colSpan={5} className="px-4 py-3 font-bold text-campo-800 text-sm">Variación neta de stock</td>
                    <td className={`px-4 py-3 text-right font-bold ${variacionNeta < 0 ? 'text-red-600' : 'text-campo-800'}`}>
                      {variacionNeta > 0 ? '+' : ''}{fmt(variacionNeta)}
                    </td>
                    <td colSpan={4} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
        )}
      </div>

      {/* Modal bonificación */}
      {editando && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-bold text-campo-900 mb-1">Cargar bonificación</h2>
            <p className="text-sm text-campo-500 mb-1">{editando.ctg ? `CTG ${editando.ctg}` : `Movimiento #${editando.id}`}</p>
            <p className="text-xs text-campo-400 mb-4">{editando.cultivo} — {editando.campania} — {fmt(Number(editando.toneladas))} tn</p>
            <label className="block text-sm font-medium text-campo-700 mb-1">% Bonificación</label>
            <input
              type="number"
              step="0.01"
              value={bonifInput}
              onChange={e => setBonifInput(e.target.value)}
              placeholder="2.00"
              className="input-field mb-1"
              autoFocus
            />
            {bonifInput && (
              <p className="text-xs text-campo-500 mb-4">
                USD {fmtUSD(Number(editando.precio_base ?? 0) * parseFloat(bonifInput) / 100)} por tonelada
              </p>
            )}
            {error && <p className="text-red-500 text-sm mb-3">❌ {error}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={cerrarModalBonif} className="btn-secondary">Cancelar</button>
              <button onClick={guardarBonificacion} disabled={saving} className="btn-primary">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar movimiento */}
      {editMov && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto py-6">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-2xl mx-4">
            <h2 className="text-lg font-bold text-campo-900 mb-1">Editar movimiento</h2>
            <p className="text-xs text-campo-400 mb-4">
              {ETIQUETA_TIPO[editMov.tipo] ?? editMov.tipo} — {editMov.cultivo} — {editMov.campania}{editMov.ctg ? ` — CTG ${editMov.ctg}` : ''}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-campo-600 mb-1">Fecha *</label>
                <input type="date" value={formMov.fecha} onChange={e => setFormMov(f => ({ ...f, fecha: e.target.value }))} className="input-field" />
              </div>
              <div>
                <label className="block text-xs font-medium text-campo-600 mb-1">Toneladas</label>
                <input type="number" step="0.001" value={formMov.toneladas} disabled={!!bloqueoTn}
                  onChange={e => setFormMov(f => ({ ...f, toneladas: e.target.value }))} className="input-field disabled:bg-campo-50 disabled:text-campo-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-campo-600 mb-1">Humedad %</label>
                <input type="number" step="0.01" value={formMov.humedad} onChange={e => setFormMov(f => ({ ...f, humedad: e.target.value }))} className="input-field" />
              </div>
              {bloqueoTn && <p className="sm:col-span-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{bloqueoTn}</p>}
              <div>
                <label className="block text-xs font-medium text-campo-600 mb-1">Precio del movimiento (USD/tn)</label>
                <input type="number" step="0.01" value={formMov.precio_unitario} onChange={e => setFormMov(f => ({ ...f, precio_unitario: e.target.value }))} className="input-field" />
              </div>
              <div>
                <label className="block text-xs font-medium text-campo-600 mb-1">Flete (USD total)</label>
                <input type="number" step="0.01" min="0" value={formMov.flete} onChange={e => setFormMov(f => ({ ...f, flete: e.target.value }))} className="input-field" />
              </div>
              <div>
                <label className="block text-xs font-medium text-campo-600 mb-1">Secado (USD total)</label>
                <input type="number" step="0.01" min="0" value={formMov.secado} onChange={e => setFormMov(f => ({ ...f, secado: e.target.value }))} className="input-field" />
              </div>
              <div>
                <label className="block text-xs font-medium text-campo-600 mb-1">Paritaria (USD total)</label>
                <input type="number" step="0.01" min="0" value={formMov.paritaria} onChange={e => setFormMov(f => ({ ...f, paritaria: e.target.value }))} className="input-field" />
              </div>
              <div>
                <label className="block text-xs font-medium text-campo-600 mb-1">Otros gastos (USD total)</label>
                <input type="number" step="0.01" min="0" value={formMov.otros_gastos} onChange={e => setFormMov(f => ({ ...f, otros_gastos: e.target.value }))} className="input-field" />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-campo-600 mb-1">Descripción</label>
                <input value={formMov.descripcion_movimiento} onChange={e => setFormMov(f => ({ ...f, descripcion_movimiento: e.target.value }))} className="input-field" />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-campo-600 mb-1">Observaciones</label>
                <input value={formMov.observaciones} onChange={e => setFormMov(f => ({ ...f, observaciones: e.target.value }))} className="input-field" />
              </div>
            </div>
            <p className="text-xs text-campo-400 mt-3">
              Los gastos son montos totales de la operación (no por tonelada). El resultado neto se recalcula solo: toneladas × precio − gastos.
            </p>
            {error && <p className="text-red-500 text-sm mt-3">❌ {error}</p>}
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={cerrarEditarMov} className="btn-secondary">Cancelar</button>
              <button onClick={guardarEdicionMov} disabled={saving} className="btn-primary">
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal contrato */}
      {vinculando && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-bold text-campo-900 mb-1">Vincular contrato</h2>
            <p className="text-xs text-campo-400 mb-4">{vinculando.cultivo} — {vinculando.campania} — {fmt(Number(vinculando.toneladas))} tn</p>
            <label className="block text-sm font-medium text-campo-700 mb-1">Contrato</label>
            <select value={contratoSel} onChange={e => setContratoSel(e.target.value)} className="input-field mb-4">
              <option value="">Sin contrato</option>
              {contratos.map(c => (
                <option key={c.id} value={c.id}>#{c.numero} — {(c.clientes as any)?.razon_social}</option>
              ))}
            </select>
            {error && <p className="text-red-500 text-sm mb-3">❌ {error}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={cerrarModalContrato} className="btn-secondary">Cancelar</button>
              <button onClick={guardarContrato} disabled={saving} className="btn-primary">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
