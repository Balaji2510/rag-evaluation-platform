export interface DatasetItem {
  id: string;
  datasetId: string;
  question: string;
  expectedAnswer: string;
  expectedContexts: string[];
  metadata: Record<string, any>;
  createdAt: string;
}

export interface DatasetItemCreatePayload {
  question: string;
  expectedAnswer: string;
  expectedContexts?: string[];
  metadata?: Record<string, any>;
}

export interface DatasetItemUpdatePayload {
  question?: string;
  expectedAnswer?: string;
  expectedContexts?: string[];
  metadata?: Record<string, any>;
}

export interface Dataset {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  itemCount?: number;
}

export interface DatasetDetail extends Dataset {
  items: DatasetItem[];
}

export interface DatasetCreatePayload {
  name: string;
  description?: string;
}

export interface DatasetImportPayload {
  items: DatasetItemCreatePayload[];
}

export interface DatasetImportResult {
  importedCount: number;
  datasetId: string;
}

