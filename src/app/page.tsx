import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1>Academic Research Assistant</h1>
        <p>AI-Powered Literature Review & SOTA Generator</p>
      </header>
      
      <section className={styles.content}>
        <div className={styles.card}>
          <h2>Accelerate Your Research</h2>
          <p>
            Extract insights from thousands of papers across Crossref and Scopus, 
            analyze them with Gemini AI, and automatically generate your state-of-the-art matrix.
          </p>
          <button className={styles.primaryButton}>Get Started</button>
        </div>
      </section>
    </main>
  );
}
