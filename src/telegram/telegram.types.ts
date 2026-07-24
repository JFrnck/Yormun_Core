export interface PendingTaskSummary {
  requestId: string;
  toolName: string;
  planSummary: string;
  externalInputsSummary: string | null;
  createdAt: Date;
}
