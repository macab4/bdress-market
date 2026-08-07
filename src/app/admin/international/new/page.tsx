import { requireAdminUser } from '@/lib/admin-auth'
import AdminNav from '@/components/admin/AdminNav'
import InternationalListingForm from '@/components/admin/InternationalListingForm'

export default async function NewInternationalListingPage() {
  await requireAdminUser()

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div>
          <h1 className="text-xl font-light tracking-widest uppercase mb-6">Panel de administración</h1>
          <AdminNav active="/admin/international" />
        </div>
        <h2 className="text-[10px] tracking-widest uppercase text-gray-400 mb-6">Nuevo producto internacional</h2>
        <InternationalListingForm />
      </div>
    </div>
  )
}
