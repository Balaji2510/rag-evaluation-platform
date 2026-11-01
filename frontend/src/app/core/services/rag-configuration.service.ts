import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  RAGConfiguration,
  RAGConfigurationCreatePayload,
  RAGConfigurationUpdatePayload,
  RAGTestResult,
} from '../models/rag-configuration.model';

@Injectable({
  providedIn: 'root',
})
export class RAGConfigurationService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  listConfigurations(projectId?: string): Observable<RAGConfiguration[]> {
    let params = new HttpParams();
    if (projectId) {
      params = params.set('projectId', projectId);
    }
    return this.http.get<RAGConfiguration[]>(`${this.apiUrl}/rag-configurations`, { params });
  }

  createConfiguration(payload: RAGConfigurationCreatePayload): Observable<RAGConfiguration> {
    return this.http.post<RAGConfiguration>(`${this.apiUrl}/rag-configurations`, payload);
  }

  getConfiguration(id: string): Observable<RAGConfiguration> {
    return this.http.get<RAGConfiguration>(`${this.apiUrl}/rag-configurations/${id}`);
  }

  updateConfiguration(
    id: string,
    payload: RAGConfigurationUpdatePayload
  ): Observable<RAGConfiguration> {
    return this.http.put<RAGConfiguration>(`${this.apiUrl}/rag-configurations/${id}`, payload);
  }

  deleteConfiguration(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.apiUrl}/rag-configurations/${id}`
    );
  }

  testConfiguration(id: string, sampleQuestion?: string): Observable<RAGTestResult> {
    const body = sampleQuestion ? { sampleQuestion } : {};
    return this.http.post<RAGTestResult>(`${this.apiUrl}/rag-configurations/${id}/test`, body);
  }
}

