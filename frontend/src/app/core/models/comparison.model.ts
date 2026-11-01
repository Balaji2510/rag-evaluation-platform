export interface ComparisonRunMeta {
  id: string;
  projectId: string;
  datasetId: string;
  ragConfigurationId: string;
  status: string;
  totalQuestions: number;
  completedQuestions: number;
  failedQuestions: number;
  projectName?: string | null;
  datasetName?: string | null;
  ragConfigurationName?: string | null;
  createdAt: string;
}

export interface MetricComparison {
  key: string;
  name: string;
  runA: number | null;
  runB: number | null;
  absoluteDifference: number | null;
  percentageDifference: number | null;
  status: 'improved' | 'regressed' | 'no-change';
  higherIsBetter: boolean;
  formattedChange: string;
  unit?: string | null;
}

export interface ComparisonRequest {
  runA: string;
  runB: string;
}

export interface ComparisonResponse {
  runA: ComparisonRunMeta;
  runB: ComparisonRunMeta;
  metrics: MetricComparison[];
  improvedCount: number;
  regressedCount: number;
  unchangedCount: number;
  improvedMetrics: string[];
  regressedMetrics: string[];
  unchangedMetrics: string[];
  summary: string;
}

