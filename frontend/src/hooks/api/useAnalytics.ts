/**
 * React Query hooks for Analytics / Reporting
 *
 * Endpoints (see backend src/api/routers/analytics.py):
 *   GET  /api/v1/analytics/summary       — overview metrics
 *   GET  /api/v1/analytics/leads         — lead conversion funnel
 *   GET  /api/v1/analytics/trends        — time-series
 *   GET  /api/v1/analytics/campaigns     — campaign performance
 *   GET  /api/v1/analytics/export        — export CSV
 *
 * Voice-specific endpoints (emotions, intents, dialects) were removed when
 * the in-CRM voice module was dropped in favor of the external VoiceFlow SaaS.
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api';
import type { DashboardStats, ApiQueryParams } from '@/types';

export const analyticsKeys = {
  all: ['analytics'] as const,
  dashboard: (params: ApiQueryParams) => [...analyticsKeys.all, 'dashboard', params] as const,
};

export function useAnalyticsSummary(params: ApiQueryParams = {}) {
  return useQuery<DashboardStats>({
    queryKey: analyticsKeys.dashboard(params),
    queryFn: async () => {
      const { data } = await analyticsApi.getDashboard(params);
      return data;
    },
  });
}

export function useExportReport() {
  return useMutation<Blob, Error, ApiQueryParams | undefined>({
    mutationFn: async (params) => {
      const { data } = await analyticsApi.exportReport(params);
      return data;
    },
  });
}
