export interface RAGConfiguration {
  id: string;
  projectId: string;
  name: string;
  apiUrl: string;
  method: string;
  headers: Record<string, string>;
  requestTemplate: Record<string, any>;
  answerPath: string;
  contextPath?: string;
  timeoutSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface RAGConfigurationCreatePayload {
  projectId: string;
  name: string;
  apiUrl: string;
  method?: string;
  headers?: Record<string, string>;
  requestTemplate?: Record<string, any>;
  answerPath?: string;
  contextPath?: string;
  timeoutSeconds?: number;
}

export interface RAGConfigurationUpdatePayload {
  name?: string;
  apiUrl?: string;
  method?: string;
  headers?: Record<string, string>;
  requestTemplate?: Record<string, any>;
  answerPath?: string;
  contextPath?: string;
  timeoutSeconds?: number;
}

export interface RAGTestResult {
  success: boolean;
  statusCode?: number;
  answer?: string;
  contexts: string[];
  latencyMs?: number;
  rawResponse?: any;
  error?: string;
}

