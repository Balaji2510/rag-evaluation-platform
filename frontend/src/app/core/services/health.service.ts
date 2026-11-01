import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface HealthStatus {
  status: string;
}

export interface DatabaseHealth {
  status: string;
  connected: boolean;
  database?: string;
  error?: string;
}

export interface DetailedHealthStatus {
  status: string;
  database: DatabaseHealth;
}

@Injectable({
  providedIn: 'root',
})
export class HealthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getHealth(): Observable<HealthStatus> {
    return this.http.get<HealthStatus>(`${this.apiUrl}/health`);
  }

  getDetailedHealth(): Observable<DetailedHealthStatus> {
    return this.http.get<DetailedHealthStatus>(`${this.apiUrl}/health/details`);
  }
}

