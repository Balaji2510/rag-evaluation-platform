import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ComparisonRequest, ComparisonResponse } from '../models/comparison.model';

@Injectable({
  providedIn: 'root',
})
export class ComparisonService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  compareRuns(payload: ComparisonRequest): Observable<ComparisonResponse> {
    return this.http.post<ComparisonResponse>(`${this.apiUrl}/comparisons`, payload);
  }
}

