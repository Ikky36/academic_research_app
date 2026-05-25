'use server'

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// Middleware-like check for admin
async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') throw new Error('Unauthorized');
  
  return supabase;
}

export async function getUsersAction() {
  try {
    const supabase = await requireAdmin();
    // In a real large app, add pagination
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, role, created_at')
      .order('created_at', { ascending: false });

    if (error) return { error: error.message };
    return { data };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function updateUserRoleAction(userId: string, newRole: string) {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (error) return { error: error.message };
    revalidatePath('/admin');
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function getTierLimitsAction() {
  try {
    const supabase = await requireAdmin();
    const { data, error } = await supabase
      .from('tier_limits')
      .select('*')
      .order('role');

    if (error) return { error: error.message };
    return { data };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function updateTierLimitAction(role: string, limits: any) {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase
      .from('tier_limits')
      .update({
        max_projects: parseInt(limits.max_projects),
        max_search_results: parseInt(limits.max_search_results),
        max_sota_rows: parseInt(limits.max_sota_rows),
        can_bulk_download_gdrive: limits.can_bulk_download_gdrive === 'true' || limits.can_bulk_download_gdrive === true
      })
      .eq('role', role);

    if (error) return { error: error.message };
    revalidatePath('/admin');
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function createAccountAction(email: string, role: string) {
  try {
    await requireAdmin();
    
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return { error: 'SUPABASE_SERVICE_ROLE_KEY tidak ditemukan di environment variables. Anda tidak bisa membuat akun secara manual lewat dasbor tanpa kunci ini.' };
    }

    // Use Service Role key to bypass RLS and create user safely
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
    const adminSupabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Create user in Auth
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email,
      password: 'Password123!', // Default password
      email_confirm: true // Auto confirm
    });

    if (authError) return { error: authError.message };

    // Update role
    if (role !== 'free') {
      await adminSupabase.from('profiles').update({ role }).eq('id', authData.user.id);
    }

    revalidatePath('/admin');
    return { success: true, message: `Akun ${email} berhasil dibuat dengan kata sandi default: Password123!` };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function deleteUserAction(userId: string) {
  try {
    await requireAdmin();
    
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return { error: 'SUPABASE_SERVICE_ROLE_KEY tidak ditemukan. Tidak dapat menghapus pengguna.' };
    }

    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
    const adminSupabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Hapus dari Auth Supabase (ini juga akan men-trigger CASCADE ke public.profiles jika ada, atau kita hapus profil dulu)
    const { error } = await adminSupabase.auth.admin.deleteUser(userId);
    if (error) return { error: error.message };

    revalidatePath('/admin');
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}
