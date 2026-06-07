import styles from "./page.module.css";
import Link from 'next/link';
import { Sparkles, ArrowRight, BrainCircuit, Search, Table, Download, ShieldCheck, FileText, Settings, Key } from 'lucide-react';

export default function Home() {
  return (
    <main className={styles.main}>
      {/* Hero Section */}
      <header className={styles.hero}>
        <div className={styles.badge}>
          <Sparkles size={16} />
          <span>Sistem Riset Generasi Berikutnya</span>
        </div>
        <h1 className={styles.title}>Revolusi Riset Akademik Anda</h1>
        <p className={styles.subtitle}>
          Asisten AI cerdas untuk menelusuri ribuan jurnal, mengekstrak intisari, dan membangun matriks State-of-the-Art (SOTA) secara otomatis dalam hitungan detik.
          <span>Smart AI assistant to search thousands of journals, extract insights, and build State-of-the-Art (SOTA) matrices in seconds.</span>
        </p>
        <div className={styles.ctaGroup}>
          <Link href="/login" className={styles.primaryButton}>
            Mulai Sekarang / Get Started
            <ArrowRight size={20} />
          </Link>
          <Link href="/dashboard" className={styles.secondaryButton}>
            Buka Dasbor / Open Dashboard
          </Link>
        </div>
      </header>
      
      {/* How it works section */}
      <section className={styles.howItWorks}>
        <h2 className={styles.sectionTitle}>Cara Kerja Sistem</h2>
        <p className={styles.sectionSubtitle}>Tiga langkah mudah menuju matriks SOTA yang komprehensif.</p>
        
        <div className={styles.stepsGrid}>
          <div className={styles.stepCard}>
            <div className={styles.stepNumber}>1</div>
            <Search className={styles.stepIcon} size={48} strokeWidth={1.5} />
            <h3>Cari atau Unggah</h3>
            <p>Telusuri miliaran jurnal via Scopus/Crossref atau unggah langsung file PDF buku/jurnal yang sudah Anda miliki.</p>
          </div>
          
          <div className={styles.stepCard}>
            <div className={styles.stepNumber}>2</div>
            <BrainCircuit className={styles.stepIcon} size={48} strokeWidth={1.5} />
            <h3>Ekstraksi Otomatis</h3>
            <p>Kecerdasan Buatan (Google Gemini) akan membaca, memahami, dan mengekstrak metodologi serta temuan penting secara otomatis.</p>
          </div>
          
          <div className={styles.stepCard}>
            <div className={styles.stepNumber}>3</div>
            <Table className={styles.stepIcon} size={48} strokeWidth={1.5} />
            <h3>SOTA Siap Pakai</h3>
            <p>Hasil ekstraksi disusun rapi ke dalam matriks perbandingan (Tabel SOTA) yang bisa Anda ekspor ke Excel (CSV) kapan saja.</p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={styles.features}>
        <h2 className={styles.sectionTitle}>Fitur Unggulan</h2>
        <p className={styles.sectionSubtitle}>Teknologi mutakhir untuk riset tanpa batas.</p>
        
        <div className={styles.bentoGrid}>
          
          <div className={`${styles.bentoCard} ${styles.large}`}>
            <div className={styles.iconWrapper}>
              <BrainCircuit size={40} />
            </div>
            <div className={styles.largeContent}>
              <h3>Kecerdasan Buatan (AI) Terintegrasi</h3>
              <p>Ditenagai oleh integrasi <strong>Google Gemini</strong> untuk penyusunan SOTA super cerdas dan <strong>Groq (Llama 3)</strong> untuk analisis Query yang secepat kilat. Sistem juga mendukung *Bring Your Own Key* (BYOK).</p>
              <p className={styles.en}>Powered by Google Gemini for intelligent SOTA generation and Groq (Llama 3) for lightning-fast query analysis. BYOK supported.</p>
            </div>
          </div>

          <div className={styles.bentoCard}>
            <div className={styles.iconWrapper}>
              <Search size={32} />
            </div>
            <h3>Pencarian Terpadu</h3>
            <p>Telusuri database raksasa dari <strong>Scopus</strong> dan <strong>Crossref</strong> secara bersamaan dalam satu pintu.</p>
            <p className={styles.en}>Search through giant databases from Scopus and Crossref simultaneously.</p>
          </div>

          <div className={styles.bentoCard}>
            <div className={styles.iconWrapper}>
              <Table size={32} />
            </div>
            <h3>SOTA Generator</h3>
            <p>Ekstrak metode, hasil, dan kesimpulan menjadi matriks perbandingan tabel SOTA secara instan.</p>
            <p className={styles.en}>Extract methods and results into a comparative SOTA table instantly.</p>
          </div>

          <div className={styles.bentoCard}>
            <div className={styles.iconWrapper}>
              <Download size={32} />
            </div>
            <h3>Unduh PDF Otomatis</h3>
            <p>Sistem akan mencari tautan PDF gratis (Open Access) dan menyimpannya langsung ke penyimpanan Anda.</p>
            <p className={styles.en}>The system finds free Open Access PDF links and saves them directly.</p>
          </div>

          <div className={styles.bentoCard}>
            <div className={styles.iconWrapper}>
              <ShieldCheck size={32} />
            </div>
            <h3>Sistem Multi-Tier</h3>
            <p>Manajemen pengguna dengan tingkatan akun (Free, Pro, Admin) yang fleksibel dengan pengaturan kuota aman.</p>
            <p className={styles.en}>Flexible user management with account tiers and safe quota configuration.</p>
          </div>
          
          <div className={styles.bentoCard}>
            <div className={styles.iconWrapper}>
              <Key size={32} />
            </div>
            <h3>Rotasi API Otomatis</h3>
            <p>Dukung kelancaran ekstrak PDF tebal dengan memasukkan banyak API Key, jika kuota habis, otomatis beralih.</p>
            <p className={styles.en}>Support massive PDF extraction with automatic API key rotation to prevent quota limit.</p>
          </div>

        </div>
      </section>

      <footer className={styles.footer}>
        <p>&copy; {new Date().getFullYear()} Academic Research Assistant. Dibuat dengan Next.js, Supabase, dan integrasi AI Mutakhir.</p>
      </footer>
    </main>
  );
}
