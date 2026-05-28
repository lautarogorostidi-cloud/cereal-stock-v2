import { createClient } from '@/lib/supabase/server'

const estadoColor: Record<string, string> = {
  emitida:    'badge-trigo',
  en_transito:'badge-azul',
  descargada: 'badge-verde',
  anulada:    'badge-rojo',
}

export default async function CartasPortePage() {
  const supabase = createClient()
  const { data: cartas } = await supabase
    .from('cartas_porte')
    .select(`*, campanias(nombre), cultivos(nombre), contratos(numero)`)
    .order('fecha_emision', { ascending: false })
    .limit(100)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Cartas de Porte</h1>
          <p className="text-campo-500 text-sm mt-0.5">Trazabilidad y seguimiento de granos (CPE)</p>
        </div>
        <a href="/dashboard/cartas-porte/nueva" className="btn-primary">+ Nueva carta de porte</a>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-campo-100 bg-campo-50">
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Nº CPE</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Fecha</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Cultivo</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Campaña</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Tn Origen</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Humedad</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Tn Netas</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Contrato</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Estado</th>
              </tr>
            </thead>
            <tbody>
              {cartas?.map(c => (
                <tr key={c.id} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-campo-600">{c.numero_cpe}</td>
                  <td className="px-4 py-3 text-campo-600">{new Date(c.fecha_emision).toLocaleDateString('es-AR')}</td>
                  <td className="px-4 py-3 font-medium text-campo-900">{(c.cultivos as any)?.nombre}</td>
                  <td className="px-4 py-3 text-campo-600">{(c.campanias as any)?.nombre}</td>
                  <td className="px-4 py-3 text-right">{Number(c.toneladas_origen).toLocaleString('es-AR', { minimumFractionDigits: 3 })}</td>
                  <td className="px-4 py-3 text-right text-campo-500">{c.humedad_origen ? `${c.humedad_origen}%` : '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-campo-800">
                    {c.toneladas_netas ? Number(c.toneladas_netas).toLocaleString('es-AR', { minimumFractionDigits: 3 }) : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-campo-500">{(c.contratos as any)?.numero ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={estadoColor[c.estado] ?? 'badge-gris'}>{c.estado.replace('_', ' ')}</span>
                  </td>
                </tr>
              ))}
              {(!cartas || cartas.length === 0) && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-campo-400">
                    No hay cartas de porte registradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
