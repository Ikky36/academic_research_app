-- Add new columns for comprehensive RIS exporting
ALTER TABLE public.extracted_data
ADD COLUMN IF NOT EXISTS journal_name TEXT,
ADD COLUMN IF NOT EXISTS volume TEXT,
ADD COLUMN IF NOT EXISTS issue TEXT,
ADD COLUMN IF NOT EXISTS pages TEXT,
ADD COLUMN IF NOT EXISTS keywords TEXT,
ADD COLUMN IF NOT EXISTS year_published TEXT;
