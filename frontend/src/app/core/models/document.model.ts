export interface ProjectDocument {
  id: string;
  projectId: string;
  filename: string;
  contentType: string;
  metadata: Record<string, any>;
  chunkCount: number;
  createdAt: string;
}

export interface InternalRAGConfig {
  projectId: string;
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  indexName: string;
  embeddingModel: string;
}

export interface InternalRAGQueryResponse {
  answer: string;
  contexts: string[];
}

