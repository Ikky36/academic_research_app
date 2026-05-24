'use client';

import { useState } from 'react';
import { login, signup } from './actions';
import { createClient } from '@/utils/supabase/client';
import styles from './page.module.css';

export default function LoginForm({ message }: { message?: string }) {
  const [showPassword, setShowPassword] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  const handleGoogleLogin = async () => {
    setLoadingGoogle(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/drive.file',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
    if (error) {
      setLoadingGoogle(false);
      alert(error.message);
    }
  };

  return (
    <form className={styles.form}>
      <div className={styles.inputGroup}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="scholar@university.edu"
          required
        />
      </div>

      <div className={styles.inputGroup}>
        <div className={styles.passwordHeader}>
          <label htmlFor="password">Kata Sandi</label>
          <a href="/forgot-password" className={styles.forgotPassword}>Lupa Kata Sandi?</a>
        </div>
        <div className={styles.passwordWrapper}>
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            required
          />
          <button 
            type="button" 
            className={styles.eyeButton}
            onClick={() => setShowPassword(!showPassword)}
            title={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
          >
            {showPassword ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path><line x1="2" y1="2" x2="22" y2="22"></line></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            )}
          </button>
        </div>
      </div>

      {message && (
        <div className={styles.errorMessage}>
          {message}
        </div>
      )}

      <div className={styles.buttonGroup}>
        <button formAction={login} className={styles.primaryButton}>
          Masuk
        </button>
        <button formAction={signup} className={styles.secondaryButton}>
          Daftar Baru
        </button>
      </div>

      <div className={styles.divider}>
        <span>ATAU</span>
      </div>

      <button 
        type="button" 
        onClick={handleGoogleLogin} 
        disabled={loadingGoogle}
        className={styles.googleButton}
      >
        {loadingGoogle ? 'Memuat...' : 'Lanjutkan dengan Google'}
      </button>
    </form>
  );
}
