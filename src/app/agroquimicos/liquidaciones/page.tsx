import LiquidacionesAplicadores from '@/components/agroquimicos/LiquidacionesAplicadores'

export default function LiquidacionesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-campo-900">Liquidaciones a aplicadores</h1>
        <p className="text-campo-500 text-sm mt-0.5">Período trabajado por cada aplicador, hectáreas facturadas y pagos</p>
      </div>
      <LiquidacionesAplicadores />
    </div>
  )
}
