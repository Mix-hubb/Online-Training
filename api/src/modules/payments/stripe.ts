// Stripe client instance (null when STRIPE_SECRET_KEY is not set).
import Stripe from 'stripe';
import { config } from '../../config.js';

export const stripe: Stripe | null = config.stripeEnabled ? new Stripe(config.STRIPE_SECRET_KEY) : null;
