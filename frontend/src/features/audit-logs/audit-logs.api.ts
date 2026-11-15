import { apiRequest, type ApiEnvelope } from '../../api/client';
import type {
  AuditLogRecord,
  AuditLogsPaginationMeta,
  AuditLogsQueryParams,
} from './types';

export async function getAuditLogsApi(
  params: AuditLogsQueryParams,
  signal?: AbortSignal
): Promise<ApiEnvelope<AuditLogRecord[], AuditLogsPaginationMeta>> {
  return apiRequest<AuditLogRecord[], AuditLogsPaginationMeta>('/audit-logs', {
    method: 'GET',
    query: {
      actor_user_id: params.actor_user_id || undefined,
      action: params.action || undefined,
      entity_name: params.entity_name || undefined,
      from: params.from || undefined,
      to: params.to || undefined,
      page: params.page ?? 1,
      page_size: params.page_size ?? 20,
    },
    signal,
  });
}
