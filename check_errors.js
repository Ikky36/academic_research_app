const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY); // using service_role would be better but I only have anon
async function run() {
  // try inserting a test error to see if error_logs table is readable
  // Actually anon key might have read access to error_logs if RLS allows
  const { data, error } = await supabase.from("error_logs").select("*").order("created_at", { ascending: false }).limit(5);
  console.log("Data:", data, "Error:", error);
}
run();
