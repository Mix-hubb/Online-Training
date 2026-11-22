// API: orders.
import { get } from './client';
import type { Order } from '@/types';

export const myOrders = () => get<Order[]>('/orders');
export const bySession = (sessionId: string) => get<Order>(`/orders/by-session/${sessionId}`);
export const order = (id: string) => get<Order>(`/orders/${id}`);
