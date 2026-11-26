// Which payment methods a course offers (spec 15.6).
//   card       USD (priceMinor) and THB (priceThbMinor, when set)   - Stripe
//   promptpay  THB only                                             - Stripe
//   bank       THB only (Thai bank account; open decision 10.9)     - slip + admin review
//   btc        USD, only when a crypto provider is configured       - open decision 10.6
import type { Course } from '@prisma/client';
import { AppError } from '../../lib/errors.js';
import { cryptoProvider } from '../../providers/payments/index.js';

export type PayMethod = 'card' | 'promptpay' | 'bank' | 'btc';

/** Smallest charge Stripe accepts, in minor units (Stripe "minimum charge amounts"). */
export const STRIPE_MIN = { usd: 50, thb: 1000 } as const;
export type PayCurrency = 'usd' | 'thb';

export interface MethodOption {
  method: PayMethod;
  currency: PayCurrency;
  amountMinor: number;
}

type PriceFields = Pick<Course, 'isFree' | 'priceMinor' | 'priceThbMinor'>;

export function availableMethods(c: PriceFields): MethodOption[] {
  if (c.isFree) return [];
  const out: MethodOption[] = [];
  if (c.priceMinor > 0) out.push({ method: 'card', currency: 'usd', amountMinor: c.priceMinor });
  if (c.priceThbMinor && c.priceThbMinor > 0) {
    out.push({ method: 'card', currency: 'thb', amountMinor: c.priceThbMinor });
    out.push({ method: 'promptpay', currency: 'thb', amountMinor: c.priceThbMinor });
    out.push({ method: 'bank', currency: 'thb', amountMinor: c.priceThbMinor });
  }
  if (cryptoProvider.enabled && c.priceMinor > 0) out.push({ method: 'btc', currency: 'usd', amountMinor: c.priceMinor });
  return out;
}

export function resolveMethod(c: PriceFields, method: PayMethod, currency: PayCurrency): MethodOption {
  const found = availableMethods(c).find((m) => m.method === method && m.currency === currency);
  if (!found) {
    const msg = method === 'promptpay' && currency !== 'thb' ? 'PromptPay is only available in THB' : 'This payment method is not available';
    throw new AppError('PAYMENT_METHOD_UNAVAILABLE', 400, msg);
  }
  return found;
}
