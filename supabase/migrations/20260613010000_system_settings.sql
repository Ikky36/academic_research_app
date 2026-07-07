CREATE TABLE IF NOT EXISTS public.system_settings (
  id INT PRIMARY KEY DEFAULT 1,
  global_api_mode TEXT NOT NULL DEFAULT 'auto' CHECK (global_api_mode IN ('auto', 'force_free', 'force_paid')),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default row
INSERT INTO public.system_settings (id, global_api_mode)
VALUES (1, 'auto')
ON CONFLICT (id) DO NOTHING;

-- Policies
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view system settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Only admins can update system settings" ON public.system_settings FOR UPDATE USING (public.is_admin());
