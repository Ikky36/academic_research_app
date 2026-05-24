-- Create admin check function that bypasses RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  RETURN v_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update profiles check constraint to allow 'admin'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('free', 'pro', 'admin'));

-- Update profiles policies for admins
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (public.is_admin());

-- Create tier limits table
CREATE TABLE public.tier_limits (
  role TEXT PRIMARY KEY CHECK (role IN ('free', 'pro', 'admin')),
  max_projects INT NOT NULL DEFAULT 3,
  max_search_results INT NOT NULL DEFAULT 20,
  max_sota_rows INT NOT NULL DEFAULT 5,
  can_bulk_download_gdrive BOOLEAN NOT NULL DEFAULT false
);

-- Insert default limits
INSERT INTO public.tier_limits (role, max_projects, max_search_results, max_sota_rows, can_bulk_download_gdrive)
VALUES 
  ('free', 3, 20, 5, false),
  ('pro', 100, 100, 50, true),
  ('admin', 999, 100, 100, true);

-- Enable RLS on tier_limits
ALTER TABLE public.tier_limits ENABLE ROW LEVEL SECURITY;

-- Policies for tier_limits
CREATE POLICY "Anyone can view tier limits" ON public.tier_limits FOR SELECT USING (true);
CREATE POLICY "Only admins can modify tier limits" ON public.tier_limits FOR ALL USING (public.is_admin());
