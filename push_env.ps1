$url = "https://dlwwrwwarmflxknynfvk.supabase.co"
$key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsd3dyd3dhcm1mbHhrbnluZnZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NjUzMTcsImV4cCI6MjA5NTA0MTMxN30.cP2RE3TozEHqfexIHl1mL6v_5f5fu7bsEtNIVJeE1uU"
$scopus = "3cb611380776af6e0a1f47b4fb64c7ba"
$gemini = "AIzaSyBpkF19RePFOYHrZTCrDYnqPkLX-v8x-tU"
$groq = "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"
$openai = "sk-1234efgh5678ijkl1234efgh5678ijkl1234efgh"
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production --value $url --yes
npx vercel env add NEXT_PUBLIC_SUPABASE_URL preview --value $url --yes
npx vercel env add NEXT_PUBLIC_SUPABASE_URL development --value $url --yes

npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production --value $key --yes
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview --value $key --yes
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY development --value $key --yes

npx vercel env add SCOPUS_API_KEY production --value $scopus --yes
npx vercel env add SCOPUS_API_KEY preview --value $scopus --yes
npx vercel env add SCOPUS_API_KEY development --value $scopus --yes

npx vercel env add GEMINI_API_KEY production --value $gemini --yes
npx vercel env add GEMINI_API_KEY preview --value $gemini --yes
npx vercel env add GEMINI_API_KEY development --value $gemini --yes

npx vercel env add GROQ_API_KEY production --value $groq --yes
npx vercel env add GROQ_API_KEY preview --value $groq --yes
npx vercel env add GROQ_API_KEY development --value $groq --yes

npx vercel env add OPENAI_API_KEY production --value $openai --yes
npx vercel env add OPENAI_API_KEY preview --value $openai --yes
npx vercel env add OPENAI_API_KEY development --value $openai --yes

Write-Host "All environment variables pushed!"
