'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function CartasPorteClient({ cartas, contratos }: { cartas: any[], contratos: any[] }) {
  const supabase = createClient()
  const router = useRouter()
  const [lista, setLista] = useState(cartas)
  const [vinculando, setVinculando] = useState<any | null>(null)
  const [contratoSel, setContratoSel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function abrirModal(carta: any) {
    setVinculando(carta)
    setContratoSel(carta.contrato_id ?? '')
    setError(null)
  }

  function cerrarModal() {
    setVinculando(null)
    setContratoSel('')
    setError(null)
  }

  async function guardar() {
    if (!vinculando) return
    setSaving(true)
    setError(null)
    const { error } = await supabase
      .from('cartas_porte')
      .update({ contrato_id: contratoSel || null })
      .eq('id', vinculando.id)
    if (error) { setError(error.message); setSaving(false); return }
    const contratoNumero = contratos.find(c => c.id === contratoSel)?.numero ?? null
    setLista(prev => prev.map(c =>
      c.id === vinculando.id
        ? { ...c, contrato_id: contratoSel || null, contratos: contratoNumero ? { numero: contratoNumero } : null }
        : c
    ))
    setSaving(false)
    cerrarModal()
  }


  async function borrar(carta: any) {
    if (!confirm(`¿Borrar la CPE ${carta.numero_cpe} y su movimiento de stock? Esta acción no se puede deshacer.`)) return
    // Primero borramos el movimiento de cereal vinculado
    const { error: errorMov } = await supabase
      .from('movimientos_cereal')
      .delete()
      .eq('carta_porte_id', carta.id)
    if (errorMov) { alert('Error al borrar el movimiento de stock: ' + errorMov.message); return }
    // Después borramos la carta de porte
    const { error } = await supabase.from('cartas_porte').delete().eq('id', carta.id)
    if (error) { alert('Error al borrar la carta: ' + error.message); return }
    setLista(prev => prev.filter(c => c.id !== carta.id))
  }

  function descargarExcel() {
    const sep = ';'
    const headers = [
      'N° CPE', 'CTG', 'Fecha Emisión', 'Fecha Vencimiento',
      'Campaña', 'Cultivo', 'Contrato',
      // A - Intervinientes
      'CUIT Titular',
      'Remitente Comercial', 'CUIT Remitente',
      'Remitente Venta Secundaria', 'CUIT Rte. Secundaria',
      'Corredor Venta Primaria', 'CUIT Corredor Primaria',
      'Corredor Venta Secundaria', 'CUIT Corredor Secundaria',
      'Representante Entregador', 'CUIT Rep. Entregador',
      'Representante Recibidor', 'CUIT Rep. Recibidor',
      'Destinatario', 'CUIT Destinatario',
      'Destino', 'CUIT Destino',
      'Empresa Transportista', 'CUIT Transportista',
      'Flete Pagador',
      'Chofer', 'CUIL Chofer',
      // B - Grano
      'Declaración Calidad',
      'Peso Bruto Origen (kg)', 'Peso Tara Origen (kg)', 'Toneladas Origen',
      'Humedad Origen (%)', 'Proteína (%)', 'Gluten (%)', 'Peso Hectolítrico', 'Zaranda (%)',
      // C - Procedencia
      'Procedencia Localidad', 'Procedencia Provincia',
      'RENSPA', 'Descripción Campo', 'Latitud', 'Longitud',
      // D - Destino
      'Destino Localidad', 'Destino Provincia', 'N° Planta', 'Dirección Destino',
      // E - Transporte
      'Patente Camión', 'Patente Acoplado',
      'Fecha Partida', 'Hora Partida', 'Km a Recorrer', 'Tarifa Flete',
      // G - Descarga
      'Fecha Arribo', 'Fecha Descarga', 'N° Turno',
      'Peso Bruto Destino (kg)', 'Peso Tara Destino (kg)', 'Toneladas Netas',
      'Humedad Destino (%)', 'Bonificación Calidad (%)', 'Merma Humedad',
    ]

    const rows = lista.map(c => [
      c.numero_cpe ?? '',
      c.ctg ?? '',
      c.fecha_emision ? new Date(c.fecha_emision).toLocaleDateString('es-AR') : '',
      c.numero_cpe_vencimiento ? new Date(c.numero_cpe_vencimiento).toLocaleDateString('es-AR') : '',
      c.campanias?.nombre ?? '',
      c.cultivos?.nombre ?? '',
      c.contratos?.numero ?? '',
      // A
      c.cuit_titular ?? '',
      c.remitente_comercial ?? '',
      c.cuit_remitente ?? '',
      c.remitente_venta_secundaria ?? '',
      c.cuit_rte_secundaria ?? '',
      c.corredor_venta_primaria ?? '',
      c.cuit_corredor_primaria ?? '',
      c.corredor_venta_secundaria ?? '',
      c.cuit_corredor_secundaria ?? '',
      c.representante_entregador ?? '',
      c.cuit_rep_entregador ?? '',
      c.representante_recibidor ?? '',
      c.cuit_rep_recibidor ?? '',
      c.destinatario ?? '',
      c.cuit_destinatario ?? '',
      c.destino_nombre ?? '',
      c.cuit_destino ?? '',
      c.empresa_transportista ?? '',
      c.cuit_transportista ?? '',
      c.flete_pagador ?? '',
      c.chofer_nombre ?? '',
      c.chofer_cuil ?? '',
      // B
      c.declaracion_calidad ?? '',
      c.peso_bruto_kg ?? '',
      c.peso_tara_kg ?? '',
      c.toneladas_origen ?? '',
      c.humedad_origen ?? '',
      c.proteina ?? '',
      c.gluten ?? '',
      c.peso_hectolitrico ?? '',
      c.zaranda ?? '',
      // C
      c.procedencia_localidad ?? '',
      c.procedencia_provincia ?? '',
      c.renspa ?? '',
      c.descripcion_campo ?? '',
      c.latitud ?? '',
      c.longitud ?? '',
      // D
      c.destino_localidad ?? '',
      c.destino_provincia ?? '',
      c.nro_planta ?? '',
      c.destino_direccion ?? '',
      // E
      c.patente_camion ?? '',
      c.patente_acoplado ?? '',
      c.fecha_partida ? new Date(c.fecha_partida).toLocaleDateString('es-AR') : '',
      c.hora_partida ?? '',
      c.km_recorrer ?? '',
      c.tarifa_flete ?? '',
      // G
      c.fecha_arribo ? new Date(c.fecha_arribo).toLocaleDateString('es-AR') : '',
      c.fecha_descarga ? new Date(c.fecha_descarga).toLocaleDateString('es-AR') : '',
      c.nro_turno ?? '',
      c.peso_bruto_destino ?? '',
      c.peso_tara_destino ?? '',
      c.toneladas_netas ?? '',
      c.humedad_destino ?? '',
      c.bonificacion_calidad ?? '',
      c.merma_humedad ?? '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`))

    const csv = [headers.map(h => `"${h}"`), ...rows].map(r => r.join(sep)).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cartas-porte-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="flex justify-end mb-2">
        <button onClick={descargarExcel} className="btn-secondary">⬇ Descargar Excel</button>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-campo-100 bg-campo-50">
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Nº CPE</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">CTG</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Fecha</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Cultivo</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Campaña</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Tn Netas</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Destinatario</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Destino</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Contrato</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {lista.map(c => (
                <tr key={c.id} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-campo-600">{c.numero_cpe}</td>
                  <td className="px-4 py-3 font-mono text-xs text-campo-500">{c.ctg ?? '—'}</td>
                  <td className="px-4 py-3 text-campo-600">{new Date(c.fecha_emision).toLocaleDateString('es-AR')}</td>
                  <td className="px-4 py-3 font-medium text-campo-900">{c.cultivos?.nombre}</td>
                  <td className="px-4 py-3 text-campo-600">{c.campanias?.nombre}</td>
                  <td className="px-4 py-3 text-right font-medium text-campo-800">
                    {c.toneladas_netas ? Number(c.toneladas_netas).toLocaleString('es-AR', { minimumFractionDigits: 3 }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-campo-700 text-xs">{c.destinatario ?? '—'}</td>
                  <td className="px-4 py-3 text-campo-600 text-xs">{c.destino_localidad ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-campo-500">
                    <button onClick={() => abrirModal(c)} className="hover:text-campo-700">
                      {c.contratos?.numero ?? '—'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button
                        onClick={() => router.push(`/dashboard/cartas-porte/editar?numero_cpe=${c.numero_cpe}`)}
                        className="text-xs text-campo-500 hover:text-campo-700 underline"
                      >
                        editar
                      </button>
                      <button
                        onClick={() => borrar(c)}
                        className="text-xs text-red-400 hover:text-red-600 underline"
                      >
                        borrar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {lista.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-campo-400">
                    No hay cartas de porte registradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {vinculando && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold text-campo-900 mb-1">Vincular contrato</h2>
            <p className="text-sm text-campo-500 mb-4">CPE {vinculando.numero_cpe}</p>
            <label className="block text-sm font-medium text-campo-700 mb-1">Contrato</label>
            <select value={contratoSel} onChange={e => setContratoSel(e.target.value)} className="input-field mb-4">
              <option value="">Sin contrato</option>
              {contratos.map(c => (
                <option key={c.id} value={c.id}>#{c.numero}</option>
              ))}
            </select>
            {error && <p className="text-red-500 text-sm mb-3">❌ {error}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={cerrarModal} className="btn-secondary">Cancelar</button>
              <button onClick={guardar} disabled={saving} className="btn-primary">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}