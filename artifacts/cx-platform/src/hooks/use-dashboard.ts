import { useGetDashboardMetrics, useGetDashboardTrend } from "@workspace/api-client-react";

export function useDashboard() {
  const { data: metrics, isLoading: isMetricsLoading } = useGetDashboardMetrics();
  const { data: trends, isLoading: isTrendsLoading } = useGetDashboardTrend();

  return {
    metrics,
    trends,
    isLoading: isMetricsLoading || isTrendsLoading,
  };
}
