import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  const supabase = await createClient()

  const cookieStore = await cookies()
  cookieStore.delete('impersonator_admin_email')

  const { error } = await supabase.auth.signOut()

  if (error) {
    return redirect('/error')
  }

  revalidatePath('/', 'layout')
  redirect('/login')
}
