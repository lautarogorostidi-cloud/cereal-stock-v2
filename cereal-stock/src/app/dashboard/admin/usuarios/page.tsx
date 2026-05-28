import { createClient } from '@/lib/supabase/server'

export default async function UsuariosPage() {
  const supabase = createClient()
  const { data: usuarios } = await supabase.from('perfiles').select('*').order('nombre')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-campo-900">Usuarios</h1>
        <p className="text-campo-500 text-sm mt-0.5">Para agregar usuarios usá Supabase → Authentication → Add user</p>
      </div>
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-campo-100 bg-campo-50">
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Nombre</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Email</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Rol</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Estado</th>
              </tr>
            </thead>
            <tbody>
              {usuarios?.map(u => (
                <tr key={u.id} className="border-b border-campo-50 hover:bg-campo-50/50">
                  <td className="px-5 py-3 font-medium text-campo-900">{u.nombre} {u.apellido}</td>
                  <td className="px-5 py-3 text-campo-600">{u.email}</td>
                  <td className="px-5 py-3"><span className={u.rol === 'admin' ? 'badge-verde' : u.rol === 'comercial' ? 'badge-trigo' : 'badge-gris'}>{u.rol}</span></td>
                  <td className="px-5 py-3"><span className={u.activo ? 'badge-verde' : 'badge-rojo'}>{u.activo ? 'Activo' : 'Inactivo'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
