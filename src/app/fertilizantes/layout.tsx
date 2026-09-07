import { requireAuth } from '@/lib/auth'
import SidebarFertilizantes from '@/components/layout/SidebarFertilizantes'
import TopBar from '@/components/layout/TopBar'

export default async function FertilizantesLayout({ children }: { children: React.ReactNode }) {
  const { perfil } = await requireAuth()
  return (
    <div className="flex h-screen bg-campo-50 overflow-hidden">
      <SidebarFertilizantes perfil={perfil} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar perfil={perfil} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
