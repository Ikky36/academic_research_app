import styles from '../login/page.module.css';
import ForgotPasswordForm from './ForgotPasswordForm';

export const metadata = {
  title: 'Lupa Kata Sandi - Pusat Riset Akademik',
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ success: string }>;
}) {
  const params = await searchParams;

  return (
    <div className={styles.container}>
      <div className={styles.glassCard}>
        <div className={styles.header}>
          <h1 className={styles.title}>Lupa Kata Sandi</h1>
          <p className={styles.subtitle}>Pulihkan akses ke akun Anda</p>
        </div>

        <ForgotPasswordForm success={params?.success} />
      </div>
    </div>
  );
}
