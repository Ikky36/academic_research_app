'use server';

import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export async function requestPasswordReset(formData: FormData) {
  const email = formData.get('email') as string;
  const origin = (await headers()).get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  if (!email) {
    return { error: 'Email diperlukan' };
  }

  const supabase = await createClient();

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/update-password`,
    });

    if (error) {
      console.error('Reset password error:', error);
      let errMsg = error.message;
      if (!errMsg || errMsg === '{}') {
        errMsg = 'Gagal mengirim email reset. Periksa kembali pengaturan SMTP atau tunggu beberapa saat.';
      }
      return { error: errMsg };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Reset password exception:', err);
    let errMsg = err.message || 'Terjadi kesalahan internal.';
    if (errMsg === '{}') errMsg = 'Gagal mengirim email reset (Kesalahan Internal).';
    return { error: errMsg };
  }
}
