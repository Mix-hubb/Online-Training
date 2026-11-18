// Bitcoin provider interface (provider not chosen, open decision 10.6).
// TODO: createCharge(order) -> hosted payment URL
// TODO: verifyWebhook(rawBody, headers) -> { orderId, status }

export interface CryptoPaymentProvider {
  createCharge(input: { orderId: string; amountMinor: number; currency: string }): Promise<{ checkoutUrl: string; providerChargeId: string }>;
  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): Promise<{ providerChargeId: string; status: 'PAID' | 'EXPIRED' | 'PENDING' }>;
}
