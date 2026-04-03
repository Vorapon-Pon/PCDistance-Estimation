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
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.client_reference_id; 

    if (userId) {
      const planTier = session.metadata?.plan_tier || 'public';
      const creditsToAdd = parseInt(session.metadata?.credits_to_add || '0', 10);
      const transactionType = session.metadata?.transaction_type || 'TOP_UP';
      const mode = session.mode;
      
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('credits')
        .eq('id', userId)
        .single();

      if (profile) {
        if (mode === 'payment') { // for ถ้วย
          if (transactionType === 'PLAN_UPGRADE') {
          await supabaseAdmin.from('profiles').update({ 
            plan_tier: planTier, 
            credits: profile.credits + creditsToAdd,
          }).eq('id', userId);
        } else {
          await supabaseAdmin.from('profiles').update({ 
            credits: profile.credits + creditsToAdd 
          }).eq('id', userId);
        }

        const { error: txError } = await supabaseAdmin.from('credit_transactions').insert({
            user_id: userId,
            amount: creditsToAdd,
            transaction_type: transactionType,
            description: transactionType === 'PLAN_UPGRADE' 
              ? `Upgraded to ${planTier.toUpperCase()} Plan (PromptPay/One-time)` 
              : `Top-up Credits`
          });
          if (txError) console.error("Insert Transaction Error:", txError);

        } else if (mode === 'subscription') {
          let currentPeriodEnd = null;
          if (session.subscription) {
            const subscription = (await stripe.subscriptions.retrieve(
              session.subscription as string
            )) as Stripe.Subscription;
            currentPeriodEnd = new Date((subscription as any).current_period_end * 1000);
          }

          const { error: profileError } = await supabaseAdmin.from('profiles').update({ 
            plan_tier: planTier, 
            credits: profile.credits + creditsToAdd,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            current_period_end: currentPeriodEnd
          }).eq('id', userId);
          if (profileError) console.error("Update Profile Error:", profileError);

          const { error: txError } = await supabaseAdmin.from('credit_transactions').insert({
            user_id: userId,
            amount: creditsToAdd,
            transaction_type: transactionType,
            description: `Subscribed to ${planTier.toUpperCase()} Plan (Sub: ${session.subscription})`
          });
          if (txError) console.error("Insert Transaction Error:", txError);
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}