/**
 * React Query API Hooks — Barrel Export
 *
 * Usage:
 *   import { useLeads, useCreateLead, useDashboardStats } from '@/hooks/api';
 *
 * All hooks follow the React Query pattern:
 *   - useXxx() / useXxx(id)       — queries (auto-fetching)
 *   - useCreateXxx()              — create mutations
 *   - useUpdateXxx()              — update mutations
 *   - useDeleteXxx()              — delete mutations
 *
 * KB-008: Zero 'any' types across all hook files.
 */

// ── Auth ──
export {
  useCurrentUser,
  useUpdateProfile,
  authKeys,
  type UpdateProfilePayload,
} from './useAuth';

// ── CRM: Leads ──
export {
  useLeads,
  useLead,
  useLeadPipeline,
  useCreateLead,
  useUpdateLead,
  useDeleteLead,
  useImportLeads,
  useExportLeads,
  leadKeys,
  type UseLeadsParams,
} from './useLeads';

// ── CRM: Companies ──
export {
  useCompanies,
  useCompany,
  useCreateCompany,
  useUpdateCompany,
  useDeleteCompany,
  companyKeys,
  type CompanyCreatePayload,
} from './useCompanies';

// ── CRM: Contacts ──
export {
  useContacts,
  useContact,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
  contactKeys,
  type ContactCreatePayload,
} from './useContacts';

// ── CRM: Deals ──
export {
  useDeals,
  useDeal,
  useCreateDeal,
  useUpdateDeal,
  useDeleteDeal,
  dealKeys,
  type UseDealsParams,
  type DealCreatePayload,
} from './useDeals';

// ── CRM: Activities ──
export {
  useActivities,
  useCreateActivity,
  useUpdateActivity,
  useDeleteActivity,
  activityKeys,
  type UseActivitiesParams,
  type ActivityCreatePayload,
} from './useActivities';

// ── Campaigns ──
export {
  useCampaigns,
  useCampaign,
  useCreateCampaign,
  useUpdateCampaign,
  useDeleteCampaign,
  useStartCampaign,
  usePauseCampaign,
  useResumeCampaign,
  useStopCampaign,
  campaignKeys,
  type UseCampaignsParams,
  type CampaignCreatePayload,
} from './useCampaigns';

// ── Analytics ──
export {
  useAnalyticsSummary,
  useExportReport,
  analyticsKeys,
} from './useAnalytics';

// ── Help Desk: Tickets ──
export {
  useTickets,
  useTicket,
  useCreateTicket,
  useUpdateTicket,
  useUpdateTicketStatus,
  useAssignTicket,
  useReplyToTicket,
  ticketKeys,
  type UseTicketsParams,
  type TicketCreatePayload,
} from './useTickets';

// ── Surveys ──
export {
  useSurveys,
  useSurvey,
  useSurveyResponses,
  useCreateSurvey,
  useUpdateSurvey,
  useDeleteSurvey,
  surveyKeys,
  type SurveyCreatePayload,
} from './useSurveys';

// ── Billing ──
export {
  usePlans,
  useUsage,
  useInvoices,
  useSubscribe,
  useAddCredits,
  useVerifyPayment,
  billingKeys,
  type BillingPlan,
  type Subscription,
  type UsageStats,
  type Invoice,
  type SubscribePayload,
  type SubscribeResponse,
  type AddCreditsPayload,
  type VerifyPaymentPayload,
  type VerifyPaymentResponse,
} from './useBilling';

// ── Lead Sources ──
export {
  useLeadSourceConfigs,
  useLeadSourceStats,
  useCreateLeadSourceConfig,
  useUpdateLeadSourceConfig,
  useDeleteLeadSourceConfig,
  usePollIndiamart,
  leadSourceKeys,
} from './useLeadSources';

// ── Dashboard ──
export {
  useDashboardStats,
  useCRMDashboardStats,
  dashboardKeys,
  type CRMDashboardStats,
} from './useDashboard';

// ── PEB Quotation ──
export {
  useQuotations,
  useQuotation,
  useQuotationStats,
  useQuotationLogs,
  useQuotationsByLead,
  useCalculateBOQ,
  useCreateQuotation,
  useUpdateQuotation,
  useDeleteQuotation,
  useGeneratePdf,
  useReviseQuotation,
  useChangeQuotationStatus,
  quotationKeys,
} from './useQuotation';
