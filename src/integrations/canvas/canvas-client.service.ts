import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import { CanvasApiError, CanvasRateLimitError } from './errors';
import type {
  CanvasAnnouncement,
  CanvasAssignment,
  CanvasCourse,
} from './types';

// Rate Limit estricto: máximo 30 requerimientos por minuto (PROMPTS.md 3.1)
const MAX_REQUESTS_PER_MINUTE = 30;
const ONE_MINUTE_MS = 60 * 1000;

@Injectable()
export class CanvasClientService {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly requestTimestamps: number[] = [];

  constructor(private readonly configService: ConfigService<Env, true>) {
    const rawUrl = this.configService.get('CANVAS_BASE_URL', { infer: true });
    this.baseUrl = rawUrl.replace(/\/+$/, '');
    this.token = this.configService.get('CANVAS_API_TOKEN', { infer: true });
  }

  /**
   * Control de tasa en ventana deslizante de 60 segundos (30 req/min).
   */
  private checkRateLimit(): void {
    const now = Date.now();
    // Limpiar timestamps más antiguos a 1 minuto
    while (
      this.requestTimestamps.length > 0 &&
      this.requestTimestamps[0]! <= now - ONE_MINUTE_MS
    ) {
      this.requestTimestamps.shift();
    }

    if (this.requestTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
      throw new CanvasRateLimitError();
    }

    this.requestTimestamps.push(now);
  }

  private async fetchCanvas<T>(endpoint: string): Promise<T> {
    this.checkRateLimit();

    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new CanvasApiError(response.status, errorText);
    }

    return (await response.json()) as T;
  }

  /**
   * Obtiene la lista de cursos activos del usuario.
   */
  async getActiveCourses(): Promise<readonly CanvasCourse[]> {
    return this.fetchCanvas<CanvasCourse[]>(
      '/api/v1/courses?enrollment_state=active&per_page=50',
    );
  }

  /**
   * Obtiene las tareas próximas de un curso o de todos los cursos.
   */
  async getUpcomingAssignments(
    courseId?: number,
  ): Promise<readonly CanvasAssignment[]> {
    if (courseId !== undefined) {
      return this.fetchCanvas<CanvasAssignment[]>(
        `/api/v1/courses/${courseId}/assignments?bucket=upcoming&per_page=50`,
      );
    }
    return this.fetchCanvas<CanvasAssignment[]>(
      '/api/v1/users/self/upcoming_events?per_page=50',
    );
  }

  /**
   * Obtiene los anuncios publicados a partir de una fecha determinada.
   */
  async getCourseAnnouncements(
    courseIds: readonly number[],
    sinceDate: Date,
  ): Promise<readonly CanvasAnnouncement[]> {
    if (courseIds.length === 0) {
      return [];
    }

    const contextParams = courseIds
      .map((id) => `context_codes[]=course_${id}`)
      .join('&');
    const startDateParam = `start_date=${encodeURIComponent(sinceDate.toISOString())}`;
    const endpoint = `/api/v1/announcements?${contextParams}&${startDateParam}&per_page=50`;

    return this.fetchCanvas<CanvasAnnouncement[]>(endpoint);
  }
}
