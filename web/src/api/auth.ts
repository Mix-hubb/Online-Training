// API: auth (all roles).
import { get, post } from './client';
import type { CurrentUser } from '@/types';

type U = { user: CurrentUser };
export const me = () => get<U>('/auth/me');
export const login = (email: string, password: string) => post<U>('/auth/login', { email, password });
export const register = (name: string, email: string, password: string) => post<{ ok: true; email: string; mailSent: boolean }>('/auth/register', { name, email, password });
export const verifyEmail = (token: string) => post<U>('/auth/verify-email', { token });
export const resendVerification = (email: string) => post('/auth/resend-verification', { email });
export const google = (credential: string) => post<U>('/auth/google', { credential });
export const forgotPassword = (email: string) => post('/auth/forgot-password', { email });
export const resetPassword = (token: string, password: string) => post('/auth/reset-password', { token, password });
export const changePassword = (currentPassword: string | undefined, newPassword: string) => post<U>('/auth/change-password', { currentPassword, newPassword });
export const logout = () => post('/auth/logout');
