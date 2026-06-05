import { requireAuth } from '@/lib/auth'
import SidebarAgroquimicos from '@/components/layout/SidebarAgroquimicos'
import TopBar from '@/components/layout/TopBar'

export default async function AgroquimicosLayout({ children }: { children: React.ReactNode }) {
  const { perfil } = await requireAuth()
  return (
    <div className="flex h-screen bg-campo-50 overflow-hidden">
      <SidebarAgroquimicos perfil={perfil} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar perfil={perfil} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
