// Active CryptoPaymentProvider. The Bitcoin provider is not chosen yet (open decision 10.6),
// so Bitcoin checkout answers PAYMENT_METHOD_UNAVAILABLE until a real provider is plugged in here.
import type { CryptoPaymentProvider } from './CryptoPaymentProvider.js';
import { AppError } from '../../lib/errors.js';

class NotConfiguredCryptoProvider implements CryptoPaymentProvider {
  async createCharge(): Promise<never> {
    throw new AppError('PAYMENT_METHOD_UNAVAILABLE', 400, 'Bitcoin payments are not set up yet');
  }
  async verifyWebhook(): Promise<never> {
    throw new AppError('PAYMENT_METHOD_UNAVAILABLE', 400, 'Bitcoin payments are not set up yet');
  }
}

export const cryptoProvider: CryptoPaymentProvider & { enabled: boolean } = Object.assign(new NotConfiguredCryptoProvider(), {
  enabled: false,
});
