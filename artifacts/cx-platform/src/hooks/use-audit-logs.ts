import { useGetAuditLogs } from "@workspace/api-client-react";

export function useAuditLogsList() {
  return useGetAuditLogs();
}
