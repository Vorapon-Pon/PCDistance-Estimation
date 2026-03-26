'use server'

import { createClient } from "@/utils/server"; 
import { revalidatePath } from 'next/cache';

export async function processEstimateCredits(totalCost: number, description: string) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const { error } = await supabase.rpc('deduct_user_credits', {
      p_user_id: user.id,
      p_amount: totalCost,
      p_transaction_type: 'ESTIMATE_DISTANCE',
      p_description: description
    });

    if (error) {
      console.error("Credit deduction failed:", error);
      if (error.message.includes('Not enough credits')) {
        return { success: false, error: 'Not enough credits. Please upgrade your plan.' };
      }
      return { success: false, error: 'Transaction failed. Please try again.' };
    }

    revalidatePath('/projects', 'layout');
    return { success: true, message: 'Credits deducted successfully!' };

  } catch (err: any) {
    return { success: false, error: err.message };
  }
}