import { createClient } from '@/lib/supabase/server'
import ReportesClient from './ReportesClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ReportesPage() {
  const supabase = createClient()
  const { data: resultados } = await supabase
    .from('vw_resultado_comercial')
    .select('*')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-campo-900">Reportes</h1>
        <p className="text-campo-500 text-sm mt-0.5">Resultado comercial por campaña, cultivo y cliente</p>
      </div>
      <ReportesClient resultados={resultados ?? []} />
    </div>
  )
}