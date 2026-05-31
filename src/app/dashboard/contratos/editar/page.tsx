import { Suspense } from 'react'
import EditarContratoForm from './editarContratoForm'

export default function EditarContratoPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-40 text-campo-400">Cargando...</div>}>
      <EditarContratoForm />
    </Suspense>
  )
}
