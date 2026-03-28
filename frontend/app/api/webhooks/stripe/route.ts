import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature') as string;

  let event: Stripe.Event;

  try {
    // ยืนยันว่าข้อมูลมาจาก Stripe จริงๆ ป้องกันคนแฮ็กยิง API มั่วๆ
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET! 
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed.', err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    
    const userId = session.client_reference_id; 

    if (userId) {
      const mode = session.mode; // 'payment' (เติม credit) หรือ 'subscription' (รายเดือน)

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('credits')
        .eq('id', userId)
        .single();

      if (profile) {
        if (mode === 'payment') {
          const creditsToAdd = 100; 
          
          await supabaseAdmin.from('profiles').update({ 
            credits: profile.credits + creditsToAdd 
          }).eq('id', userId);

          await supabaseAdmin.from('credit_transactions').insert({
            user_id: userId,
            amount: creditsToAdd,
            transaction_type: 'TOP_UP',
            description: `Purchased additional credits (Session: ${session.id})`
          });

        } else if (mode === 'subscription') {
          const planCredits = 500; 
          
          await supabaseAdmin.from('profiles').update({ 
            plan_tier: 'professional', 
            credits: profile.credits + planCredits,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
          }).eq('id', userId);

          await supabaseAdmin.from('credit_transactions').insert({
            user_id: userId,
            amount: planCredits,
            transaction_type: 'PLAN_UPGRADE',
            description: `Upgraded to Professional Plan (Sub: ${session.subscription})`
          });
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}