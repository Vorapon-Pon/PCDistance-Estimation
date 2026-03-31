'use server'

import { createClient } from "@/utils/server";
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function createCheckoutSession(
  priceId: string, 
  type: 'subscription' | 'topup',
  planTier: string = 'free', 
  creditsToAdd: number = 0 
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: 'Unauthorized' };

  const getBaseURL = () => {
    let url = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
    return url.includes('http') ? url : `https://${url}`;
  };

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId, 
          quantity: 1,
        },
      ],
      mode: type === 'subscription' ? 'subscription' : 'payment',
      client_reference_id: user.id, 
      
      metadata: {
        plan_tier: planTier, 
        credits_to_add: creditsToAdd.toString(),
        transaction_type: type === 'subscription' ? 'PLAN_UPGRADE' : 'TOP_UP'
      },

      success_url: `${getBaseURL()}/settings/plans?success=true`,
      cancel_url: `${getBaseURL()}/settings/plans?canceled=true`,
    });

    return { url: session.url };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function getUserProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { planTier: 'free', credits: 0 };

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('plan_tier, credits')
    .eq('id', user.id)
    .single();

  if (error || !profile) return { planTier: 'free', credits: 0 };
  
  return { 
    planTier: profile.plan_tier || 'free', 
    credits: profile.credits || 0 
  };
}