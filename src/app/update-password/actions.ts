'use server';

import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export async function updatePassword(formData: FormData) {
  const password = formData.get('password') as string;

  if (!password || password.length < 6) {
    return { error: 'Kata sandi harus terdiri dari minimal 6 karakter' };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password: password
  });

  if (error) {
    return { error: error.message };
  }

  redirect('/dashboard?message=Kata sandi berhasil diperbarui');
}
