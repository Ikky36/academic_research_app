'use client';

import { useState } from 'react';
import { requestPasswordReset } from './actions';
import { useRouter } from 'next/navigation';
import styles from '../login/page.module.css';

export default function ForgotPasswordForm({ success }: { success?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await requestPasswordReset(formData);
    
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push('/forgot-password?success=true');
    }
  }

  if (success) {
    return (
      <div className={styles.form} style={{ textAlign: 'center' }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px' }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        <p style={{ color: '#e5e7eb', marginBottom: '20px' }}>
          Tautan untuk mereset kata sandi telah dikirim ke email Anda. Silakan periksa kotak masuk atau folder spam Anda.
        </p>
        <a href="/login" className={styles.secondaryButton} style={{ textDecoration: 'none', display: 'inline-block', width: '100%' }}>
          Kembali ke Login
        </a>
      </div>
    );
  }

  return (
    <form action={onSubmit} className={styles.form}>
      <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '20px' }}>
        Masukkan alamat email yang terdaftar. Kami akan mengirimkan tautan untuk mengatur ulang kata sandi Anda.
      </p>

      <div className={styles.inputGroup}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="scholar@university.edu"
          required
        />
      </div>

      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}

      <div className={styles.buttonGroup}>
        <button type="submit" disabled={loading} className={styles.primaryButton}>
          {loading ? 'Mengirim...' : 'Kirim Tautan Reset'}
        </button>
        <a href="/login" className={styles.secondaryButton} style={{ textDecoration: 'none', textAlign: 'center' }}>
          Batal
        </a>
      </div>
    </form>
  );
}
