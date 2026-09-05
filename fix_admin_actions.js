const fs = require("fs");
let content = fs.readFileSync("src/app/admin/actions.ts", "utf-8");

const newAction = `
export async function updateUserCreditsAction(userId: string, newCredits: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { error: "Not authorized" };

  const adminSupabase = getAdminClient();
  const { error } = await adminSupabase.from("profiles").update({ credits: newCredits }).eq("id", userId);

  if (error) {
    console.error("Error updating credits:", error);
    return { error: error.message };
  }

  revalidatePath("/admin");
  return { success: true };
}
`;

content = content + newAction;
fs.writeFileSync("src/app/admin/actions.ts", content, "utf-8");
console.log("Added updateUserCreditsAction");
