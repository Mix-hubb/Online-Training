// API: landing content (banners, texts, footer, partner logos).
import { get } from './client';
import type { Landing } from '@/types';

export const landing = () => get<Landing>('/landing');
