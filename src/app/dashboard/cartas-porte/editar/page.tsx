import { Suspense } from 'react'
import EditarCartaPorteForm from './EditarCartaPorteForm'

export default function EditarCartaPortePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-40 text-campo-400">Cargando...</div>}>
      <EditarCartaPorteForm />
    </Suspense>
  )
}