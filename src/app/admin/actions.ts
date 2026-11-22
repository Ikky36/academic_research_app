'use server'

import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, role, created_at, credits')
      .order('created_at', { ascending: false });

    if (profilesError) return { error: profilesError.message };

    // Fetch auth users to get user_metadata
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    let mergedData = profiles || [];
    if (!authError && authUsers?.users) {
      mergedData = mergedData.map(p => {
        const authUser = authUsers.users.find((u: any) => u.id === p.id);
        return {
          ...p,
          can_use_byok: authUser?.user_metadata?.can_use_byok === true,
          paid_api_override: authUser?.user_metadata?.paid_api_override || null
        };
      });
    }

    return { data: mergedData };
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

export async function toggleByokAction(userId: string, currentStatus: boolean) {
  try {
    await requireAdmin();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { can_use_byok: !currentStatus }
    });

    if (error) return { error: error.message };
    revalidatePath('/admin');
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function overridePaidApiAction(userId: string, overrideValue: boolean | null) {
  try {
    await requireAdmin();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { paid_api_override: overrideValue }
    });

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
        max_kajian_tambahan: parseInt(limits.max_kajian_tambahan || 5),
        max_instrumen_referensi: parseInt(limits.max_instrumen_referensi || 2),
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

export async function getSyncedBooksAction() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: 'Unauthorized' };

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
  if (profile?.role !== 'admin') return { error: 'Forbidden' };

  const { data, error } = await supabase
    .from('methodology_books')
    .select(`
      id,
      title,
      author,
      publisher,
      year,
      source_type,
      journal_name,
      volume,
      issue,
      doi,
      methodology_chunks (
        id
      )
    `)
    .order('created_at', { ascending: false });

  if (error) return { error: error.message };
  return { data };
}

export async function getBookChunksAction(bookId: string) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: 'Unauthorized' };

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
  if (profile?.role !== 'admin') return { error: 'Forbidden' };

  const { data, error } = await supabase
    .from('methodology_chunks')
    .select('method_category, content, page_start, page_end')
    .eq('book_id', bookId)
    .order('page_start', { ascending: true });

  if (error) return { error: error.message };
  return { data };
}

export async function deleteSyncedBookAction(bookId: string) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: 'Unauthorized' };

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
  if (profile?.role !== 'admin') return { error: 'Forbidden' };

  const { error } = await supabase
    .from('methodology_books')
    .delete()
    .eq('id', bookId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function getErrorLogsAction() {
  try {
    const supabase = await requireAdmin();
    const { data, error } = await supabase
      .from('error_logs')
      .select(`
        id,
        user_id,
        feature,
        error_message,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) return { error: error.message };

    // Fetch emails from auth.users
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    let mergedData = data || [];
    if (!authError && authUsers?.users) {
      mergedData = mergedData.map(log => {
        const authUser = authUsers.users.find((u: any) => u.id === log.user_id);
        return {
          ...log,
          profiles: { email: authUser?.email || 'Unknown User' }
        };
      });
    }

    return { data: mergedData };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function deleteErrorLogAction(logId: string) {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase
      .from('error_logs')
      .delete()
      .eq('id', logId);

    if (error) return { error: error.message };
    revalidatePath('/admin');
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function getAiProviderAction(): Promise<{ data?: string; error?: string }> {
  try {
    const supabase = await requireAdmin();
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'ai_provider')
      .single();

    if (error) {
      // Jika tabel belum ada, kembalikan default
      return { data: 'gemini' };
    }
    return { data: data?.value || 'gemini' };
  } catch (err: any) {
    return { data: 'gemini' };
  }
}

export async function setAiProviderAction(provider: 'gemini' | 'deepseek'): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'ai_provider', value: provider, updated_at: new Date().toISOString() }, { onConflict: 'key' });

    if (error) return { error: error.message };
    revalidatePath('/admin');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function updateUserCreditsAction(userId: string, newCredits: number) {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("profiles").update({ credits: newCredits }).eq("id", userId);

    if (error) {
      console.error("Error updating credits:", error);
      return { error: error.message };
    }

    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function impersonateUserAction(targetUserId: string) {
  try {
    const supabase = await requireAdmin();
    const { data: { user: adminUser } } = await supabase.auth.getUser();
    if (!adminUser || !adminUser.email) {
      return { error: 'Sesi Admin tidak valid atau tidak ditemukan.' };
    }

    // Ambil data profil pengguna tujuan
    const { data: targetProfile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('id', targetUserId)
      .single();

    if (profileErr || !targetProfile?.email) {
      return { error: 'Pengguna tujuan tidak ditemukan.' };
    }

    // Cegah admin mengimpersonasi akunnya sendiri
    if (targetProfile.id === adminUser.id || targetProfile.email === adminUser.email) {
      return { error: 'Anda sudah berada di akun admin ini.' };
    }

    // Generate link (magic link OTP) untuk target user
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: targetProfile.email,
    });

    if (linkErr || !linkData?.properties?.hashed_token) {
      return { error: linkErr?.message || 'Gagal menghasilkan token impersonasi.' };
    }

    // Simpan email admin di cookie sebelum berganti sesi
    const cookieStore = await cookies();
    cookieStore.set('impersonator_admin_email', adminUser.email, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 4, // 4 jam
    });

    // Verifikasi OTP pada browser saat ini untuk mengaktifkan sesi target user
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'magiclink'
    });

    if (verifyErr) {
      cookieStore.delete('impersonator_admin_email');
      return { error: `Gagal mengalihkan sesi: ${verifyErr.message}` };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error in impersonateUserAction:', err);
    return { error: err.message || 'Terjadi kesalahan pada server saat impersonasi.' };
  }
}

export async function stopImpersonationAction() {
  let shouldRedirectUrl: string | null = null;
  try {
    const cookieStore = await cookies();
    const adminEmail = cookieStore.get('impersonator_admin_email')?.value;
    if (!adminEmail) {
      shouldRedirectUrl = '/login';
    } else {
      // Validasi kembali bahwa email tersebut adalah admin di profiles
      const { data: adminProfile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('email', adminEmail)
        .single();

      if (adminProfile?.role !== 'admin') {
        cookieStore.delete('impersonator_admin_email');
        shouldRedirectUrl = '/login';
      } else {
        // Generate magic link untuk admin
        const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: adminEmail,
        });

        if (linkErr || !linkData?.properties?.hashed_token) {
          cookieStore.delete('impersonator_admin_email');
          shouldRedirectUrl = '/login';
        } else {
          const supabase = await createClient();
          const { error: verifyErr } = await supabase.auth.verifyOtp({
            token_hash: linkData.properties.hashed_token,
            type: 'magiclink'
          });

          cookieStore.delete('impersonator_admin_email');

          if (verifyErr) {
            shouldRedirectUrl = '/login';
          } else {
            shouldRedirectUrl = '/admin';
          }
        }
      }
    }
  } catch (err: any) {
    console.error('Error in stopImpersonationAction:', err);
    shouldRedirectUrl = '/login';
  }

  if (shouldRedirectUrl) {
    redirect(shouldRedirectUrl);
  }
}

