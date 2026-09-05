import { createClient } from "@/utils/supabase/server";

/**
 * Checks if the user has enough credits and deducts them atomically if they do.
 * @param requiredCredits The number of credits required for the action.
 * @returns boolean True if successful, False if insufficient credits or error.
 */
export async function consumeCredits(requiredCredits: number): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return false;

  // We call the atomic RPC function we created in Supabase
  const { data: isSuccess, error } = await supabase.rpc("deduct_credits", {
    user_id: user.id,
    amount: requiredCredits
  });

  if (error) {
    console.error("Error consuming credits:", error);
    return false;
  }

  return isSuccess === true;
}

