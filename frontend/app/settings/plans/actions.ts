'use server'

import { createClient } from "@/utils/server";
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function createCheckoutSession(priceId: string, type: 'subscription' | 'topup') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: 'Unauthorized' };

  const getBaseURL = () => {
    let url = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
    url = url.includes('http') ? url : `https://${url}`;
    return url;
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
      
      success_url: `${getBaseURL()}/settings/plans?success=true`,
      cancel_url: `${getBaseURL()}/settings/plans?canceled=true`,
    });

    return { url: session.url };
  } catch (error: any) {
    return { error: error.message };
  }
}