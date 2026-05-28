import { createClient } from '@/lib/supabase/server'
import StockResumen from '@/components/charts/StockResumen'
import KPICard from '@/components/ui/KPICard'

export default async function DashboardPage() {
  const supabase = createClient()

  const [{ data: stock }, { data: contratos }] = await Promise.all([
    supabase.from('vw_stock_actual').select('*'),
    supabase.from('vw_posicion_contratos').select('*').eq('estado', 'activo'),
  ])

  const totalFisico = stock?.reduce((s, r) => s + Number(r.stock_fisico), 0) ?? 0
  const totalDisponible = stock?.reduce((s, r) => s + Number(r.stock_disponible), 0) ?? 0
  const totalVendido = stock?.reduce((s, r) => s + Number(r.ton_vendidas), 0) ?? 0
  const contratosActivos = contratos?.length ?? 0
  const tonPendientes = contratos?.reduce((s, r) => s + Number(r.toneladas_pendientes), 0) ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-campo-900">Dashboard Comercial</h1>
        <p className="text-campo-500 text-sm mt-0.5">Campaña activa · Posición consolidada</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard titulo="Stock Físico" valor={`${totalFisico.toLocaleString('es-AR', { maximumFractionDigits: 0 })} tn`} descripcion="Total en acopios" color="verde" icono="warehouse" />
        <KPICard titulo="Disponible" valor={`${totalDisponible.toLocaleString('es-AR', { maximumFractionDigits: 0 })} tn`} descripcion="Sin comprometer" color="trigo" icono="check" />
        <KPICard titulo="Vendido" valor={`${totalVendido.toLocaleString('es-AR', { maximumFractionDigits: 0 })} tn`} descripcion="Total contratos" color="azul" icono="handshake" />
        <KPICard titulo="Contratos Activos" valor={`${contratosActivos}`} descripcion={`${tonPendientes.toLocaleString('es-AR', { maximumFractionDigits: 0 })} tn pendientes`} color="naranja" icono="document" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold text-campo-800 mb-4">Stock por Cultivo</h2>
          <StockResumen data={stock ?? []} />
        </div>
        <div className="card">
          <h2 className="font-semibold text-campo-800 mb-4">Posición Comercial</h2>
          <div className="space-y-3">
            {stock?.map(r => (
              <div key={r.cultivo} className="flex items-center gap-3">
                <div className="w-20 text-xs font-medium text-campo-700">{r.cultivo}</div>
                <div className="flex-1 bg-campo-100 rounded-full h-3 overflow-hidden">
                  <div className="h-full bg-campo-500 rounded-full transition-all" style={{ width: `${Math.min((Number(r.ton_vendidas) / Math.max(Number(r.ton_cosechadas), 1)) * 100, 100)}%` }} />
                </div>
                <div className="text-xs text-campo-500 w-12 text-right">
                  {r.ton_cosechadas > 0 ? `${Math.round((Number(r.ton_vendidas) / Number(r.ton_cosechadas)) * 100)}%` : '—'}
                </div>
              </div>
            ))}
            {(!stock || stock.length === 0) && (
              <p className="text-sm text-campo-400 py-4 text-center">Sin datos de campaña activa</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
