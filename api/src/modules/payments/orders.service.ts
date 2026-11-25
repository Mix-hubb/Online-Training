// Order logic shared by checkout routes.
import type { Course, Order, User } from '@prisma/client';
import { prisma } from '../../db.js';
import { config } from '../../config.js';
import { AppError } from '../../lib/errors.js';
import { markOrderPaid } from '../../lib/order-paid.js';
import { cryptoProvider } from '../../providers/payments/index.js';
import { resolveMethod, type PayCurrency, type PayMethod } from './checkout-methods.js';
import { stripe } from './stripe.js';

export async function loadPurchasable(courseId: string, userId: string): Promise<Course> {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course || course.status === 'DRAFT') throw new AppError('NOT_FOUND', 404);
  if (course.status !== 'PUBLISHED') throw new AppError('COURSE_UNAVAILABLE', 410);
  if (course.isFree) throw new AppError('VALIDATION_FAILED', 400, 'This course is free, enroll instead');
  const owned = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
  if (owned) throw new AppError('ALREADY_ENROLLED', 409);
  return course;
}

export function orderView(o: Order & { course?: { title: string; slug: string } | null }) {
  return {
    id: o.id,
    status: o.status,
    amountMinor: o.amountMinor,
    currency: o.currency,
    provider: o.provider,
    method: o.method,
    receiptUrl: o.receiptUrl,
    createdAt: o.createdAt,
    paidAt: o.paidAt,
    expiresAt: o.expiresAt,
    course: o.course ? { title: o.course.title, slug: o.course.slug } : undefined,
  };
}

/** Card / PromptPay through Stripe Checkout, or Bitcoin through the crypto provider. Returns the URL to redirect to. */
export async function startCheckout(user: User, courseId: string, method: PayMethod, currency: PayCurrency) {
  const course = await loadPurchasable(courseId, user.id);
  if (method === 'bank') throw new AppError('VALIDATION_FAILED', 400, 'Use the bank transfer checkout');
  const option = resolveMethod(course, method, currency);

  if (method === 'btc') {
    const order = await prisma.order.create({
      data: { userId: user.id, courseId, amountMinor: option.amountMinor, currency, provider: 'CRYPTO', method: 'btc' },
    });
    const charge = await cryptoProvider.createCharge({ orderId: order.id, amountMinor: option.amountMinor, currency });
    await prisma.order.update({ where: { id: order.id }, data: { providerRef: charge.providerChargeId } });
    return { orderId: order.id, url: charge.checkoutUrl };
  }

  // Check before creating the order, or every click while Stripe is not set up leaves a stray PENDING order.
  if (!stripe && !config.DEV_FAKE_PAYMENTS) throw new AppError('PAYMENT_METHOD_UNAVAILABLE', 503, 'Card payments are not set up');
  const order = await prisma.order.create({
    data: { userId: user.id, courseId, amountMinor: option.amountMinor, currency, provider: 'STRIPE', method },
  });
  const successUrl = `${config.WEB_URL}/checkout/return?session_id={CHECKOUT_SESSION_ID}`;

  if (!stripe) {
    // Local development only: pretend Stripe confirmed the payment.
    const sessionId = `dev_${order.id}`;
    await prisma.order.update({ where: { id: order.id }, data: { stripeSessionId: sessionId } });
    await markOrderPaid(order.id, { receiptUrl: null });
    return { orderId: order.id, url: successUrl.replace('{CHECKOUT_SESSION_ID}', sessionId) };
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: [method === 'promptpay' ? 'promptpay' : 'card'],
    customer_email: user.email,
    client_reference_id: order.id,
    metadata: { orderId: order.id },
    payment_intent_data: { metadata: { orderId: order.id } },
    line_items: [
      {
        quantity: 1,
        price_data: { currency, unit_amount: option.amountMinor, product_data: { name: course.title } },
      },
    ],
    success_url: successUrl,
    cancel_url: `${config.WEB_URL}/courses/${course.slug}?checkout=cancelled`,
  });
  await prisma.order.update({ where: { id: order.id }, data: { stripeSessionId: session.id } });
  return { orderId: order.id, url: session.url };
}
