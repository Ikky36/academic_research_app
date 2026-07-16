import { createClient } from '@/utils/supabase/client'

export async function saveProjectState(projectId: string, key: string, value: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('project_states')
    .upsert(
      { 
        project_id: projectId, 
        state_key: key, 
        state_value: value,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'project_id,state_key' }
    );
    
  if (error) {
    console.error(`Error saving state for ${key}:`, error);
  }
  return { data, error };
}

export async function getProjectState(projectId: string, key: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('project_states')
    .select('state_value')
    .eq('project_id', projectId)
    .eq('state_key', key)
    .single();
    
  if (error && error.code !== 'PGRST116') { // PGRST116 is not found
    console.error(`Error getting state for ${key}:`, error);
  }
  return data?.state_value || null;
}

export async function getAllProjectStates(projectId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('project_states')
    .select('state_key, state_value')
    .eq('project_id', projectId);
    
  if (error) {
    console.error('Error getting all states:', error);
    return {};
  }
  
  const stateMap: Record<string, string> = {};
  if (data) {
    data.forEach(row => {
      stateMap[row.state_key] = row.state_value;
    });
  }
  return stateMap;
}
