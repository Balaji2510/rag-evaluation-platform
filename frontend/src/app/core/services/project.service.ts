import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Project, ProjectCreatePayload, ProjectUpdatePayload } from '../models/project.model';
import { Dataset, DatasetCreatePayload } from '../models/dataset.model';

@Injectable({
  providedIn: 'root',
})
export class ProjectService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  listProjects(): Observable<Project[]> {
    return this.http.get<Project[]>(`${this.apiUrl}/projects`);
  }

  createProject(payload: ProjectCreatePayload): Observable<Project> {
    return this.http.post<Project>(`${this.apiUrl}/projects`, payload);
  }

  getProject(id: string): Observable<Project> {
    return this.http.get<Project>(`${this.apiUrl}/projects/${id}`);
  }

  updateProject(id: string, payload: ProjectUpdatePayload): Observable<Project> {
    return this.http.put<Project>(`${this.apiUrl}/projects/${id}`, payload);
  }

  deleteProject(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/projects/${id}`);
  }

  listDatasets(projectId: string): Observable<Dataset[]> {
    return this.http.get<Dataset[]>(`${this.apiUrl}/projects/${projectId}/datasets`);
  }

  createDataset(projectId: string, payload: DatasetCreatePayload): Observable<Dataset> {
    return this.http.post<Dataset>(`${this.apiUrl}/projects/${projectId}/datasets`, payload);
  }
}

