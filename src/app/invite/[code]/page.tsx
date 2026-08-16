import { redirect } from 'next/navigation'

// Link público de invitación (bdressmarket.cl/invite/CODIGO) — solo
// reenvía al registro con el código en la URL; handle_new_user (trigger en
// la base de datos) es quien realmente crea la relación de referido al
// leer options.data.referral_code que auth/register/page.tsx agrega al
// signUp. No valida el código acá — si no corresponde a nadie, el registro
// simplemente no queda vinculado a ningún referrer (se ignora en silencio,
// mismo comportamiento que un link mal copiado).
export default async function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  redirect(`/auth/register?ref=${encodeURIComponent(code)}`)
}
