
CREATE TABLE IF NOT EXISTS additional_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  year TEXT,
  publisher TEXT,
  source_type TEXT,
  journal_name TEXT,
  volume TEXT,
  issue TEXT,
  doi TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS additional_reference_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id UUID REFERENCES additional_references(id) ON DELETE CASCADE NOT NULL,
  topic_category TEXT NOT NULL,
  content TEXT NOT NULL,
  page_start INTEGER,
  page_end INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE additional_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE additional_reference_chunks ENABLE ROW LEVEL SECURITY;

-- Create policies (Allow users to manage references for their own projects)
CREATE POLICY "Users can manage additional references of their projects" ON additional_references FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.projects WHERE projects.id = additional_references.project_id AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage chunks of their references" ON additional_reference_chunks FOR ALL USING (
  EXISTS (
    SELECT 1 FROM additional_references 
    JOIN public.projects ON public.projects.id = additional_references.project_id 
    WHERE additional_references.id = additional_reference_chunks.reference_id AND public.projects.user_id = auth.uid()
  )
);
