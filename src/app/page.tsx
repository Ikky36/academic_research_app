import styles from "./page.module.css";
import Link from 'next/link';

export default function Home() {
  return (
    <main className={styles.main}>
      <header className={styles.hero}>
        <h1 className={styles.title}>Revolusi Riset Akademik Anda</h1>
        <p className={styles.subtitle}>
          Asisten AI cerdas untuk menelusuri ribuan jurnal, mengekstrak intisari, dan membangun matriks State-of-the-Art (SOTA) dalam hitungan detik. <br/>
          <span style={{ fontSize: '1rem', fontStyle: 'italic', color: '#64748b' }}>
            Smart AI assistant to search thousands of journals, extract insights, and build State-of-the-Art (SOTA) matrices in seconds.
          </span>
        </p>
        <div className={styles.ctaGroup}>
          <Link href="/login" className={styles.primaryButton}>
            Mulai Sekarang / Get Started
          </Link>
          <Link href="/dashboard" className={styles.secondaryButton}>
            Buka Dasbor / Open Dashboard
          </Link>
        </div>
      </header>
      
      <section className={styles.features}>
        <h2 className={styles.sectionTitle}>Fitur Unggulan <span style={{ color: '#64748b', fontWeight: 400 }}>/ Core Features</span></h2>
        
        <div className={styles.bentoGrid}>
          
          <div className={`${styles.bentoCard} ${styles.large}`}>
            <div className={styles.iconWrapper}>🤖</div>
            <div className={styles.largeContent}>
              <h3>Kecerdasan Buatan (AI) Ganda</h3>
              <p>Ditenagai oleh integrasi <strong>Google Gemini</strong> untuk penyusunan SOTA super cerdas dan <strong>Groq (Llama 3)</strong> untuk analisis Query yang secepat kilat. Anda juga bisa menggunakan API Key Anda sendiri (BYOK).</p>
              <p className={styles.en}>Powered by Google Gemini for intelligent SOTA generation and Groq (Llama 3) for lightning-fast query analysis. You can also Bring Your Own Key (BYOK).</p>
            </div>
          </div>

          <div className={styles.bentoCard}>
            <div className={styles.iconWrapper}>🔍</div>
            <h3>Pencarian Cerdas Terpadu</h3>
            <p>Telusuri database raksasa dari <strong>Scopus</strong> dan <strong>Crossref</strong> secara bersamaan tanpa perlu membuka banyak tab.</p>
            <p className={styles.en}>Search through giant databases from Scopus and Crossref simultaneously without opening multiple tabs.</p>
          </div>

          <div className={styles.bentoCard}>
            <div className={styles.iconWrapper}>📊</div>
            <h3>SOTA Generator Otomatis</h3>
            <p>Ekstrak metode, hasil, dan kesimpulan dari abstrak menjadi matriks perbandingan tabel SOTA secara instan.</p>
            <p className={styles.en}>Extract methods, results, and conclusions from abstracts into a comparative SOTA table matrix instantly.</p>
          </div>

          <div className={styles.bentoCard}>
            <div className={styles.iconWrapper}>📥</div>
            <h3>Unpaywall & Google Drive</h3>
            <p>Sistem akan otomatis mencari tautan PDF gratis (Open Access) dan menyimpannya langsung ke akun Google Drive Anda.</p>
            <p className={styles.en}>The system automatically finds free PDF links (Open Access) and saves them directly to your Google Drive.</p>
          </div>

          <div className={styles.bentoCard}>
            <div className={styles.iconWrapper}>👑</div>
            <h3>Multi-Tier Access</h3>
            <p>Manajemen pengguna dengan tingkatan akun (Free, Pro, Admin) yang membatasi penggunaan sesuai kuota sistem.</p>
            <p className={styles.en}>User management with account tiers (Free, Pro, Admin) that limits usage according to system quotas.</p>
          </div>

        </div>
      </section>

      <footer className={styles.footer}>
        <p>&copy; {new Date().getFullYear()} Academic Research Assistant. Dibuat dengan Next.js & Supabase.</p>
      </footer>
    </main>
  );
}
