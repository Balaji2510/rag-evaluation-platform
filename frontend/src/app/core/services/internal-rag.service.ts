import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  InternalRAGConfig,
  InternalRAGQueryResponse,
  ProjectDocument,
} from '../models/document.model';

@Injectable({
  providedIn: 'root',
})
export class InternalRAGService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  uploadDocument(projectId: string, file: File): Observable<ProjectDocument> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<ProjectDocument>(
      `${this.apiUrl}/projects/${projectId}/documents`,
      formData
    );
  }

  listDocuments(projectId: string): Observable<ProjectDocument[]> {
    return this.http.get<ProjectDocument[]>(
      `${this.apiUrl}/projects/${projectId}/documents`
    );
  }

  deleteDocument(projectId: string, documentId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/projects/${projectId}/documents/${documentId}`
    );
  }

  getRAGSettings(projectId: string): Observable<InternalRAGConfig> {
    return this.http.get<InternalRAGConfig>(
      `${this.apiUrl}/projects/${projectId}/rag-settings`
    );
  }

  updateRAGSettings(
    projectId: string,
    settings: { chunkSize?: number; chunkOverlap?: number; topK?: number }
  ): Observable<InternalRAGConfig> {
    return this.http.put<InternalRAGConfig>(
      `${this.apiUrl}/projects/${projectId}/rag-settings`,
      settings
    );
  }

  queryInternalRAG(
    projectId: string,
    question: string
  ): Observable<InternalRAGQueryResponse> {
    return this.http.post<InternalRAGQueryResponse>(
      `${this.apiUrl}/projects/${projectId}/query`,
      { question }
    );
  }
}

