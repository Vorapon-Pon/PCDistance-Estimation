import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// แนะนำให้ใช้ SUPABASE_SERVICE_ROLE_KEY ที่ไม่มี NEXT_PUBLIC_ เพื่อความปลอดภัยสูงสุด
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, 
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
);

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature') as string;

  let event: Stripe.Event;

  // 1. ตรวจสอบความถูกต้องของ Webhook จาก Stripe
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  // 2. จัดการเมื่อการชำระเงินหรือการสมัครสมาชิกเสร็จสมบูรณ์
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.client_reference_id; 

    if (userId) {
      const planTier = session.metadata?.plan_tier || 'public';
      const creditsToAdd = parseInt(session.metadata?.credits_to_add || '0', 10);
      const transactionType = session.metadata?.transaction_type || 'TOP_UP';
      const mode = session.mode;
      
      try {
        // ดึงข้อมูล profile ปัจจุบัน
        const { data: profile, error: fetchError } = await supabaseAdmin
          .from('profiles')
          .select('credits')
          .eq('id', userId)
          .single();

        if (fetchError) throw fetchError;

        if (profile) {
          const newCredits = (profile.credits || 0) + creditsToAdd;

          if (mode === 'payment') { 
            // ==========================================
            // กรณี 1: ชำระเงินครั้งเดียว (Payment / Top-up)
            // ==========================================
            
            // อัปเดต Profile
            if (transactionType === 'PLAN_UPGRADE') {
              const { error: updateError } = await supabaseAdmin.from('profiles').update({ 
                plan_tier: planTier, 
                credits: newCredits,
              }).eq('id', userId);
              if (updateError) console.error("Update Profile Error:", updateError);
            } else {
              const { error: updateError } = await supabaseAdmin.from('profiles').update({ 
                credits: newCredits 
              }).eq('id', userId);
              if (updateError) console.error("Update Profile Error:", updateError);
            }

            // บันทึกประวัติลง credit_transactions (ส่วนที่เพิ่มเข้ามา)
            const { error: txError } = await supabaseAdmin.from('credit_transactions').insert({
              user_id: userId,
              amount: creditsToAdd,
              transaction_type: transactionType,
              description: transactionType === 'PLAN_UPGRADE' 
                ? `Upgraded to ${planTier.toUpperCase()} Plan` 
                : `Topped up ${creditsToAdd} credits`,
              // ถ้าในตารางมี 2 คอลัมน์ด้านล่างนี้ แนะนำให้เก็บไว้ใช้ตรวจสอบย้อนหลังครับ:
              // stripe_session_id: session.id, 
              // status: 'completed' 
            });
            if (txError) console.error("Insert Transaction Error (Payment):", txError);

          } else if (mode === 'subscription') {
            // ==========================================
            // กรณี 2: สมัครสมาชิก (Subscription)
            // ==========================================
            let currentPeriodEnd = null;
            if (session.subscription) {
              const subscription = await stripe.subscriptions.retrieve(
                session.subscription as string
              );
              currentPeriodEnd = new Date();
            }

            // อัปเดต Profile
            const { error: profileError } = await supabaseAdmin.from('profiles').update({ 
              plan_tier: planTier, 
              credits: newCredits,
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
              current_period_end: currentPeriodEnd
            }).eq('id', userId);
            if (profileError) console.error("Update Profile Error (Sub):", profileError);

            // บันทึกประวัติลง credit_transactions
            const { error: txError } = await supabaseAdmin.from('credit_transactions').insert({
              user_id: userId,
              amount: creditsToAdd,
              transaction_type: transactionType,
              description: `Subscribed to ${planTier.toUpperCase()} Plan (Sub: ${session.subscription})`
            });
            if (txError) console.error("Insert Transaction Error (Sub):", txError);
          }
        }
      } catch (dbError) {
        console.error("Database operation failed:", dbError);
        // คืนค่า 500 เพื่อให้ Stripe ทราบว่าฝั่งเรามีปัญหา และให้ Stripe ยิง Webhook มาใหม่ในภายหลัง
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
      }
    }
  }

  // คืนค่า 200 เพื่อบอก Stripe ว่ารับข้อความสำเร็จ (สำหรับ Event Type อื่นๆ หรือทำงานเสร็จสิ้น)
  return NextResponse.json({ received: true });
}