export interface CanvasCourse {
  readonly id: number;
  readonly name: string;
  readonly course_code?: string;
  readonly workflow_state?: string;
}

export interface CanvasAssignment {
  readonly id: number;
  readonly name: string;
  readonly description?: string | null;
  readonly due_at?: string | null;
  readonly points_possible?: number;
  readonly course_id: number;
  readonly html_url?: string;
}

export interface CanvasAnnouncement {
  readonly id: number;
  readonly title: string;
  readonly message: string;
  readonly posted_at: string;
  readonly context_code?: string;
}

export interface ShadowingResult {
  readonly sessionNonce: string;
  readonly coursesChecked: number;
  readonly recentAnnouncementsCount: number;
  readonly upcomingAssignmentsCount: number;
  readonly summaryMarkdown: string;
  readonly modelId: string;
}
