-- Create project_states table
CREATE TABLE IF NOT EXISTS public.project_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  state_key TEXT NOT NULL,
  state_value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(project_id, state_key)
);

-- Enable RLS
ALTER TABLE public.project_states ENABLE ROW LEVEL SECURITY;

-- Create policies (Users can only access states for projects they own)
CREATE POLICY "Users can manage states of their projects" ON public.project_states FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.projects WHERE projects.id = project_states.project_id AND projects.user_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects WHERE projects.id = project_states.project_id AND projects.user_id = auth.uid()
  )
);
