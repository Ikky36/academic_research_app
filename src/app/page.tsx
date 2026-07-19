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
          Ubah cara Anda meneliti. Asisten AI cerdas untuk menemukan referensi, menganalisis literatur, dan menyusun kerangka penelitian Anda dengan kecepatan luar biasa.
          <span>Transform the way you research. A smart AI assistant to find references, analyze literature, and draft your research with incredible speed.</span>
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
            <p>Kecerdasan Buatan akan membaca, memahami, dan mengekstrak metodologi serta temuan penting secara otomatis.</p>
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
              <p>Ditenagai oleh integrasi kecerdasan buatan (AI) mutakhir untuk penyusunan teks akademis super cerdas dan analisis kueri yang secepat kilat.</p>
              <p className={styles.en}>Powered by cutting-edge AI for intelligent academic generation and lightning-fast query analysis.</p>
            </div>
          </div>

          <div className={styles.bentoCard}>
            <div className={styles.iconWrapper}>
              <Search size={32} />
            </div>
            <h3>Pencarian Terpadu Terpusat</h3>
            <p>Telusuri database jurnal raksasa dari <strong>Scopus</strong> dan <strong>Crossref</strong> secara bersamaan dalam satu pintu tanpa perlu berpindah-pindah tab.</p>
            <p className={styles.en}>Search through giant journal databases from Scopus and Crossref simultaneously in one place.</p>
          </div>

          <div className={styles.bentoCard}>
            <div className={styles.iconWrapper}>
              <Table size={32} />
            </div>
            <h3>Tabel SOTA</h3>
            <p>Sistem secara otomatis mengekstrak metode, hasil, dan kesimpulan untuk membangun matriks perbandingan State-of-the-Art (SOTA) secara instan.</p>
            <p className={styles.en}>Automatically extract methods and results to build comparative State-of-the-Art (SOTA) matrices instantly.</p>
          </div>

          <div className={styles.bentoCard}>
            <div className={styles.iconWrapper}>
              <Sparkles size={32} />
            </div>
            <h3>Research GAP & Novelty</h3>
            <p>AI akan menganalisis jurnal-jurnal SOTA Anda dan merumuskan celah penelitian (Research GAP) serta kebaruan (Novelty) untuk penelitian Anda.</p>
            <p className={styles.en}>AI analyzes your SOTA journals to formulate Research GAP and Novelty for your study.</p>
          </div>

          <div className={styles.bentoCard}>
            <div className={styles.iconWrapper}>
              <FileText size={32} />
            </div>
            <h3>Draft Kajian Pustaka & Metodologi Otomatis</h3>
            <p>Hasilkan paragraf <strong>Kajian Pustaka</strong>, <strong>Literature Review</strong>, hingga <strong>Metodologi</strong> dari PDF buku metodologi Anda secara terstruktur.</p>
            <p className={styles.en}>Generate structured Literature Review (Chapter II) and Methodology (Chapter III) drafts from your methodology books.</p>
          </div>
          
          <div className={styles.bentoCard}>
            <div className={styles.iconWrapper}>
              <ShieldCheck size={32} />
            </div>
            <h3>Sistem Multi-Tier & Admin</h3>
            <p>Manajemen pengguna dengan tingkatan akun (Free, Pro, Admin), fitur manajemen kuota, dan sinkronisasi PDF eksternal via Google Drive untuk peladen.</p>
            <p className={styles.en}>User management with account tiers, quota features, and external PDF sync via Google Drive for server processing.</p>
          </div>

        </div>
      </section>

      <footer className={styles.footer}>
        <p>&copy; {new Date().getFullYear()} Academic Research Assistant. Dibuat dengan Next.js, Supabase, dan integrasi AI Mutakhir.</p>
      </footer>
    </main>
  );
}
