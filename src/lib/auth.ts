import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Perfil } from '@/types'

export async function requireAuth(): Promise<{ userId: string; perfil: Perfil }> {
  const supabase = createClient()
  
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/auth/login')
  }

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('*')
    .eq('id', session.user.id)
    .single()

  if (!perfil) {
    // Si no hay perfil, crearlo automáticamente
    const { data: nuevoPerfil } = await supabase
      .from('perfiles')
      .insert({
        id: session.user.id,
        nombre: 'Usuario',
        apellido: '',
        email: session.user.email!,
        rol: 'operario'
      })
      .select()
      .single()

    if (!nuevoPerfil) redirect('/auth/login')
    return { userId: session.user.id, perfil: nuevoPerfil }
  }

  return { userId: session.user.id, perfil }
}

export async function requireAdmin(): Promise<{ userId: string; perfil: Perfil }> {
  const { userId, perfil } = await requireAuth()
  if (perfil.rol !== 'admin') redirect('/dashboard')
  return { userId, perfil }
}

export async function requireComercial(): Promise<{ userId: string; perfil: Perfil }> {
  const { userId, perfil } = await requireAuth()
  if (!['admin', 'comercial'].includes(perfil.rol)) redirect('/dashboard')
  return { userId, perfil }
}
