import { requireAuth } from '@/lib/auth'
import SidebarCamion from '@/components/layout/SidebarCamion'
import TopBar from '@/components/layout/TopBar'

export default async function CamionLayout({ children }: { children: React.ReactNode }) {
  const { perfil } = await requireAuth()
  return (
    <div className="flex h-screen bg-campo-50 overflow-hidden">
      <SidebarCamion perfil={perfil} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar perfil={perfil} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
