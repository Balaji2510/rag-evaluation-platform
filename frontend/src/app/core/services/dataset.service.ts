import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  DatasetDetail,
  DatasetImportPayload,
  DatasetImportResult,
  DatasetItem,
  DatasetItemCreatePayload,
  DatasetItemUpdatePayload,
} from '../models/dataset.model';

@Injectable({
  providedIn: 'root',
})
export class DatasetService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getDataset(id: string): Observable<DatasetDetail> {
    return this.http.get<DatasetDetail>(`${this.apiUrl}/datasets/${id}`);
  }

  addItem(datasetId: string, payload: DatasetItemCreatePayload): Observable<DatasetItem> {
    return this.http.post<DatasetItem>(`${this.apiUrl}/datasets/${datasetId}/items`, payload);
  }

  updateItem(
    datasetId: string,
    itemId: string,
    payload: DatasetItemUpdatePayload
  ): Observable<DatasetItem> {
    return this.http.put<DatasetItem>(`${this.apiUrl}/datasets/${datasetId}/items/${itemId}`, payload);
  }

  deleteItem(
    datasetId: string,
    itemId: string
  ): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.apiUrl}/datasets/${datasetId}/items/${itemId}`
    );
  }

  importItems(
    datasetId: string,
    payload: DatasetImportPayload
  ): Observable<DatasetImportResult> {
    return this.http.post<DatasetImportResult>(
      `${this.apiUrl}/datasets/${datasetId}/import`,
      payload
    );
  }
}

