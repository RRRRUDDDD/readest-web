import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import {
  getStripe,
  createOrUpdatePayment,
  createOrUpdateSubscription,
} from '@/libs/payment/stripe/server';
import { validateUserAndToken } from '@/utils/access';
import { createSupabaseAdminClient } from '@/utils/supabase';

export async function POST(request: Request) {
  const { sessionId } = await request.json();

  const { user, token } = await validateUserAndToken(request.headers.get('authorization'));
  if (!user || !token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 403 });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const customerId = session.customer as string | null;

    const supabase = createSupabaseAdminClient();
    const { data: customerData } = await supabase
      .from('customers')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    const sessionUserId = session.metadata?.['userId'];
    if (
      (sessionUserId && sessionUserId !== user.id) ||
      (customerId && customerData?.stripe_customer_id !== customerId)
    ) {
      return NextResponse.json(
        { error: 'Checkout session does not belong to user' },
        { status: 403 },
      );
    }

    if (!customerId) {
      return NextResponse.json({ error: 'Checkout session is missing customer' }, { status: 400 });
    }

    if (session.payment_status === 'paid' && session.subscription) {
      await createOrUpdateSubscription(user.id, customerId, session.subscription as string);
    } else if (session.payment_status === 'paid' && session.payment_intent) {
      await createOrUpdatePayment(user.id, customerId, sessionId);
    }

    return NextResponse.json({ session });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      console.error('Stripe error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
