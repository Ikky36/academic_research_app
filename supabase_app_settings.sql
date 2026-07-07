-- ================================================
-- SQL: Buat tabel app_settings untuk konfigurasi AI Provider
-- Jalankan di: Supabase Dashboard → SQL Editor
-- ================================================

-- 1. Buat tabel
CREATE TABLE IF NOT EXISTS public.app_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. Seed data default (Gemini sebagai provider awal)
INSERT INTO public.app_settings (key, value)
VALUES ('ai_provider', 'gemini')
ON CONFLICT (key) DO NOTHING;

-- 3. Aktifkan RLS (Row Level Security)
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 4. Policy: Semua user yang terautentikasi bisa MEMBACA setting
CREATE POLICY "Allow authenticated read" ON public.app_settings
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- 5. Policy: Hanya Admin yang bisa UPDATE/INSERT setting
CREATE POLICY "Allow admin write" ON public.app_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
