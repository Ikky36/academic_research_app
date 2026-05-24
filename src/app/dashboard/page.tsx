import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import SearchInterface from './SearchInterface'
import SotaInterface from './SotaInterface'
import Sidebar from './Sidebar'
import styles from './page.module.css'

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

  return (
    <div className={styles.appContainer}>
      <Sidebar projects={projects || []} currentProjectId={activeProject?.id || ''} activeTab={activeTab} />
      
      <div className={styles.mainContent}>
        <header className={styles.header}>
          <div className={styles.headerSpacer}></div>
          <div className={styles.headerRightControls}>
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
        </div>

        <main className={styles.main}>
          {activeProject && (
            <>
              <div style={{ display: activeTab === 'search' ? 'block' : 'none' }}>
                <SearchInterface key={`search-${activeProject.id}`} projectId={activeProject.id} />
              </div>
              <div style={{ display: activeTab === 'sota' ? 'block' : 'none' }}>
                <SotaInterface key={`sota-${activeProject.id}`} projectId={activeProject.id} isActive={activeTab === 'sota'} />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
    </div>
  )
}
