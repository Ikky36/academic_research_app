import styles from './page.module.css';
import LoginForm from './LoginForm';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message: string }>;
}) {
  const params = await searchParams;

  return (
    <div className={styles.container}>
      <div className={styles.glassCard}>
        <div className={styles.header}>
          <h1 className={styles.title}>Selamat Datang</h1>
          <p className={styles.subtitle}>Masuk ke workspace riset Anda</p>
        </div>

        <LoginForm message={params?.message} />

      </div>
    </div>
  );
}
