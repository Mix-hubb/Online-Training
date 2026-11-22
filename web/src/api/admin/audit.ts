// API: audit log.
import { get } from '../client';
import type { Paged } from '@/types';

export interface AuditRow {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  diff: unknown;
  at: string;
  actor: { id: string; name: string; email: string } | null;
}
export const list = (q: { admin?: string; entity?: string; from?: string; to?: string; page?: number }) => get<Paged<AuditRow>>('/admin/audit', q);
