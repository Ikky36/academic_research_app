import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import SearchInterface from './SearchInterface'
import SotaInterface from './SotaInterface'
import GapNoveltyInterface from './GapNoveltyInterface'
import LitReviewInterface from './LitReviewInterface'
import KajianPustakaInterface from './KajianPustakaInterface'
import Sidebar from './Sidebar'
import styles from './page.module.css'

import SettingsButton from '@/components/SettingsButton'

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ tab?: string; project?: string }>
}) {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    redirect('/login')
  }

  // Fetch all projects for this user
  let { data: projects } = await supabase
    .from('projects')
    .select('id, title')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  // Ensure user has at least one project
  if (!projects || projects.length === 0) {
    const { data: newProject } = await supabase
      .from('projects')
      .insert([{ user_id: user.id, title: 'Proyek Riset Pertama Saya' }])
      .select('id, title')
      .single()
    projects = newProject ? [newProject] : []
  }

  const params = await searchParams;
  const activeTab = params.tab || 'search';
  const activeProjectId = params.project || (projects.length > 0 ? projects[0].id : '');
  
  const activeProject = projects?.find(p => p.id === activeProjectId) || projects?.[0];

  // Fetch user role
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = profile?.role || 'free';
  const canUseByok = user.user_metadata?.can_use_byok === true;
  
  // Fetch tier limits
  const { data: tierLimits } = await supabase.from('tier_limits').select('*').eq('role', role).single();
  const limits = tierLimits || {
    max_projects: 3,
    max_search_results: 20,
    max_sota_rows: 5,
    can_bulk_download_gdrive: false,
    can_use_paid_api: false
  };

  let isPaidApi = false;
  const paidApiOverride = user.user_metadata?.paid_api_override;
  if (paidApiOverride === true) {
    isPaidApi = true;
  } else if (paidApiOverride === false) {
    isPaidApi = false;
  } else {
    isPaidApi = limits.can_use_paid_api === true;
  }

  return (
    <div className={styles.appContainer}>
      <Sidebar projects={projects || []} currentProjectId={activeProject?.id || ''} activeTab={activeTab} limits={limits} role={role} />
      
      <div className={styles.mainContent}>
        <header className={styles.header}>
          <div className={styles.headerSpacer}></div>
          <div className={styles.headerRightControls}>
          {canUseByok && <SettingsButton />}
          {role === 'admin' && (
            <Link href="/admin" className={styles.adminButton}>Admin Dashboard</Link>
          )}
          <div className={styles.userPill}>
            <span>👤</span> {user.email}
          </div>
          <form action="/auth/signout" method="post">
            <button className={styles.logoutButton}>Sign Out</button>
          </form>
        </div>
      </header>

      <div className={styles.mainLayout}>
        <div className={styles.tabs}>
          <Link 
            href={`/dashboard?tab=search&project=${activeProject?.id}`} 
            className={activeTab === 'search' ? styles.activeTab : styles.tab}
          >
            🔍 Cari Jurnal
          </Link>
          <Link 
            href={`/dashboard?tab=sota&project=${activeProject?.id}`} 
            className={activeTab === 'sota' ? styles.activeTab : styles.tab}
          >
            📊 Tabel SOTA & Analisis
          </Link>
          <Link 
            href={`/dashboard?tab=gap-novelty&project=${activeProject?.id}`} 
            className={activeTab === 'gap-novelty' ? styles.activeTab : styles.tab}
          >
            💡 Research GAP & Novelty
          </Link>
          <Link 
            href={`/dashboard?tab=lit-review&project=${activeProject?.id}`} 
            className={activeTab === 'lit-review' ? styles.activeTab : styles.tab}
          >
            📚 Literature Review
          </Link>
          <Link 
            href={`/dashboard?tab=kajian-pustaka&project=${activeProject?.id}`} 
            className={activeTab === 'kajian-pustaka' ? styles.activeTab : styles.tab}
          >
            🧠 Kajian Pustaka (Bab II)
          </Link>
        </div>

        <main className={styles.main}>
          {activeProject && (
            <>
              <div style={{ display: activeTab === 'search' ? 'block' : 'none' }}>
                <SearchInterface key={`search-${activeProject.id}`} projectId={activeProject.id} limits={limits} role={role} />
              </div>
              <div style={{ display: activeTab === 'sota' ? 'block' : 'none' }}>
                <SotaInterface key={`sota-${activeProject.id}`} projectId={activeProject.id} isActive={activeTab === 'sota'} limits={limits} role={role} isPaidApi={isPaidApi} />
              </div>
              <div style={{ display: activeTab === 'gap-novelty' ? 'block' : 'none' }}>
                <GapNoveltyInterface key={`gap-${activeProject.id}`} projectId={activeProject.id} isActive={activeTab === 'gap-novelty'} limits={limits} role={role} isPaidApi={isPaidApi} />
              </div>
              <div style={{ display: activeTab === 'lit-review' ? 'block' : 'none' }}>
                <LitReviewInterface key={`lit-${activeProject.id}`} projectId={activeProject.id} isActive={activeTab === 'lit-review'} limits={limits} role={role} isPaidApi={isPaidApi} />
              </div>
              <div style={{ display: activeTab === 'kajian-pustaka' ? 'block' : 'none' }}>
                <KajianPustakaInterface key={`kp-${activeProject.id}`} projectId={activeProject.id} isActive={activeTab === 'kajian-pustaka'} limits={limits} role={role} isPaidApi={isPaidApi} />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
    </div>
  )
}
