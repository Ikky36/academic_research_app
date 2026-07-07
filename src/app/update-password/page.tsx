import styles from '../login/page.module.css';
import UpdatePasswordForm from './UpdatePasswordForm';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Perbarui Kata Sandi - Pusat Riset Akademik',
};

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect to login if user is not authenticated
  // (They should be authenticated by the callback route before reaching here)
  if (!user) {
    redirect('/login?message=Sesi tidak valid atau telah kedaluwarsa. Silakan minta tautan reset yang baru.');
  }

  return (
    <div className={styles.container}>
      <div className={styles.glassCard}>
        <div className={styles.header}>
          <h1 className={styles.title}>Perbarui Kata Sandi</h1>
          <p className={styles.subtitle}>Untuk pengguna: {user.email}</p>
        </div>

        <UpdatePasswordForm />
      </div>
    </div>
  );
}
