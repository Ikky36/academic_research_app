-- Add max_kajian_tambahan to tier_limits
ALTER TABLE public.tier_limits 
ADD COLUMN IF NOT EXISTS max_kajian_tambahan INT NOT NULL DEFAULT 5;

-- Update defaults for existing roles
UPDATE public.tier_limits SET max_kajian_tambahan = 5 WHERE role = 'free';
UPDATE public.tier_limits SET max_kajian_tambahan = 20 WHERE role = 'pro';
UPDATE public.tier_limits SET max_kajian_tambahan = 50 WHERE role = 'admin';
