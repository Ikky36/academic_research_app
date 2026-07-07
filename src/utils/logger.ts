import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Logs an error to the error_logs table in Supabase.
 * @param feature The feature where the error occurred (e.g., 'SOTA', 'Kajian Pustaka').
 * @param error The error object or string.
 * @param userId Optional user ID if available.
 */
export async function logErrorToAdmin(feature: string, error: any, userId?: string) {
  try {
    // Safely extract error message
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.stack || error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else {
      try {
        errorMessage = JSON.stringify(error);
      } catch (e) {
        errorMessage = String(error);
      }
    }

    // Try to get user if not provided
    let finalUserId = userId;
    if (!finalUserId) {
      try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          finalUserId = user.id;
        }
      } catch (e) {
        // Ignore if we can't get the user (e.g., outside of request context)
      }
    }

    // Use Service Role Key to bypass RLS, guaranteeing the log is inserted
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is missing. Cannot log error.');
      return;
    }

    const adminSupabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { error: insertError } = await adminSupabase.from('error_logs').insert({
      user_id: finalUserId || null,
      feature: feature,
      error_message: errorMessage
    });

    if (insertError) {
      console.error('Supabase Insert Error (error_logs):', insertError);
      return { success: false, error: insertError };
    }
    
    return { success: true };

  } catch (err) {
    console.error('Failed to log error to admin table:', err);
    return { success: false, error: err };
  }
}

export const FRIENDLY_ERROR_MESSAGE = 'Mohon maaf, sistem AI saat ini sedang antre panjang atau mengalami kendala sesaat dari server pusat. Kami sudah mencatat kendala ini secara otomatis. Silakan coba klik tombolnya sekali lagi dalam beberapa saat ya 🙏';

/**
 * Wraps an asynchronous function to automatically catch, log, and hide errors.
 * Use this wrapper when you want to throw a generic error to the caller.
 * 
 * @param feature Name of the feature for the log (e.g. 'Fitur_Baru')
 * @param fn The asynchronous logic to execute
 * @param genericMessage The message shown to the user on error
 */
export async function withErrorLogging<T>(
  feature: string,
  fn: () => Promise<T>,
  genericMessage: string = FRIENDLY_ERROR_MESSAGE
): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    await logErrorToAdmin(feature, err);
    throw new Error(genericMessage);
  }
}

/**
 * Wraps an asynchronous function to automatically catch, log, and hide errors.
 * Use this wrapper for Server Actions where you want to return { error: string } instead of throwing.
 * 
 * @param feature Name of the feature for the log
 * @param fn The asynchronous logic to execute
 * @param genericMessage The message returned to the user on error
 */
export async function withSafeAction<T>(
  feature: string,
  fn: () => Promise<T>,
  genericMessage: string = FRIENDLY_ERROR_MESSAGE
): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (err: any) {
    await logErrorToAdmin(feature, err);
    return { error: genericMessage };
  }
}
