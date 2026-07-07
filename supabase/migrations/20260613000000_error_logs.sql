-- Create error_logs table
CREATE TABLE IF NOT EXISTS public.error_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  feature TEXT NOT NULL,
  error_message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view error logs
CREATE POLICY "Admins can view error logs" 
ON public.error_logs 
FOR SELECT 
USING (public.is_admin());

-- Policy: Anyone (even anonymous or authenticated users) can insert error logs via service role / backend
-- Since this table will be inserted to via service_role key in the backend, we don't strictly need an INSERT policy for users.
-- But if we want the client to insert, we would do it here. We will insert via server actions using service_role or regular client.
-- Let's allow authenticated users to insert their own logs just in case we do it from client side, but we'll do it from server side.
CREATE POLICY "Authenticated users can insert error logs" 
ON public.error_logs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Policy: Only admins can delete error logs
CREATE POLICY "Admins can delete error logs" 
ON public.error_logs 
FOR DELETE 
USING (public.is_admin());
