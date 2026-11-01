export type EvaluationStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface MetricResult {
  score?: number | null;
  reason?: string | null;
  error?: string | null;
}

export interface EvaluationResultMetrics {
  answerCorrectness?: MetricResult | null;
  answerRelevance?: MetricResult | null;
  faithfulness?: MetricResult | null;
  contextRelevance?: MetricResult | null;
  contextRecall?: MetricResult | null;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface LatencyBreakdown {
  requestLatencyMs: number;
  geminiLatencyMs: number;
  retrievalLatencyMs: number;
}

export interface EvaluationRun {
  id: string;
  projectId: string;
  datasetId: string;
  ragConfigurationId: string;
  status: EvaluationStatus;
  totalQuestions: number;
  completedQuestions: number;
  failedQuestions: number;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  projectName?: string | null;
  datasetName?: string | null;
  ragConfigurationName?: string | null;

  // Phase 6: Aggregate quality metrics
  overallScore?: number | null;
  averageFaithfulness?: number | null;
  averageAnswerRelevance?: number | null;
  averageContextRelevance?: number | null;
  averageContextRecall?: number | null;
  averageAnswerCorrectness?: number | null;
  averageLatency?: number | null;

  // Phase 10: Production improvements
  promptVersion?: string | null;
  gitCommit?: string | null;
  gitBranch?: string | null;
  prNumber?: number | null;
  tokenUsage?: TokenUsage | null;
  estimatedCostUsd?: number | null;
  qualityGatePassed?: boolean | null;
  regressionDetected?: boolean;
  regressionDetails?: string | null;
}

export interface EvaluationResult {
  id: string;
  runId: string;
  question: string;
  expectedAnswer?: string | null;
  expectedContexts: string[];
  generatedAnswer?: string | null;
  retrievedContexts: string[];
  latencyMs?: number | null;
  status: 'completed' | 'failed';
  error?: string | null;
  createdAt: string;

  // Phase 6: Granular Gemini evaluation metrics
  metrics?: EvaluationResultMetrics | null;

  // Phase 10: Production improvements
  humanScore?: number | null;
  humanFeedback?: string | null;
  annotations?: string[];
  tokenUsage?: TokenUsage | null;
  estimatedCostUsd?: number | null;
  latencyBreakdown?: LatencyBreakdown | null;
}

export interface CreateEvaluationRequest {
  projectId: string;
  datasetId: string;
  ragConfigurationId: string;
  promptVersion?: string | null;
  gitCommit?: string | null;
  gitBranch?: string | null;
  prNumber?: number | null;
}

export interface QualityGateResponse {
  passed: boolean;
  score: number;
  thresholds: Record<string, any>;
  actuals: Record<string, any>;
  failures: string[];
  runId: string;
  status: string;
}

export interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  secretKey?: string | null;
  projectId?: string | null;
  createdAt: string;
  lastUsedAt?: string | null;
  isRevoked: boolean;
}

export interface ProjectThresholds {
  overallScore: number;
  faithfulness: number;
  answerCorrectness: number;
  answerRelevance: number;
  contextRelevance: number;
  contextRecall?: number | null;
  maxLatencyMs?: number | null;
}

export interface WebhookItem {
  id: string;
  projectId: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
  lastTriggeredAt?: string | null;
}

export interface ScheduleItem {
  id: string;
  projectId: string;
  datasetId: string;
  ragConfigurationId: string;
  frequency: string;
  cronExpression?: string | null;
  isActive: boolean;
  createdAt: string;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
}

export interface TrendPoint {
  runId: string;
  createdAt: string;
  overallScore?: number | null;
  faithfulness?: number | null;
  answerCorrectness?: number | null;
  averageLatency?: number | null;
  status: string;
  promptVersion?: string | null;
}

export interface ProjectTrends {
  projectId: string;
  totalRuns: number;
  trends: TrendPoint[];
}
