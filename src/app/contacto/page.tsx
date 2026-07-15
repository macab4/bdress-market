import ContactForm from '@/components/ContactForm'

export default function ContactoPage() {
  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <p className="text-xs tracking-[6px] uppercase text-[#7fab87] mb-3">Bdress Market</p>
        <h1 className="text-2xl font-light tracking-widest uppercase mb-8">Contacto</h1>
        <ContactForm />
      </div>
    </div>
  )
}
