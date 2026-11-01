import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  EvaluationResult,
  EvaluationRun,
} from '../../../core/models/evaluation.model';
import { EvaluationService } from '../../../core/services/evaluation.service';

type FilterType =
  | 'all'
  | 'passed'
  | 'failed'
  | 'low_faithfulness'
  | 'low_correctness'
  | 'low_context_relevance'
  | 'slow';

@Component({
  selector: 'app-evaluation-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="evaluation-detail-page">
      <!-- Breadcrumbs -->
      <div class="breadcrumbs">
        <a routerLink="/evaluations">Evaluations</a>
        <span class="sep">/</span>
        <span class="current">Run {{ runId.slice(0, 8) }}</span>
      </div>

      <!-- Loading State -->
      @if (loadingRun()) {
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading evaluation run overview...</p>
        </div>
      } @else if (runError()) {
        <div class="error-banner">
          <p>{{ runError() }}</p>
          <a routerLink="/evaluations" class="btn btn-sm btn-secondary">Back to Evaluations</a>
        </div>
      } @else if (run(); as r) {
        <!-- Overview Header Card -->
        <div class="overview-header-card">
          <div class="header-main">
            <div>
              <div class="title-row">
                <h1>{{ r.projectName || 'Evaluation Run' }}</h1>
                <span class="status-badge" [ngClass]="'status-' + r.status">
                  @if (r.status === 'running') {
                    <span class="pulsing-dot"></span>
                  }
                  {{ r.status.toUpperCase() }}
                </span>
              </div>
              <p class="run-sub">
                Dataset: <strong>{{ r.datasetName || r.datasetId }}</strong> •
                RAG Pipeline: <strong>{{ r.ragConfigurationName || r.ragConfigurationId }}</strong>
              </p>
            </div>

            <div class="header-actions">
              <button (click)="exportCsv()" class="btn btn-secondary btn-sm" title="Export CSV">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                CSV
              </button>
              <button (click)="exportJson()" class="btn btn-secondary btn-sm" title="Export JSON">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                JSON
              </button>
              @if (r.status === 'running' || r.status === 'pending') {
                <button (click)="cancelRun()" class="btn btn-secondary btn-sm" [disabled]="cancelling()" style="color: #f87171; border-color: rgba(239, 68, 68, 0.4);" title="Cancel execution">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                  </svg>
                  {{ cancelling() ? 'Cancelling...' : 'Cancel' }}
                </button>
              }
              <button (click)="refreshData()" class="btn btn-secondary btn-sm" title="Refresh">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M23 4v6h-6"></path>
                  <path d="M1 20v-6h6"></path>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
                Refresh
              </button>
            </div>
          </div>

          <!-- Quality Gate & Regression Badges -->
          @if (r.regressionDetected) {
            <div class="alert-banner alert-warning" style="margin-top: 12px; padding: 10px 14px; background: rgba(245, 158, 11, 0.1); border: 1px solid #f59e0b; border-radius: 6px; color: #f59e0b;">
              <strong>⚠️ Quality Regression Detected:</strong> {{ r.regressionDetails || 'Performance dropped compared to previous baseline.' }}
            </div>
          }
          @if (r.qualityGatePassed !== undefined && r.qualityGatePassed !== null) {
            <div style="margin-top: 10px; display: flex; align-items: center; gap: 8px;">
              <span class="badge" [style.background]="r.qualityGatePassed ? '#059669' : '#dc2626'" style="color: white; padding: 4px 10px; border-radius: 4px; font-weight: 600; font-size: 12px;">
                Quality Gate: {{ r.qualityGatePassed ? 'PASSED' : 'FAILED' }}
              </span>
              @if (r.tokenUsage) {
                <span style="font-size: 13px; color: #94a3b8;">
                  Tokens: <strong>{{ r.tokenUsage.totalTokens | number }}</strong>
                  ({{ r.tokenUsage.inputTokens | number }} in / {{ r.tokenUsage.outputTokens | number }} out)
                </span>
              }
              @if (r.estimatedCostUsd) {
                <span style="font-size: 13px; color: #94a3b8;">
                  • Est. Gemini Cost: <strong>\${{ r.estimatedCostUsd | number:'1.4-4' }}</strong>
                </span>
              }
              @if (r.promptVersion) {
                <span style="font-size: 13px; color: #94a3b8;">
                  • Prompt: <strong>{{ r.promptVersion }}</strong>
                </span>
              }
              @if (r.gitCommit) {
                <span style="font-size: 13px; color: #94a3b8;">
                  • Git: <code>{{ r.gitCommit.slice(0, 7) }}</code>
                </span>
              }
            </div>
          }

          <div class="header-meta-row">
            <span>Started: {{ r.startedAt ? (r.startedAt | date:'medium') : (r.createdAt | date:'medium') }}</span>
            @if (r.completedAt) {
              <span>• Completed: {{ r.completedAt | date:'medium' }}</span>
            }
            <span>• Total Questions: <strong>{{ r.totalQuestions }}</strong></span>
            <span>• Successful: <strong>{{ r.totalQuestions - r.failedQuestions }}</strong></span>
            @if (r.failedQuestions > 0) {
              <span class="meta-failed">• Failed: <strong>{{ r.failedQuestions }}</strong></span>
            }
          </div>
        </div>

        <!-- In-progress Live Banner -->
        @if (r.status === 'running' || r.status === 'pending') {
          <div class="active-progress-banner">
            <div class="progress-info-row">
              <span class="progress-status-text">
                <span class="pulsing-dot"></span>
                Evaluating questions in background with Google Gemini...
              </span>
              <span class="progress-counter">
                <strong>{{ r.completedQuestions }}</strong> / {{ r.totalQuestions }} questions
                @if (r.failedQuestions > 0) {
                  <span class="failed-counter">({{ r.failedQuestions }} failed)</span>
                }
              </span>
            </div>
            <div class="progress-bar-bg">
              <div
                class="progress-bar-fill"
                [style.width.%]="r.totalQuestions > 0 ? ((r.completedQuestions / r.totalQuestions) * 100) : 0"
              ></div>
            </div>
          </div>
        }

        <!-- Metric Cards Grid -->
        <div class="metric-cards-grid">
          <!-- Overall Quality Score -->
          <div class="metric-card" [ngClass]="getScoreTierClass(r.overallScore)">
            <div class="metric-card-header">
              <span class="card-title">Overall Score</span>
              <span class="tier-pill">{{ getTierLabel(r.overallScore) }}</span>
            </div>
            <div class="metric-number">
              {{ r.overallScore !== null && r.overallScore !== undefined ? ((r.overallScore * 100) | number:'1.0-0') + '%' : 'N/A' }}
            </div>
            <p class="metric-desc">Blended average across all evaluated quality dimensions</p>
          </div>

          <!-- Faithfulness -->
          <div class="metric-card" [ngClass]="getScoreTierClass(r.averageFaithfulness)">
            <div class="metric-card-header">
              <span class="card-title">Faithfulness</span>
              <span class="tier-pill">{{ getTierLabel(r.averageFaithfulness) }}</span>
            </div>
            <div class="metric-number">
              {{ r.averageFaithfulness !== null && r.averageFaithfulness !== undefined ? ((r.averageFaithfulness * 100) | number:'1.0-0') + '%' : 'N/A' }}
            </div>
            <p class="metric-desc">Groundedness in context; zero hallucination verification</p>
          </div>

          <!-- Answer Relevance -->
          <div class="metric-card" [ngClass]="getScoreTierClass(r.averageAnswerRelevance)">
            <div class="metric-card-header">
              <span class="card-title">Answer Relevance</span>
              <span class="tier-pill">{{ getTierLabel(r.averageAnswerRelevance) }}</span>
            </div>
            <div class="metric-number">
              {{ r.averageAnswerRelevance !== null && r.averageAnswerRelevance !== undefined ? ((r.averageAnswerRelevance * 100) | number:'1.0-0') + '%' : 'N/A' }}
            </div>
            <p class="metric-desc">Directness and conciseness in answering the user question</p>
          </div>

          <!-- Answer Correctness -->
          <div class="metric-card" [ngClass]="getScoreTierClass(r.averageAnswerCorrectness)">
            <div class="metric-card-header">
              <span class="card-title">Answer Correctness</span>
              <span class="tier-pill">{{ getTierLabel(r.averageAnswerCorrectness) }}</span>
            </div>
            <div class="metric-number">
              {{ r.averageAnswerCorrectness !== null && r.averageAnswerCorrectness !== undefined ? ((r.averageAnswerCorrectness * 100) | number:'1.0-0') + '%' : 'N/A' }}
            </div>
            <p class="metric-desc">Semantic agreement and factual equivalence with ground truth</p>
          </div>

          <!-- Context Relevance -->
          <div class="metric-card" [ngClass]="getScoreTierClass(r.averageContextRelevance)">
            <div class="metric-card-header">
              <span class="card-title">Context Relevance</span>
              <span class="tier-pill">{{ getTierLabel(r.averageContextRelevance) }}</span>
            </div>
            <div class="metric-number">
              {{ r.averageContextRelevance !== null && r.averageContextRelevance !== undefined ? ((r.averageContextRelevance * 100) | number:'1.0-0') + '%' : 'N/A' }}
            </div>
            <p class="metric-desc">Noise-to-signal ratio of retrieved context passages</p>
          </div>

          <!-- Context Recall -->
          <div class="metric-card" [ngClass]="getScoreTierClass(r.averageContextRecall)">
            <div class="metric-card-header">
              <span class="card-title">Context Recall</span>
              <span class="tier-pill">{{ getTierLabel(r.averageContextRecall) }}</span>
            </div>
            <div class="metric-number">
              {{ r.averageContextRecall !== null && r.averageContextRecall !== undefined ? ((r.averageContextRecall * 100) | number:'1.0-0') + '%' : 'N/A' }}
            </div>
            <p class="metric-desc">Proportion of expected ground truth context retrieved</p>
          </div>

          <!-- Average Latency -->
          <div class="metric-card tier-neutral">
            <div class="metric-card-header">
              <span class="card-title">Average Latency</span>
              <span class="tier-pill">⚡ Speed</span>
            </div>
            <div class="metric-number">
              {{ r.averageLatency !== null && r.averageLatency !== undefined ? (r.averageLatency | number:'1.0-1') + ' ms' : '—' }}
            </div>
            <p class="metric-desc">Average round-trip response time from external RAG endpoint</p>
          </div>
        </div>

        <!-- Visual Charts Section -->
        <div class="charts-grid">
          <!-- Chart 1: Metric Comparison -->
          <div class="chart-card">
            <div class="chart-header">
              <h3>Quality Metrics Comparison</h3>
              <span class="chart-sub">Benchmark against target (0.80)</span>
            </div>
            <div class="chart-body">
              <svg viewBox="0 0 500 240" class="svg-chart">
                <!-- Grid Lines -->
                <line x1="120" y1="20" x2="480" y2="20" stroke="#334155" stroke-dasharray="3,3" />
                <line x1="120" y1="70" x2="480" y2="70" stroke="#334155" stroke-dasharray="3,3" />
                <line x1="120" y1="120" x2="480" y2="120" stroke="#334155" stroke-dasharray="3,3" />
                <line x1="120" y1="170" x2="480" y2="170" stroke="#334155" stroke-dasharray="3,3" />
                <line x1="120" y1="220" x2="480" y2="220" stroke="#334155" />

                <!-- Target Benchmark Line at 80% (120 + 360 * 0.8 = 408) -->
                <line x1="408" y1="10" x2="408" y2="225" stroke="#38bdf8" stroke-width="2" stroke-dasharray="4,4" />
                <text x="408" y="10" fill="#38bdf8" font-size="10" text-anchor="middle">Target 80%</text>

                <!-- Bar 1: Faithfulness -->
                <text x="110" y="45" fill="#94a3b8" font-size="12" text-anchor="end">Faithfulness</text>
                <rect x="120" y="32" [attr.width]="getBarWidth(r.averageFaithfulness)" height="20" rx="4" [attr.fill]="getBarColor(r.averageFaithfulness)" />
                <text [attr.x]="125 + getBarWidth(r.averageFaithfulness)" y="46" fill="#f8fafc" font-size="11" font-weight="bold">
                  {{ formatPercent(r.averageFaithfulness) }}
                </text>

                <!-- Bar 2: Answer Relevance -->
                <text x="110" y="85" fill="#94a3b8" font-size="12" text-anchor="end">Answer Rel.</text>
                <rect x="120" y="72" [attr.width]="getBarWidth(r.averageAnswerRelevance)" height="20" rx="4" [attr.fill]="getBarColor(r.averageAnswerRelevance)" />
                <text [attr.x]="125 + getBarWidth(r.averageAnswerRelevance)" y="86" fill="#f8fafc" font-size="11" font-weight="bold">
                  {{ formatPercent(r.averageAnswerRelevance) }}
                </text>

                <!-- Bar 3: Answer Correctness -->
                <text x="110" y="125" fill="#94a3b8" font-size="12" text-anchor="end">Correctness</text>
                <rect x="120" y="112" [attr.width]="getBarWidth(r.averageAnswerCorrectness)" height="20" rx="4" [attr.fill]="getBarColor(r.averageAnswerCorrectness)" />
                <text [attr.x]="125 + getBarWidth(r.averageAnswerCorrectness)" y="126" fill="#f8fafc" font-size="11" font-weight="bold">
                  {{ formatPercent(r.averageAnswerCorrectness) }}
                </text>

                <!-- Bar 4: Context Relevance -->
                <text x="110" y="165" fill="#94a3b8" font-size="12" text-anchor="end">Context Rel.</text>
                <rect x="120" y="152" [attr.width]="getBarWidth(r.averageContextRelevance)" height="20" rx="4" [attr.fill]="getBarColor(r.averageContextRelevance)" />
                <text [attr.x]="125 + getBarWidth(r.averageContextRelevance)" y="166" fill="#f8fafc" font-size="11" font-weight="bold">
                  {{ formatPercent(r.averageContextRelevance) }}
                </text>

                <!-- Bar 5: Context Recall -->
                <text x="110" y="205" fill="#94a3b8" font-size="12" text-anchor="end">Context Recall</text>
                <rect x="120" y="192" [attr.width]="getBarWidth(r.averageContextRecall)" height="20" rx="4" [attr.fill]="getBarColor(r.averageContextRecall)" />
                <text [attr.x]="125 + getBarWidth(r.averageContextRecall)" y="206" fill="#f8fafc" font-size="11" font-weight="bold">
                  {{ formatPercent(r.averageContextRecall) }}
                </text>
              </svg>
            </div>
          </div>

          <!-- Chart 2: Score Distribution -->
          <div class="chart-card">
            <div class="chart-header">
              <h3>Question Score Distribution</h3>
              <span class="chart-sub">Overall quality rating buckets</span>
            </div>
            <div class="chart-body">
              <svg viewBox="0 0 400 240" class="svg-chart">
                <line x1="40" y1="190" x2="380" y2="190" stroke="#334155" />

                <!-- Bucket 1: 0-40% -->
                <rect x="60" [attr.y]="190 - getDistributionHeight(scoreDistribution().poor)" width="55" [attr.height]="getDistributionHeight(scoreDistribution().poor)" fill="#ef4444" rx="4" />
                <text x="87" y="210" fill="#94a3b8" font-size="11" text-anchor="middle">&lt;40%</text>
                <text x="87" [attr.y]="180 - getDistributionHeight(scoreDistribution().poor)" fill="#f8fafc" font-size="11" font-weight="bold" text-anchor="middle">
                  {{ scoreDistribution().poor }}
                </text>

                <!-- Bucket 2: 40-70% -->
                <rect x="145" [attr.y]="190 - getDistributionHeight(scoreDistribution().warning)" width="55" [attr.height]="getDistributionHeight(scoreDistribution().warning)" fill="#f59e0b" rx="4" />
                <text x="172" y="210" fill="#94a3b8" font-size="11" text-anchor="middle">40-70%</text>
                <text x="172" [attr.y]="180 - getDistributionHeight(scoreDistribution().warning)" fill="#f8fafc" font-size="11" font-weight="bold" text-anchor="middle">
                  {{ scoreDistribution().warning }}
                </text>

                <!-- Bucket 3: 70-85% -->
                <rect x="230" [attr.y]="190 - getDistributionHeight(scoreDistribution().good)" width="55" [attr.height]="getDistributionHeight(scoreDistribution().good)" fill="#3b82f6" rx="4" />
                <text x="257" y="210" fill="#94a3b8" font-size="11" text-anchor="middle">70-85%</text>
                <text x="257" [attr.y]="180 - getDistributionHeight(scoreDistribution().good)" fill="#f8fafc" font-size="11" font-weight="bold" text-anchor="middle">
                  {{ scoreDistribution().good }}
                </text>

                <!-- Bucket 4: 85-100% -->
                <rect x="315" [attr.y]="190 - getDistributionHeight(scoreDistribution().excellent)" width="55" [attr.height]="getDistributionHeight(scoreDistribution().excellent)" fill="#10b981" rx="4" />
                <text x="342" y="210" fill="#94a3b8" font-size="11" text-anchor="middle">85-100%</text>
                <text x="342" [attr.y]="180 - getDistributionHeight(scoreDistribution().excellent)" fill="#f8fafc" font-size="11" font-weight="bold" text-anchor="middle">
                  {{ scoreDistribution().excellent }}
                </text>
              </svg>
            </div>
          </div>

          <!-- Chart 3: Latency Distribution -->
          <div class="chart-card">
            <div class="chart-header">
              <h3>Pipeline Latency Breakdown</h3>
              <span class="chart-sub">Response speed per question</span>
            </div>
            <div class="chart-body">
              <svg viewBox="0 0 400 240" class="svg-chart">
                <line x1="40" y1="190" x2="380" y2="190" stroke="#334155" />

                <!-- Fast < 500ms -->
                <rect x="65" [attr.y]="190 - getDistributionHeight(latencyBuckets().fast)" width="65" [attr.height]="getDistributionHeight(latencyBuckets().fast)" fill="#10b981" rx="4" />
                <text x="97" y="210" fill="#94a3b8" font-size="11" text-anchor="middle">&lt; 500ms</text>
                <text x="97" [attr.y]="180 - getDistributionHeight(latencyBuckets().fast)" fill="#f8fafc" font-size="11" font-weight="bold" text-anchor="middle">
                  {{ latencyBuckets().fast }}
                </text>

                <!-- Normal 500ms - 1500ms -->
                <rect x="165" [attr.y]="190 - getDistributionHeight(latencyBuckets().normal)" width="65" [attr.height]="getDistributionHeight(latencyBuckets().normal)" fill="#3b82f6" rx="4" />
                <text x="197" y="210" fill="#94a3b8" font-size="11" text-anchor="middle">0.5s - 1.5s</text>
                <text x="197" [attr.y]="180 - getDistributionHeight(latencyBuckets().normal)" fill="#f8fafc" font-size="11" font-weight="bold" text-anchor="middle">
                  {{ latencyBuckets().normal }}
                </text>

                <!-- Slow > 1500ms -->
                <rect x="265" [attr.y]="190 - getDistributionHeight(latencyBuckets().slow)" width="65" [attr.height]="getDistributionHeight(latencyBuckets().slow)" fill="#f59e0b" rx="4" />
                <text x="297" y="210" fill="#94a3b8" font-size="11" text-anchor="middle">&gt; 1.5s</text>
                <text x="297" [attr.y]="180 - getDistributionHeight(latencyBuckets().slow)" fill="#f8fafc" font-size="11" font-weight="bold" text-anchor="middle">
                  {{ latencyBuckets().slow }}
                </text>
              </svg>
            </div>
          </div>

          <!-- Chart 4: Pass / Fail Rate Donut -->
          <div class="chart-card">
            <div class="chart-header">
              <h3>Pass / Fail Rate</h3>
              <span class="chart-sub">Execution completion status</span>
            </div>
            <div class="chart-body donut-body">
              <div class="donut-container">
                <svg viewBox="0 0 160 160" class="donut-chart">
                  <circle cx="80" cy="80" r="58" fill="none" stroke="#1e293b" stroke-width="16" />
                  <circle
                    cx="80"
                    cy="80"
                    r="58"
                    fill="none"
                    stroke="#10b981"
                    stroke-width="16"
                    stroke-linecap="round"
                    [attr.stroke-dasharray]="passDonutArray()"
                    stroke-dashoffset="0"
                    transform="rotate(-90 80 80)"
                  />
                  @if (r.failedQuestions > 0) {
                    <circle
                      cx="80"
                      cy="80"
                      r="58"
                      fill="none"
                      stroke="#ef4444"
                      stroke-width="16"
                      stroke-linecap="round"
                      [attr.stroke-dasharray]="failDonutArray()"
                      [attr.stroke-dashoffset]="-passDonutOffset()"
                      transform="rotate(-90 80 80)"
                    />
                  }
                </svg>
                <div class="donut-center-text">
                  <span class="pct-val">{{ passPercentage() }}%</span>
                  <span class="pct-lbl">Pass Rate</span>
                </div>
              </div>

              <div class="donut-legend">
                <div class="legend-item">
                  <span class="legend-dot pass"></span>
                  <span>Passed: <strong>{{ r.totalQuestions - r.failedQuestions }}</strong></span>
                </div>
                <div class="legend-item">
                  <span class="legend-dot fail"></span>
                  <span>Failed: <strong>{{ r.failedQuestions }}</strong></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Evaluation Results Section -->
        <div class="table-section">
          <div class="table-toolbar">
            <div>
              <h2>Evaluation Results</h2>
              <p class="section-desc">Individual test questions and quality outcomes from MongoDB</p>
            </div>

            <!-- Filter Controls -->
            <div class="filters-row">
              <input
                type="text"
                [(ngModel)]="searchQuery"
                placeholder="Search questions..."
                class="search-input"
              />

              <div class="filter-pills">
                <button
                  type="button"
                  class="pill-btn"
                  [class.active]="selectedFilter === 'all'"
                  (click)="selectedFilter = 'all'"
                >
                  All ({{ results().length }})
                </button>
                <button
                  type="button"
                  class="pill-btn"
                  [class.active]="selectedFilter === 'passed'"
                  (click)="selectedFilter = 'passed'"
                >
                  Passed
                </button>
                <button
                  type="button"
                  class="pill-btn"
                  [class.active]="selectedFilter === 'failed'"
                  (click)="selectedFilter = 'failed'"
                >
                  Failed
                </button>
                <button
                  type="button"
                  class="pill-btn"
                  [class.active]="selectedFilter === 'low_faithfulness'"
                  (click)="selectedFilter = 'low_faithfulness'"
                >
                  Low Faithfulness
                </button>
                <button
                  type="button"
                  class="pill-btn"
                  [class.active]="selectedFilter === 'low_correctness'"
                  (click)="selectedFilter = 'low_correctness'"
                >
                  Low Correctness
                </button>
                <button
                  type="button"
                  class="pill-btn"
                  [class.active]="selectedFilter === 'low_context_relevance'"
                  (click)="selectedFilter = 'low_context_relevance'"
                >
                  Low Context Rel
                </button>
                <button
                  type="button"
                  class="pill-btn"
                  [class.active]="selectedFilter === 'slow'"
                  (click)="selectedFilter = 'slow'"
                >
                  Slow (&gt;1s)
                </button>
              </div>
            </div>
          </div>

          @if (filteredResults().length === 0) {
            <div class="empty-filter-state">
              <p>No questions match the current filter selection.</p>
              <button (click)="selectedFilter = 'all'; searchQuery = ''" class="btn btn-sm btn-secondary">
                Reset Filters
              </button>
            </div>
          } @else {
            <div class="results-table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th style="width: 45px;">#</th>
                    <th>Question</th>
                    <th style="width: 120px;">Correctness</th>
                    <th style="width: 120px;">Faithfulness</th>
                    <th style="width: 120px;">Relevance</th>
                    <th style="width: 120px;">Context Rel</th>
                    <th style="width: 95px;">Latency</th>
                    <th style="width: 80px;">Status</th>
                    <th style="width: 110px; text-align: right;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  @for (res of filteredResults(); track res.id; let idx = $index) {
                    <tr [class.row-failed]="res.status === 'failed'">
                      <td class="col-idx">{{ idx + 1 }}</td>
                      <td>
                        <div class="cell-question">
                          <a
                            [routerLink]="['/evaluations', runId, 'results', res.id]"
                            class="question-title-link"
                          >
                            {{ res.question }}
                          </a>
                          @if (res.expectedAnswer) {
                            <span class="preview-sub">Expected: {{ res.expectedAnswer | slice:0:70 }}...</span>
                          }
                        </div>
                      </td>
                      <td>
                        <span class="metric-score-tag" [ngClass]="getScoreTierClass(res.metrics?.answerCorrectness?.score)">
                          {{ formatScore(res.metrics?.answerCorrectness?.score) }}
                        </span>
                      </td>
                      <td>
                        <span class="metric-score-tag" [ngClass]="getScoreTierClass(res.metrics?.faithfulness?.score)">
                          {{ formatScore(res.metrics?.faithfulness?.score) }}
                        </span>
                      </td>
                      <td>
                        <span class="metric-score-tag" [ngClass]="getScoreTierClass(res.metrics?.answerRelevance?.score)">
                          {{ formatScore(res.metrics?.answerRelevance?.score) }}
                        </span>
                      </td>
                      <td>
                        <span class="metric-score-tag" [ngClass]="getScoreTierClass(res.metrics?.contextRelevance?.score)">
                          {{ formatScore(res.metrics?.contextRelevance?.score) }}
                        </span>
                      </td>
                      <td>
                        <span class="latency-cell">
                          {{ res.latencyMs !== null && res.latencyMs !== undefined ? res.latencyMs + ' ms' : '—' }}
                        </span>
                      </td>
                      <td>
                        <span class="status-badge-sm" [class.badge-ok]="res.status === 'completed'" [class.badge-err]="res.status === 'failed'">
                          {{ res.status === 'completed' ? 'PASS' : 'FAIL' }}
                        </span>
                      </td>
                      <td style="text-align: right;">
                        <a
                          [routerLink]="['/evaluations', runId, 'results', res.id]"
                          class="btn-inspect"
                        >
                          Inspect →
                        </a>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .evaluation-detail-page {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .breadcrumbs {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
      color: #94a3b8;
    }

    .breadcrumbs a {
      color: #60a5fa;
      text-decoration: none;
    }

    .breadcrumbs a:hover {
      text-decoration: underline;
    }

    .overview-header-card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .header-main {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
    }

    .title-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .title-row h1 {
      margin: 0;
      font-size: 1.75rem;
      font-weight: 700;
      color: #f8fafc;
    }

    .run-sub {
      margin: 0.35rem 0 0 0;
      color: #94a3b8;
      font-size: 0.9rem;
    }

    .run-sub strong {
      color: #f1f5f9;
    }

    .header-meta-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.825rem;
      color: #64748b;
      padding-top: 0.75rem;
      border-top: 1px solid #1e293b;
    }

    .meta-failed {
      color: #f87171;
    }

    /* Metric Cards */
    .metric-cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 1rem;
    }

    .metric-card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 10px;
      padding: 1.15rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      transition: all 0.15s ease;
    }

    .metric-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .card-title {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #94a3b8;
    }

    .tier-pill {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .metric-number {
      font-size: 1.75rem;
      font-weight: 700;
      font-family: monospace;
      color: #f8fafc;
    }

    .metric-desc {
      margin: 0;
      font-size: 0.75rem;
      color: #64748b;
      line-height: 1.35;
    }

    /* Score Tiers */
    .tier-good {
      border-color: rgba(16, 185, 129, 0.3);
    }
    .tier-good .metric-number {
      color: #34d399;
    }
    .tier-good .tier-pill {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
    }

    .tier-warning {
      border-color: rgba(234, 179, 8, 0.3);
    }
    .tier-warning .metric-number {
      color: #facc15;
    }
    .tier-warning .tier-pill {
      background: rgba(234, 179, 8, 0.15);
      color: #facc15;
    }

    .tier-poor {
      border-color: rgba(239, 68, 68, 0.3);
    }
    .tier-poor .metric-number {
      color: #f87171;
    }
    .tier-poor .tier-pill {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
    }

    .tier-neutral .tier-pill {
      background: #1e293b;
      color: #94a3b8;
    }

    /* Charts Grid */
    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
      gap: 1.25rem;
    }

    .chart-card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .chart-header h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: #f1f5f9;
    }

    .chart-sub {
      font-size: 0.75rem;
      color: #64748b;
    }

    .chart-body {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 200px;
    }

    .svg-chart {
      width: 100%;
      height: 200px;
    }

    .donut-body {
      display: flex;
      gap: 1.5rem;
      justify-content: space-around;
    }

    .donut-container {
      position: relative;
      width: 140px;
      height: 140px;
    }

    .donut-chart {
      width: 100%;
      height: 100%;
    }

    .donut-center-text {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .pct-val {
      font-size: 1.35rem;
      font-weight: 700;
      font-family: monospace;
      color: #f8fafc;
    }

    .pct-lbl {
      font-size: 0.65rem;
      color: #64748b;
      text-transform: uppercase;
    }

    .donut-legend {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 0.6rem;
      font-size: 0.85rem;
      color: #94a3b8;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .legend-dot.pass {
      background: #10b981;
    }

    .legend-dot.fail {
      background: #ef4444;
    }

    /* Table Section */
    .table-section {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .table-toolbar {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .table-toolbar h2 {
      margin: 0;
      font-size: 1.15rem;
      color: #f8fafc;
    }

    .section-desc {
      margin: 0.2rem 0 0 0;
      font-size: 0.8rem;
      color: #94a3b8;
    }

    .filters-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
    }

    .search-input {
      background: #020617;
      border: 1px solid #334155;
      color: #f8fafc;
      padding: 0.45rem 0.85rem;
      border-radius: 6px;
      font-size: 0.85rem;
      outline: none;
      min-width: 220px;
    }

    .search-input:focus {
      border-color: #3b82f6;
    }

    .filter-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }

    .pill-btn {
      background: #1e293b;
      border: 1px solid #334155;
      color: #94a3b8;
      padding: 0.35rem 0.7rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .pill-btn:hover {
      background: #334155;
      color: white;
    }

    .pill-btn.active {
      background: rgba(59, 130, 246, 0.2);
      border-color: #3b82f6;
      color: #60a5fa;
    }

    /* Results Table */
    .results-table-container {
      border: 1px solid #1e293b;
      border-radius: 8px;
      overflow-x: auto;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.85rem;
    }

    .data-table th {
      background: #0b1120;
      color: #94a3b8;
      font-weight: 600;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #1e293b;
      white-space: nowrap;
    }

    .data-table td {
      padding: 0.85rem 1rem;
      border-bottom: 1px solid #1e293b;
      vertical-align: middle;
      color: #cbd5e1;
    }

    .col-idx {
      font-family: monospace;
      color: #64748b;
    }

    .cell-question {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .question-title-link {
      color: #f1f5f9;
      font-weight: 600;
      text-decoration: none;
    }

    .question-title-link:hover {
      color: #60a5fa;
      text-decoration: underline;
    }

    .preview-sub {
      font-size: 0.75rem;
      color: #64748b;
    }

    .metric-score-tag {
      font-family: monospace;
      font-weight: 700;
      font-size: 0.8rem;
      padding: 0.2rem 0.45rem;
      border-radius: 4px;
      display: inline-block;
    }

    .metric-score-tag.tier-good {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
    }

    .metric-score-tag.tier-warning {
      background: rgba(234, 179, 8, 0.15);
      color: #facc15;
    }

    .metric-score-tag.tier-poor {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
    }

    .metric-score-tag.tier-neutral {
      background: #1e293b;
      color: #64748b;
    }

    .latency-cell {
      font-family: monospace;
      font-size: 0.8rem;
      color: #94a3b8;
    }

    .status-badge-sm {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      letter-spacing: 0.04em;
    }

    .badge-ok {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
    }

    .badge-err {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
    }

    .btn-inspect {
      display: inline-block;
      padding: 0.35rem 0.65rem;
      background: #1e293b;
      border: 1px solid #334155;
      color: #60a5fa;
      border-radius: 6px;
      text-decoration: none;
      font-size: 0.75rem;
      font-weight: 600;
      transition: all 0.15s ease;
    }

    .btn-inspect:hover {
      background: #334155;
      color: white;
    }

    .empty-filter-state {
      text-align: center;
      padding: 2.5rem;
      color: #94a3b8;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.25rem 0.65rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.05em;
    }

    .status-completed {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .status-running {
      background: rgba(59, 130, 246, 0.2);
      color: #60a5fa;
      border: 1px solid rgba(59, 130, 246, 0.4);
    }

    .status-failed {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .pulsing-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #38bdf8;
      animation: pulse 1.5s infinite;
    }

    .active-progress-banner {
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(59, 130, 246, 0.35);
      border-radius: 8px;
      padding: 0.875rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    .progress-info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.825rem;
    }

    .progress-status-text {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: #93c5fd;
      font-weight: 500;
    }

    .progress-counter {
      color: #cbd5e1;
      font-size: 0.8rem;
    }

    .failed-counter {
      color: #f87171;
      margin-left: 0.35rem;
    }

    .progress-bar-bg {
      width: 100%;
      height: 6px;
      background: #1e293b;
      border-radius: 999px;
      overflow: hidden;
    }

    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #3b82f6, #60a5fa);
      border-radius: 999px;
      transition: width 0.3s ease;
    }

    @keyframes pulse {
      0% { transform: scale(0.95); opacity: 0.7; }
      50% { transform: scale(1.3); opacity: 1; }
      100% { transform: scale(0.95); opacity: 0.7; }
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.55rem 1rem;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.15s ease;
      border: none;
    }

    .btn-sm {
      padding: 0.35rem 0.65rem;
      font-size: 0.775rem;
    }

    .btn-secondary {
      background: #1e293b;
      color: #cbd5e1;
      border: 1px solid #334155;
    }

    .btn-secondary:hover {
      background: #334155;
      color: white;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      padding: 4rem;
      color: #94a3b8;
    }

    .spinner {
      width: 28px;
      height: 28px;
      border: 3px solid rgba(255, 255, 255, 0.2);
      border-radius: 50%;
      border-top-color: #3b82f6;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .error-banner {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid #ef4444;
      color: #fca5a5;
      padding: 1rem;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  `],
})
export class EvaluationDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly evaluationService = inject(EvaluationService);

  runId = '';
  run = signal<EvaluationRun | null>(null);
  results = signal<EvaluationResult[]>([]);

  loadingRun = signal<boolean>(true);
  runError = signal<string | null>(null);
  cancelling = signal<boolean>(false);
  private pollTimer: any = null;

  searchQuery = '';
  selectedFilter: FilterType = 'all';

  ngOnInit(): void {
    this.runId = this.route.snapshot.params['id'];
    this.refreshData(true);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  refreshData(isInitial = false): void {
    if (isInitial) {
      this.loadingRun.set(true);
    }
    this.runError.set(null);

    this.evaluationService.getEvaluation(this.runId).subscribe({
      next: (runData) => {
        this.run.set(runData);
        this.loadResults(isInitial);

        if (runData.status === 'running' || runData.status === 'pending') {
          if (this.pollTimer) clearTimeout(this.pollTimer);
          this.pollTimer = setTimeout(() => this.refreshData(false), 2000);
        } else {
          if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = null;
          }
        }
      },
      error: (err) => {
        this.runError.set(err.error?.error?.message || 'Could not load evaluation run.');
        this.loadingRun.set(false);
      },
    });
  }

  loadResults(isInitial = false): void {
    this.evaluationService.getEvaluationResults(this.runId).subscribe({
      next: (resList) => {
        this.results.set(resList);
        if (isInitial) {
          this.loadingRun.set(false);
        }
      },
      error: () => {
        if (isInitial) {
          this.loadingRun.set(false);
        }
      },
    });
  }

  cancelRun(): void {
    if (!this.runId || this.cancelling()) return;
    this.cancelling.set(true);
    this.evaluationService.cancelEvaluation(this.runId).subscribe({
      next: (updated) => {
        this.run.set(updated);
        this.cancelling.set(false);
        if (this.pollTimer) {
          clearTimeout(this.pollTimer);
          this.pollTimer = null;
        }
      },
      error: (err) => {
        this.cancelling.set(false);
        console.error('Failed to cancel evaluation run', err);
      },
    });
  }

  filteredResults = computed(() => {
    let list = this.results();
    const query = this.searchQuery.trim().toLowerCase();

    if (query) {
      list = list.filter((r) => r.question.toLowerCase().includes(query));
    }

    switch (this.selectedFilter) {
      case 'passed':
        return list.filter((r) => r.status === 'completed');
      case 'failed':
        return list.filter((r) => r.status === 'failed');
      case 'low_faithfulness':
        return list.filter(
          (r) =>
            r.metrics?.faithfulness?.score !== null &&
            r.metrics?.faithfulness?.score !== undefined &&
            r.metrics.faithfulness.score < 0.7
        );
      case 'low_correctness':
        return list.filter(
          (r) =>
            r.metrics?.answerCorrectness?.score !== null &&
            r.metrics?.answerCorrectness?.score !== undefined &&
            r.metrics.answerCorrectness.score < 0.7
        );
      case 'low_context_relevance':
        return list.filter(
          (r) =>
            r.metrics?.contextRelevance?.score !== null &&
            r.metrics?.contextRelevance?.score !== undefined &&
            r.metrics.contextRelevance.score < 0.7
        );
      case 'slow':
        return list.filter((r) => (r.latencyMs || 0) >= 1000);
      default:
        return list;
    }
  });

  scoreDistribution = computed(() => {
    const list = this.results();
    let poor = 0;
    let warning = 0;
    let good = 0;
    let excellent = 0;

    for (const r of list) {
      const scores: number[] = [];
      if (r.metrics?.faithfulness?.score != null) scores.push(r.metrics.faithfulness.score);
      if (r.metrics?.answerRelevance?.score != null) scores.push(r.metrics.answerRelevance.score);
      if (r.metrics?.answerCorrectness?.score != null) scores.push(r.metrics.answerCorrectness.score);
      if (r.metrics?.contextRelevance?.score != null) scores.push(r.metrics.contextRelevance.score);

      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      if (avg < 0.4) poor++;
      else if (avg < 0.7) warning++;
      else if (avg < 0.85) good++;
      else excellent++;
    }

    return { poor, warning, good, excellent };
  });

  latencyBuckets = computed(() => {
    const list = this.results();
    let fast = 0;
    let normal = 0;
    let slow = 0;

    for (const r of list) {
      const lat = r.latencyMs || 0;
      if (lat < 500) fast++;
      else if (lat <= 1500) normal++;
      else slow++;
    }
    return { fast, normal, slow };
  });

  passPercentage = computed(() => {
    const r = this.run();
    if (!r || r.totalQuestions === 0) return 100;
    const passed = r.totalQuestions - r.failedQuestions;
    return Math.round((passed / r.totalQuestions) * 100);
  });

  passDonutArray(): string {
    const pct = this.passPercentage();
    const circumference = 2 * Math.PI * 58; // approx 364.4
    const passLen = (pct / 100) * circumference;
    return `${passLen} ${circumference}`;
  }

  failDonutArray(): string {
    const pct = 100 - this.passPercentage();
    const circumference = 2 * Math.PI * 58;
    const failLen = (pct / 100) * circumference;
    return `${failLen} ${circumference}`;
  }

  passDonutOffset(): number {
    const pct = this.passPercentage();
    const circumference = 2 * Math.PI * 58;
    return (pct / 100) * circumference;
  }

  getDistributionHeight(count: number): number {
    const total = this.results().length;
    if (total === 0) return 0;
    const maxBarHeight = 140;
    return Math.max(8, Math.round((count / total) * maxBarHeight));
  }

  getBarWidth(score: number | null | undefined): number {
    if (score === null || score === undefined) return 0;
    const maxBarWidth = 340;
    return Math.round(score * maxBarWidth);
  }

  getBarColor(score: number | null | undefined): string {
    if (score === null || score === undefined) return '#64748b';
    if (score >= 0.8) return '#10b981';
    if (score >= 0.5) return '#f59e0b';
    return '#ef4444';
  }

  getScoreTierClass(score: number | null | undefined): string {
    if (score === null || score === undefined) return 'tier-neutral';
    if (score >= 0.8) return 'tier-good';
    if (score >= 0.5) return 'tier-warning';
    return 'tier-poor';
  }

  getTierLabel(score: number | null | undefined): string {
    if (score === null || score === undefined) return 'N/A';
    if (score >= 0.8) return 'Good';
    if (score >= 0.5) return 'Warning';
    return 'Poor';
  }

  formatPercent(score: number | null | undefined): string {
    if (score === null || score === undefined) return 'N/A';
    return (score * 100).toFixed(0) + '%';
  }

  formatScore(score: number | null | undefined): string {
    if (score === null || score === undefined) return '—';
    return score.toFixed(2);
  }

  exportCsv(): void {
    this.evaluationService.exportCsv(this.runId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `evaluation_${this.runId}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => alert('Failed to export CSV'),
    });
  }

  exportJson(): void {
    this.evaluationService.exportJson(this.runId).subscribe({
      next: (data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `evaluation_${this.runId}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => alert('Failed to export JSON'),
    });
  }
}

