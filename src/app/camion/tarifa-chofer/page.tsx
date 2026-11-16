import { redirect } from 'next/navigation'

// La tarifa del chofer se carga por viaje (columna "Chofer USD/tn" de Viajes); ya no hay tarifa genérica.
export default function TarifaChoferRedirect() {
  redirect('/camion/viajes')
}
