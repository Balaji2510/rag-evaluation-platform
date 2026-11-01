import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiKeyItem,
  CreateEvaluationRequest,
  EvaluationResult,
  EvaluationRun,
  ProjectThresholds,
  ProjectTrends,
  QualityGateResponse,
  ScheduleItem,
  WebhookItem,
} from '../models/evaluation.model';

@Injectable({
  providedIn: 'root',
})
export class EvaluationService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  startEvaluation(payload: CreateEvaluationRequest): Observable<EvaluationRun> {
    return this.http.post<EvaluationRun>(`${this.apiUrl}/evaluations`, payload);
  }

  listEvaluations(projectId?: string): Observable<EvaluationRun[]> {
    let params = new HttpParams();
    if (projectId) {
      params = params.set('projectId', projectId);
    }
    return this.http.get<EvaluationRun[]>(`${this.apiUrl}/evaluations`, { params });
  }

  getEvaluation(id: string): Observable<EvaluationRun> {
    return this.http.get<EvaluationRun>(`${this.apiUrl}/evaluations/${id}`);
  }

  getEvaluationResults(id: string): Observable<EvaluationResult[]> {
    return this.http.get<EvaluationResult[]>(`${this.apiUrl}/evaluations/${id}/results`);
  }

  getSingleEvaluationResult(
    runId: string,
    resultId: string
  ): Observable<EvaluationResult> {
    return this.http.get<EvaluationResult>(
      `${this.apiUrl}/evaluations/${runId}/results/${resultId}`
    );
  }

  cancelEvaluation(id: string): Observable<EvaluationRun> {
    return this.http.post<EvaluationRun>(`${this.apiUrl}/evaluations/${id}/cancel`, {});
  }

  // --- Phase 10: Production Enterprise Features ---

  evaluateQualityGate(runId: string, overrides?: any): Observable<QualityGateResponse> {
    return this.http.post<QualityGateResponse>(
      `${this.apiUrl}/evaluations/${runId}/quality-gate`,
      overrides || {}
    );
  }

  exportCsv(runId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/evaluations/${runId}/export/csv`, {
      responseType: 'blob',
    });
  }

  exportJson(runId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/evaluations/${runId}/export/json`);
  }

  submitHumanEval(
    runId: string,
    resultId: string,
    humanScore: number,
    humanFeedback?: string
  ): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/evaluations/${runId}/results/${resultId}/human-eval`,
      { humanScore, humanFeedback }
    );
  }

  submitAnnotations(
    runId: string,
    resultId: string,
    annotations: string[]
  ): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/evaluations/${runId}/results/${resultId}/annotations`,
      { annotations }
    );
  }

  getProjectThresholds(projectId: string): Observable<ProjectThresholds> {
    return this.http.get<ProjectThresholds>(`${this.apiUrl}/projects/${projectId}/thresholds`);
  }

  updateProjectThresholds(projectId: string, thresholds: ProjectThresholds): Observable<ProjectThresholds> {
    return this.http.put<ProjectThresholds>(`${this.apiUrl}/projects/${projectId}/thresholds`, thresholds);
  }

  getProjectWebhooks(projectId: string): Observable<WebhookItem[]> {
    return this.http.get<WebhookItem[]>(`${this.apiUrl}/projects/${projectId}/webhooks`);
  }

  createWebhook(projectId: string, payload: { url: string; secret?: string; events?: string[] }): Observable<WebhookItem> {
    return this.http.post<WebhookItem>(`${this.apiUrl}/projects/${projectId}/webhooks`, payload);
  }

  deleteWebhook(projectId: string, webhookId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/projects/${projectId}/webhooks/${webhookId}`);
  }

  getProjectSchedules(projectId: string): Observable<ScheduleItem[]> {
    return this.http.get<ScheduleItem[]>(`${this.apiUrl}/projects/${projectId}/schedules`);
  }

  createSchedule(projectId: string, payload: any): Observable<ScheduleItem> {
    return this.http.post<ScheduleItem>(`${this.apiUrl}/projects/${projectId}/schedules`, payload);
  }

  deleteSchedule(projectId: string, scheduleId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/projects/${projectId}/schedules/${scheduleId}`);
  }

  getProjectTrends(projectId: string): Observable<ProjectTrends> {
    return this.http.get<ProjectTrends>(`${this.apiUrl}/projects/${projectId}/trends`);
  }

  getApiKeys(): Observable<ApiKeyItem[]> {
    return this.http.get<ApiKeyItem[]>(`${this.apiUrl}/api-keys`);
  }

  createApiKey(payload: { name: string; projectId?: string }): Observable<ApiKeyItem> {
    return this.http.post<ApiKeyItem>(`${this.apiUrl}/api-keys`, payload);
  }

  revokeApiKey(keyId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/api-keys/${keyId}`);
  }
}
