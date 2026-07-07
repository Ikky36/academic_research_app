-- Add max_instrumen_referensi to tier_limits
ALTER TABLE public.tier_limits ADD COLUMN IF NOT EXISTS max_instrumen_referensi int4 DEFAULT 2;

-- Set specific limits for roles
UPDATE public.tier_limits SET max_instrumen_referensi = 2 WHERE role = 'free';
UPDATE public.tier_limits SET max_instrumen_referensi = 10 WHERE role = 'pro';
UPDATE public.tier_limits SET max_instrumen_referensi = 50 WHERE role = 'admin';

-- Create table for tracking project instruments
CREATE TABLE IF NOT EXISTS public.project_instruments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  instrument_type text NOT NULL, -- e.g., 'Wawancara', 'Angket', 'Observasi'
  status text DEFAULT 'pending', -- 'pending', 'in_progress', 'completed'
  chat_history jsonb DEFAULT '[]'::jsonb,
  final_result text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE (project_id, instrument_type)
);

-- RLS for project_instruments
ALTER TABLE public.project_instruments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own project instruments"
  ON public.project_instruments FOR SELECT
  USING (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own project instruments"
  ON public.project_instruments FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own project instruments"
  ON public.project_instruments FOR UPDATE
  USING (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their own project instruments"
  ON public.project_instruments FOR DELETE
  USING (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

-- Create table for instrument reference chunks
CREATE TABLE IF NOT EXISTS public.instrument_reference_chunks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
    instrument_type text NOT NULL,
    filename text NOT NULL,
    content text NOT NULL,
    page_start integer,
    page_end integer,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS for instrument_reference_chunks
ALTER TABLE public.instrument_reference_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own instrument chunks"
  ON public.instrument_reference_chunks FOR SELECT
  USING (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own instrument chunks"
  ON public.instrument_reference_chunks FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own instrument chunks"
  ON public.instrument_reference_chunks FOR UPDATE
  USING (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their own instrument chunks"
  ON public.instrument_reference_chunks FOR DELETE
  USING (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));
