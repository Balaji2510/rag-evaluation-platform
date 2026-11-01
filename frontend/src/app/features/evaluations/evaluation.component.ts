import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Dataset } from '../../core/models/dataset.model';
import {
  CreateEvaluationRequest,
  EvaluationResult,
  EvaluationRun,
} from '../../core/models/evaluation.model';
import { Project } from '../../core/models/project.model';
import { RAGConfiguration } from '../../core/models/rag-configuration.model';
import { EvaluationService } from '../../core/services/evaluation.service';
import { ProjectService } from '../../core/services/project.service';
import { RAGConfigurationService } from '../../core/services/rag-configuration.service';

@Component({
  selector: 'app-evaluations',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="evaluations-page">
      <!-- Page Header -->
      <div class="page-header">
        <div>
          <h1>RAG Evaluation Engine</h1>
          <p class="subtitle">
            Benchmark external RAG pipelines against ground truth datasets with real-time tracking
          </p>
        </div>
      </div>

      <!-- Quick Run Configuration Card -->
      <div class="card run-config-card">
        <div class="card-header">
          <h2>Configure & Launch Evaluation</h2>
          <span class="step-pill">Phase 5 Engine</span>
        </div>

        <form (ngSubmit)="startNewEvaluation()" class="run-form">
          <div class="form-grid">
            <!-- Project Selection -->
            <div class="form-group">
              <label for="evalProject">Select Project <span class="required">*</span></label>
              <select
                id="evalProject"
                [(ngModel)]="selectedProjectId"
                (ngModelChange)="onProjectSelectionChange($event)"
                name="selectedProjectId"
                required
                class="select-input"
              >
                <option value="" disabled>-- Select Evaluation Project --</option>
                @for (proj of projects(); track proj.id) {
                  <option [value]="proj.id">{{ proj.name }}</option>
                }
              </select>
            </div>

            <!-- Dataset Selection -->
            <div class="form-group">
              <label for="evalDataset">Select Dataset <span class="required">*</span></label>
              <select
                id="evalDataset"
                [(ngModel)]="selectedDatasetId"
                name="selectedDatasetId"
                required
                class="select-input"
                [disabled]="!selectedProjectId || loadingProjectResources()"
              >
                <option value="" disabled>-- Select Dataset --</option>
                @for (ds of datasets(); track ds.id) {
                  <option [value]="ds.id">{{ ds.name }}</option>
                }
              </select>
              @if (selectedProjectId && datasets().length === 0 && !loadingProjectResources()) {
                <span class="field-hint warning">No datasets found for this project.</span>
              }
            </div>

            <!-- RAG Configuration Selection (External vs Internal RAG) -->
            <div class="form-group">
              <label for="evalRagConfig">Select RAG Pipeline <span class="required">*</span></label>
              <select
                id="evalRagConfig"
                [(ngModel)]="selectedRagConfigId"
                name="selectedRagConfigId"
                required
                class="select-input"
                [disabled]="!selectedProjectId || loadingProjectResources()"
              >
                <option value="" disabled>-- Select RAG Pipeline --</option>
                <optgroup label="Internal Pipeline (Phase 9)">
                  <option value="internal">⚡ Internal RAG (Atlas Vector Search + Gemini)</option>
                </optgroup>
                <optgroup label="External RAG Pipelines">
                  @for (cfg of ragConfigs(); track cfg.id) {
                    <option [value]="cfg.id">{{ cfg.name }} ({{ cfg.method }} {{ cfg.apiUrl }})</option>
                  }
                </optgroup>
              </select>
              @if (selectedProjectId && ragConfigs().length === 0 && selectedRagConfigId !== 'internal' && !loadingProjectResources()) {
                <span class="field-hint">No external endpoints configured. Select Internal RAG above or configure endpoints.</span>
              }
            </div>
          </div>

          @if (formError()) {
            <div class="form-error-banner">{{ formError() }}</div>
          }

          <div class="form-actions-row">
            <button
              type="submit"
              class="btn btn-primary"
              [disabled]="submittingRun() || !selectedProjectId || !selectedDatasetId || !selectedRagConfigId"
            >
              @if (submittingRun()) {
                <span class="spinner"></span> Dispatching Run...
              } @else {
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                Run Evaluation
              }
            </button>
          </div>
        </form>
      </div>

      <!-- Evaluation Runs Section -->
      <div class="runs-section">
        <div class="section-toolbar">
          <div>
            <h2>Evaluation Runs</h2>
            <p class="section-desc">Active and historical benchmarking executions</p>
          </div>
          <button (click)="loadEvaluations()" class="btn btn-secondary btn-sm" title="Refresh runs">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 4v6h-6"></path>
              <path d="M1 20v-6h6"></path>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            Refresh
          </button>
        </div>

        @if (loadingRuns()) {
          <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading evaluation runs...</p>
          </div>
        } @else if (runs().length === 0) {
          <div class="empty-state">
            <div class="empty-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polygon points="10 8 16 12 10 16 10 8"></polygon>
              </svg>
            </div>
            <h3>No evaluation runs yet</h3>
            <p>Select a project, dataset, and RAG configuration above and click "Run Evaluation".</p>
          </div>
        } @else {
          <div class="runs-list">
            @for (run of runs(); track run.id) {
              <div class="run-card" [class.is-running]="run.status === 'running' || run.status === 'pending'">
                <div class="run-card-header">
                  <div class="run-title-group">
                    <span class="status-badge" [ngClass]="'status-' + run.status">
                      @if (run.status === 'running') {
                        <span class="pulsing-dot"></span>
                      }
                      {{ run.status.toUpperCase() }}
                    </span>
                    <span class="run-id-tag">ID: {{ run.id.slice(0, 8) }}</span>
                  </div>

                  <div class="run-actions">
                    @if (run.status === 'running' || run.status === 'pending') {
                      <button (click)="cancelRun(run.id)" class="btn btn-danger btn-sm">
                        Cancel
                      </button>
                    }
                    @if (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') {
                      <a [routerLink]="['/evaluations', run.id]" class="btn btn-primary btn-sm btn-view-results">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                          <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                        View Results
                      </a>
                      <button (click)="openResultsModal(run)" class="btn btn-secondary btn-sm" title="Quick preview modal">
                        Quick Preview
                      </button>
                    }
                  </div>
                </div>

                <div class="run-details-grid">
                  <div class="detail-item">
                    <span class="detail-label">Project</span>
                    <span class="detail-val">{{ run.projectName || run.projectId }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Dataset</span>
                    <span class="detail-val">{{ run.datasetName || run.datasetId }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">RAG Pipeline</span>
                    <span class="detail-val">{{ run.ragConfigurationName || run.ragConfigurationId }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Created At</span>
                    <span class="detail-val">{{ run.createdAt | date:'short' }}</span>
                  </div>
                </div>

                <!-- Phase 6 Aggregate Metrics Bar -->
                @if (run.overallScore !== null && run.overallScore !== undefined) {
                  <div class="run-metrics-summary-bar">
                    <div
                      class="overall-badge"
                      [class.high]="(run.overallScore || 0) >= 0.8"
                      [class.med]="(run.overallScore || 0) >= 0.5 && (run.overallScore || 0) < 0.8"
                      [class.low]="(run.overallScore || 0) < 0.5"
                    >
                      <span class="badge-lbl">OVERALL</span>
                      <span class="badge-val">{{ ((run.overallScore || 0) * 100).toFixed(0) }}%</span>
                    </div>
                    <div class="metric-tags-list">
                      @if (run.averageFaithfulness !== null && run.averageFaithfulness !== undefined) {
                        <span class="summary-tag">Faithfulness: <strong>{{ ((run.averageFaithfulness || 0) * 100).toFixed(0) }}%</strong></span>
                      }
                      @if (run.averageAnswerRelevance !== null && run.averageAnswerRelevance !== undefined) {
                        <span class="summary-tag">Relevance: <strong>{{ ((run.averageAnswerRelevance || 0) * 100).toFixed(0) }}%</strong></span>
                      }
                      @if (run.averageAnswerCorrectness !== null && run.averageAnswerCorrectness !== undefined) {
                        <span class="summary-tag">Correctness: <strong>{{ ((run.averageAnswerCorrectness || 0) * 100).toFixed(0) }}%</strong></span>
                      }
                      @if (run.averageContextRelevance !== null && run.averageContextRelevance !== undefined) {
                        <span class="summary-tag">Context Rel: <strong>{{ ((run.averageContextRelevance || 0) * 100).toFixed(0) }}%</strong></span>
                      }
                      @if (run.averageContextRecall !== null && run.averageContextRecall !== undefined) {
                        <span class="summary-tag">Recall: <strong>{{ ((run.averageContextRecall || 0) * 100).toFixed(0) }}%</strong></span>
                      }
                      @if (run.averageLatency !== null && run.averageLatency !== undefined) {
                        <span class="summary-tag">⚡ <strong>{{ run.averageLatency }} ms</strong></span>
                      }
                    </div>
                  </div>
                }

                <!-- Progress Bar Section -->
                <div class="run-progress-box">
                  <div class="progress-info-row">
                    <span class="progress-status-text">
                      @if (run.status === 'running' || run.status === 'pending') {
                        Processing questions in background...
                      } @else {
                        Execution summary
                      }
                    </span>
                    <span class="progress-counter">
                      <strong>{{ run.completedQuestions }}</strong> / {{ run.totalQuestions }} questions
                      @if (run.failedQuestions > 0) {
                        <span class="failed-counter">({{ run.failedQuestions }} failed)</span>
                      }
                    </span>
                  </div>

                  <div class="progress-bar-bg">
                    <div
                      class="progress-bar-fill"
                      [class.progress-complete]="run.status === 'completed'"
                      [class.progress-error]="run.status === 'failed'"
                      [style.width.%]="getProgressPercent(run)"
                    ></div>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>

      <!-- View Results Modal -->
      @if (showResultsModal()) {
        <div class="modal-backdrop" (click)="closeResultsModal()">
          <div class="modal-card modal-xl" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div>
                <h3>Evaluation Results</h3>
                @if (activeRun(); as run) {
                  <p class="modal-sub">
                    Run ID: <code>{{ run.id }}</code> •
                    {{ run.completedQuestions }} / {{ run.totalQuestions }} evaluated
                    ({{ run.totalQuestions - run.failedQuestions }} successful, {{ run.failedQuestions }} failed)
                  </p>
                }
              </div>
              <button (click)="closeResultsModal()" class="btn-close">&times;</button>
            </div>

            <div class="modal-body results-body">
              @if (loadingResults()) {
                <div class="loading-state">
                  <div class="spinner"></div>
                  <p>Loading evaluation results...</p>
                </div>
              } @else if (results().length === 0) {
                <div class="empty-state-sm">
                  <p>No results recorded for this run.</p>
                </div>
              } @else {
                <div class="results-table-container">
                  <table class="results-table">
                    <thead>
                      <tr>
                        <th style="width: 40px;">#</th>
                        <th style="width: 22%;">Question & Ground Truth</th>
                        <th style="width: 28%;">Generated Answer & Contexts</th>
                        <th style="width: 42%;">Gemini RAG Quality Evaluation</th>
                        <th style="width: 70px;">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (res of results(); track res.id; let idx = $index) {
                        <tr [class.row-failed]="res.status === 'failed'">
                          <td class="col-idx">{{ idx + 1 }}</td>
                          <td>
                            <div class="cell-question">
                              <strong>{{ res.question }}</strong>
                              @if (res.expectedAnswer) {
                                <div class="expected-answer-box">
                                  <span class="sub-label">Expected Answer:</span>
                                  <p>{{ res.expectedAnswer }}</p>
                                </div>
                              }
                            </div>
                          </td>
                          <td>
                            @if (res.status === 'completed' && res.generatedAnswer) {
                              <div class="generated-answer-text">
                                {{ res.generatedAnswer }}
                              </div>
                            } @else {
                              <div class="error-badge-text">
                                <strong>Error:</strong> {{ res.error || 'Execution failed' }}
                              </div>
                            }

                            @if (res.retrievedContexts && res.retrievedContexts.length > 0) {
                              <div class="contexts-preview" style="margin-top: 0.6rem;">
                                <span class="contexts-count">{{ res.retrievedContexts.length }} passages retrieved</span>
                                <ul class="contexts-list">
                                  @for (ctx of res.retrievedContexts; track ctx) {
                                    <li>{{ ctx }}</li>
                                  }
                                </ul>
                              </div>
                            }
                            @if (res.latencyMs !== null && res.latencyMs !== undefined) {
                              <div style="margin-top: 0.4rem;">
                                <span class="latency-badge">⚡ {{ res.latencyMs }} ms</span>
                              </div>
                            }
                          </td>
                          <td>
                            @if (res.metrics) {
                              <div class="gemini-metrics-column">
                                @if (res.metrics.faithfulness; as m) {
                                  <div
                                    class="metric-chip"
                                    [class.metric-pass]="(m.score || 0) >= 0.7"
                                    [class.metric-warn]="(m.score || 0) >= 0.4 && (m.score || 0) < 0.7"
                                    [class.metric-fail]="(m.score || 0) < 0.4"
                                  >
                                    <div class="chip-top">
                                      <span class="chip-label">Faithfulness</span>
                                      <span class="chip-score">{{ m.score !== null ? m.score : 'N/A' }}</span>
                                    </div>
                                    @if (m.reason) {
                                      <p class="chip-reason">{{ m.reason }}</p>
                                    }
                                    @if (m.error) {
                                      <p class="chip-error">⚠️ {{ m.error }}</p>
                                    }
                                  </div>
                                }
                                @if (res.metrics.answerRelevance; as m) {
                                  <div
                                    class="metric-chip"
                                    [class.metric-pass]="(m.score || 0) >= 0.7"
                                    [class.metric-warn]="(m.score || 0) >= 0.4 && (m.score || 0) < 0.7"
                                    [class.metric-fail]="(m.score || 0) < 0.4"
                                  >
                                    <div class="chip-top">
                                      <span class="chip-label">Answer Relevance</span>
                                      <span class="chip-score">{{ m.score !== null ? m.score : 'N/A' }}</span>
                                    </div>
                                    @if (m.reason) {
                                      <p class="chip-reason">{{ m.reason }}</p>
                                    }
                                    @if (m.error) {
                                      <p class="chip-error">⚠️ {{ m.error }}</p>
                                    }
                                  </div>
                                }
                                @if (res.metrics.answerCorrectness; as m) {
                                  <div
                                    class="metric-chip"
                                    [class.metric-pass]="(m.score || 0) >= 0.7"
                                    [class.metric-warn]="(m.score || 0) >= 0.4 && (m.score || 0) < 0.7"
                                    [class.metric-fail]="(m.score || 0) < 0.4"
                                  >
                                    <div class="chip-top">
                                      <span class="chip-label">Answer Correctness</span>
                                      <span class="chip-score">{{ m.score !== null ? m.score : 'N/A' }}</span>
                                    </div>
                                    @if (m.reason) {
                                      <p class="chip-reason">{{ m.reason }}</p>
                                    }
                                    @if (m.error) {
                                      <p class="chip-error">⚠️ {{ m.error }}</p>
                                    }
                                  </div>
                                }
                                @if (res.metrics.contextRelevance; as m) {
                                  <div
                                    class="metric-chip"
                                    [class.metric-pass]="(m.score || 0) >= 0.7"
                                    [class.metric-warn]="(m.score || 0) >= 0.4 && (m.score || 0) < 0.7"
                                    [class.metric-fail]="(m.score || 0) < 0.4"
                                  >
                                    <div class="chip-top">
                                      <span class="chip-label">Context Relevance</span>
                                      <span class="chip-score">{{ m.score !== null ? m.score : 'N/A' }}</span>
                                    </div>
                                    @if (m.reason) {
                                      <p class="chip-reason">{{ m.reason }}</p>
                                    }
                                    @if (m.error) {
                                      <p class="chip-error">⚠️ {{ m.error }}</p>
                                    }
                                  </div>
                                }
                                @if (res.metrics.contextRecall; as m) {
                                  <div
                                    class="metric-chip"
                                    [class.metric-pass]="(m.score || 0) >= 0.7"
                                    [class.metric-warn]="(m.score || 0) >= 0.4 && (m.score || 0) < 0.7"
                                    [class.metric-fail]="(m.score || 0) < 0.4"
                                  >
                                    <div class="chip-top">
                                      <span class="chip-label">Context Recall</span>
                                      <span class="chip-score">{{ m.score !== null ? m.score : 'N/A' }}</span>
                                    </div>
                                    @if (m.reason) {
                                      <p class="chip-reason">{{ m.reason }}</p>
                                    }
                                    @if (m.error) {
                                      <p class="chip-error">⚠️ {{ m.error }}</p>
                                    }
                                  </div>
                                }
                              </div>
                            } @else {
                              <span class="text-muted">Metrics not evaluated</span>
                            }
                          </td>
                          <td>
                            <div style="display: flex; flex-direction: column; gap: 0.25rem; align-items: center;">
                              <span
                                class="mini-status-badge"
                                [class.badge-ok]="res.status === 'completed'"
                                [class.badge-err]="res.status === 'failed'"
                              >
                                {{ res.status === 'completed' ? 'PASS' : 'FAIL' }}
                              </span>
                              @if (activeRun(); as run) {
                                <a
                                  [routerLink]="['/evaluations', run.id, 'results', res.id]"
                                  (click)="closeResultsModal()"
                                  class="btn btn-xs btn-ghost"
                                  style="font-size: 0.75rem; text-decoration: underline; color: #38bdf8;"
                                >
                                  Inspect →
                                </a>
                              }
                            </div>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>

            <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center;">
              @if (activeRun(); as run) {
                <a
                  [routerLink]="['/evaluations', run.id]"
                  (click)="closeResultsModal()"
                  class="btn btn-primary"
                >
                  Open Full Dashboard & Analytics →
                </a>
              }
              <button (click)="closeResultsModal()" class="btn btn-secondary">Close</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .evaluations-page {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .page-header h1 {
      margin: 0 0 0.25rem 0;
      font-size: 1.75rem;
      font-weight: 700;
      color: #f8fafc;
    }

    .subtitle {
      margin: 0;
      color: #94a3b8;
      font-size: 0.95rem;
    }

    .card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 1.5rem;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.25rem;
    }

    .card-header h2 {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 600;
      color: #f1f5f9;
    }

    .step-pill {
      font-size: 0.75rem;
      background: rgba(59, 130, 246, 0.15);
      color: #60a5fa;
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
      font-weight: 600;
      border: 1px solid rgba(59, 130, 246, 0.3);
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1.25rem;
      margin-bottom: 1.25rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .form-group label {
      font-size: 0.85rem;
      font-weight: 600;
      color: #cbd5e1;
    }

    .required {
      color: #ef4444;
    }

    .select-input {
      background: #020617;
      border: 1px solid #334155;
      color: #f8fafc;
      padding: 0.6rem 0.85rem;
      border-radius: 8px;
      font-size: 0.875rem;
      outline: none;
      transition: border-color 0.15s ease;
    }

    .select-input:focus {
      border-color: #3b82f6;
    }

    .select-input:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .field-hint {
      font-size: 0.75rem;
    }

    .field-hint.warning {
      color: #f59e0b;
    }

    .form-error-banner {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid #ef4444;
      color: #fca5a5;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-size: 0.875rem;
      margin-bottom: 1rem;
    }

    .form-actions-row {
      display: flex;
      justify-content: flex-end;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.6rem 1.15rem;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.15s ease;
      border: none;
    }

    .btn-sm {
      padding: 0.4rem 0.75rem;
      font-size: 0.8rem;
    }

    .btn-primary {
      background: #3b82f6;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #2563eb;
    }

    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: #1e293b;
      color: #cbd5e1;
      border: 1px solid #334155;
    }

    .btn-secondary:hover:not(:disabled) {
      background: #334155;
      color: white;
    }

    .btn-danger {
      background: rgba(239, 68, 68, 0.2);
      color: #fca5a5;
      border: 1px solid rgba(239, 68, 68, 0.4);
    }

    .btn-danger:hover {
      background: #ef4444;
      color: white;
    }

    .section-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .section-toolbar h2 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: #f8fafc;
    }

    .section-desc {
      margin: 0.25rem 0 0 0;
      font-size: 0.85rem;
      color: #94a3b8;
    }

    .runs-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .run-card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 10px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      transition: border-color 0.15s ease;
    }

    .run-card.is-running {
      border-color: #3b82f6;
      box-shadow: 0 0 15px rgba(59, 130, 246, 0.1);
    }

    .run-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .run-title-group {
      display: flex;
      align-items: center;
      gap: 0.75rem;
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

    .status-pending {
      background: rgba(234, 179, 8, 0.15);
      color: #facc15;
      border: 1px solid rgba(234, 179, 8, 0.3);
    }

    .status-running {
      background: rgba(59, 130, 246, 0.2);
      color: #60a5fa;
      border: 1px solid rgba(59, 130, 246, 0.4);
    }

    .status-completed {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .status-failed {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .status-cancelled {
      background: rgba(148, 163, 184, 0.15);
      color: #94a3b8;
      border: 1px solid rgba(148, 163, 184, 0.3);
    }

    .pulsing-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #38bdf8;
      animation: pulse 1.5s infinite;
    }

    @keyframes pulse {
      0% { transform: scale(0.95); opacity: 0.7; }
      50% { transform: scale(1.3); opacity: 1; }
      100% { transform: scale(0.95); opacity: 0.7; }
    }

    .run-id-tag {
      font-family: monospace;
      font-size: 0.8rem;
      color: #64748b;
    }

    .run-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .btn-view-results {
      background: #1e3a8a;
      color: #bfdbfe;
      border-color: #2563eb;
    }

    .btn-view-results:hover {
      background: #1d4ed8;
      color: white;
    }

    .run-details-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 0.75rem;
      background: #020617;
      border: 1px solid #1e293b;
      padding: 0.85rem 1rem;
      border-radius: 8px;
    }

    .detail-item {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .detail-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .detail-val {
      font-size: 0.875rem;
      color: #f1f5f9;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Phase 6 Metrics Summary */
    .run-metrics-summary-bar {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
      background: #0b1120;
      border: 1px solid #1e293b;
      padding: 0.75rem 1rem;
      border-radius: 8px;
    }

    .overall-badge {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 0.35rem 0.75rem;
      border-radius: 8px;
      font-weight: 700;
      line-height: 1.1;
      min-width: 70px;
    }

    .overall-badge .badge-lbl {
      font-size: 0.65rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .overall-badge .badge-val {
      font-size: 1.1rem;
      font-family: monospace;
    }

    .overall-badge.high {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.35);
      color: #34d399;
    }

    .overall-badge.med {
      background: rgba(234, 179, 8, 0.15);
      border: 1px solid rgba(234, 179, 8, 0.35);
      color: #facc15;
    }

    .overall-badge.low {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.35);
      color: #f87171;
    }

    .metric-tags-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
      flex: 1;
    }

    .summary-tag {
      background: #1e293b;
      padding: 0.3rem 0.6rem;
      border-radius: 6px;
      font-size: 0.75rem;
      color: #94a3b8;
    }

    .summary-tag strong {
      color: #f1f5f9;
    }

    /* Gemini Quality Metrics Chips */
    .gemini-metrics-column {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
    }

    .metric-chip {
      border-radius: 6px;
      padding: 0.4rem 0.6rem;
      border: 1px solid transparent;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .metric-chip.metric-pass {
      background: rgba(16, 185, 129, 0.08);
      border-color: rgba(16, 185, 129, 0.25);
    }

    .metric-chip.metric-warn {
      background: rgba(234, 179, 8, 0.08);
      border-color: rgba(234, 179, 8, 0.25);
    }

    .metric-chip.metric-fail {
      background: rgba(239, 68, 68, 0.08);
      border-color: rgba(239, 68, 68, 0.25);
    }

    .chip-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .chip-label {
      color: #cbd5e1;
    }

    .chip-score {
      font-family: monospace;
      font-weight: 700;
      padding: 0.1rem 0.35rem;
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.3);
    }

    .metric-pass .chip-score {
      color: #34d399;
    }

    .metric-warn .chip-score {
      color: #facc15;
    }

    .metric-fail .chip-score {
      color: #f87171;
    }

    .chip-reason {
      margin: 0;
      font-size: 0.725rem;
      color: #94a3b8;
      line-height: 1.35;
    }

    .chip-error {
      margin: 0;
      font-size: 0.725rem;
      color: #fca5a5;
    }

    .run-progress-box {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .progress-info-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.825rem;
      color: #94a3b8;
    }

    .progress-counter {
      color: #cbd5e1;
    }

    .failed-counter {
      color: #f87171;
      margin-left: 0.35rem;
    }

    .progress-bar-bg {
      height: 8px;
      background: #1e293b;
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-bar-fill {
      height: 100%;
      background: #3b82f6;
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .progress-complete {
      background: #10b981;
    }

    .progress-error {
      background: #ef4444;
    }

    /* Modal Styles */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1.5rem;
    }

    .modal-card {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 12px;
      width: 100%;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }

    .modal-xl {
      max-width: 1200px;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid #1e293b;
    }

    .modal-header h3 {
      margin: 0;
      font-size: 1.25rem;
      color: #f8fafc;
    }

    .modal-sub {
      margin: 0.25rem 0 0 0;
      font-size: 0.825rem;
      color: #94a3b8;
    }

    .modal-sub code {
      font-family: monospace;
      color: #60a5fa;
    }

    .btn-close {
      background: transparent;
      border: none;
      font-size: 1.5rem;
      color: #64748b;
      cursor: pointer;
      line-height: 1;
    }

    .btn-close:hover {
      color: #f1f5f9;
    }

    .modal-body {
      padding: 1.5rem;
      overflow-y: auto;
      flex: 1;
    }

    .modal-footer {
      padding: 1rem 1.5rem;
      border-top: 1px solid #1e293b;
      display: flex;
      justify-content: flex-end;
    }

    /* Results Table */
    .results-table-container {
      border: 1px solid #1e293b;
      border-radius: 8px;
      overflow-x: auto;
    }

    .results-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.85rem;
    }

    .results-table th {
      background: #0b1120;
      color: #94a3b8;
      font-weight: 600;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #1e293b;
      white-space: nowrap;
    }

    .results-table td {
      padding: 0.85rem 1rem;
      border-bottom: 1px solid #1e293b;
      vertical-align: top;
      color: #cbd5e1;
    }

    .col-idx {
      font-family: monospace;
      color: #64748b;
    }

    .cell-question strong {
      color: #f8fafc;
      font-size: 0.875rem;
      display: block;
      margin-bottom: 0.35rem;
    }

    .expected-answer-box {
      background: rgba(30, 41, 59, 0.6);
      padding: 0.4rem 0.6rem;
      border-radius: 6px;
      font-size: 0.8rem;
    }

    .expected-answer-box .sub-label {
      color: #60a5fa;
      font-weight: 600;
      font-size: 0.75rem;
      display: block;
      margin-bottom: 0.15rem;
    }

    .expected-answer-box p {
      margin: 0;
      color: #94a3b8;
    }

    .generated-answer-text {
      color: #e2e8f0;
      white-space: pre-wrap;
      line-height: 1.45;
    }

    .error-badge-text {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #fca5a5;
      padding: 0.4rem 0.6rem;
      border-radius: 6px;
      font-size: 0.8rem;
    }

    .contexts-count {
      font-size: 0.75rem;
      color: #38bdf8;
      font-weight: 600;
      display: block;
      margin-bottom: 0.25rem;
    }

    .contexts-list {
      margin: 0;
      padding-left: 1.1rem;
      color: #94a3b8;
      font-size: 0.775rem;
      max-height: 100px;
      overflow-y: auto;
    }

    .contexts-list li {
      margin-bottom: 0.25rem;
    }

    .latency-badge {
      font-family: monospace;
      font-size: 0.75rem;
      background: #1e293b;
      padding: 0.2rem 0.45rem;
      border-radius: 4px;
      color: #f1f5f9;
      white-space: nowrap;
    }

    .mini-status-badge {
      display: inline-block;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.04em;
    }

    .badge-ok {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .badge-err {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .row-failed {
      background: rgba(239, 68, 68, 0.03);
    }

    .text-muted {
      color: #64748b;
      font-size: 0.8rem;
    }

    .empty-state {
      text-align: center;
      padding: 3rem 1.5rem;
      background: #0f172a;
      border: 1px dashed #334155;
      border-radius: 12px;
    }

    .empty-icon {
      color: #64748b;
      margin-bottom: 0.75rem;
    }

    .empty-state h3 {
      margin: 0 0 0.5rem 0;
      color: #f1f5f9;
    }

    .empty-state p {
      margin: 0;
      color: #94a3b8;
      font-size: 0.9rem;
    }

    .spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 0.8s linear infinite;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      padding: 3rem;
      color: #94a3b8;
    }

    .loading-state .spinner {
      width: 28px;
      height: 28px;
      border-width: 3px;
      border-top-color: #3b82f6;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `],
})
export class EvaluationComponent implements OnInit, OnDestroy {
  private readonly projectService = inject(ProjectService);
  private readonly ragConfigService = inject(RAGConfigurationService);
  private readonly evaluationService = inject(EvaluationService);
  private readonly route = inject(ActivatedRoute);

  // Selections
  projects = signal<Project[]>([]);
  datasets = signal<Dataset[]>([]);
  ragConfigs = signal<RAGConfiguration[]>([]);

  selectedProjectId = '';
  selectedDatasetId = '';
  selectedRagConfigId = '';

  loadingProjectResources = signal<boolean>(false);
  submittingRun = signal<boolean>(false);
  formError = signal<string | null>(null);

  // Runs
  runs = signal<EvaluationRun[]>([]);
  loadingRuns = signal<boolean>(false);

  // Modal / Results
  showResultsModal = signal<boolean>(false);
  activeRun = signal<EvaluationRun | null>(null);
  results = signal<EvaluationResult[]>([]);
  loadingResults = signal<boolean>(false);

  private pollIntervalId: any = null;

  ngOnInit(): void {
    const queryProj = this.route.snapshot.queryParams['projectId'];
    if (queryProj) {
      this.selectedProjectId = queryProj;
    }

    this.loadProjects();
    this.loadEvaluations();
    this.startPolling();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollIntervalId = setInterval(() => {
      // Poll if any run is currently running or pending
      const hasActive = this.runs().some(
        (r) => r.status === 'running' || r.status === 'pending'
      );
      if (hasActive) {
        this.loadEvaluations(false);
      }
    }, 2000);
  }

  private stopPolling(): void {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  loadProjects(): void {
    this.projectService.listProjects().subscribe({
      next: (projs) => {
        this.projects.set(projs);
        if (projs.length > 0) {
          if (!this.selectedProjectId) {
            this.selectedProjectId = projs[0].id;
          }
          this.loadProjectResources(this.selectedProjectId);
        }
      },
      error: () => {},
    });
  }

  onProjectSelectionChange(projectId: string): void {
    this.selectedProjectId = projectId;
    this.selectedDatasetId = '';
    this.selectedRagConfigId = '';
    if (projectId) {
      this.loadProjectResources(projectId);
    } else {
      this.datasets.set([]);
      this.ragConfigs.set([]);
    }
  }

  loadProjectResources(projectId: string): void {
    this.loadingProjectResources.set(true);

    this.projectService.listDatasets(projectId).subscribe({
      next: (dsList: Dataset[]) => {
        this.datasets.set(dsList);
        if (dsList.length > 0) {
          this.selectedDatasetId = dsList[0].id;
        }
      },
      error: () => {},
    });

    this.ragConfigService.listConfigurations(projectId).subscribe({
      next: (cfgList) => {
        this.ragConfigs.set(cfgList);
        if (cfgList.length > 0) {
          this.selectedRagConfigId = cfgList[0].id;
        }
        this.loadingProjectResources.set(false);
      },
      error: () => {
        this.loadingProjectResources.set(false);
      },
    });
  }

  loadEvaluations(showLoader = true): void {
    if (showLoader) {
      this.loadingRuns.set(true);
    }

    this.evaluationService.listEvaluations().subscribe({
      next: (data) => {
        this.runs.set(data);
        if (showLoader) {
          this.loadingRuns.set(false);
        }
      },
      error: () => {
        if (showLoader) {
          this.loadingRuns.set(false);
        }
      },
    });
  }

  startNewEvaluation(): void {
    if (!this.selectedProjectId || !this.selectedDatasetId || !this.selectedRagConfigId) {
      this.formError.set('Please select a project, dataset, and RAG configuration.');
      return;
    }

    this.formError.set(null);
    this.submittingRun.set(true);

    const payload: CreateEvaluationRequest = {
      projectId: this.selectedProjectId,
      datasetId: this.selectedDatasetId,
      ragConfigurationId: this.selectedRagConfigId,
    };

    this.evaluationService.startEvaluation(payload).subscribe({
      next: (newRun) => {
        this.submittingRun.set(false);
        // Prepend new run to list
        this.runs.update((list) => [newRun, ...list]);
        // Trigger immediate poll
        this.startPolling();
      },
      error: (err) => {
        this.submittingRun.set(false);
        this.formError.set(err.error?.error?.message || 'Failed to start evaluation run.');
      },
    });
  }

  cancelRun(runId: string): void {
    this.evaluationService.cancelEvaluation(runId).subscribe({
      next: (updated) => {
        this.runs.update((list) =>
          list.map((r) => (r.id === updated.id ? updated : r))
        );
      },
      error: () => {},
    });
  }

  openResultsModal(run: EvaluationRun): void {
    this.activeRun.set(run);
    this.showResultsModal.set(true);
    this.loadingResults.set(true);

    this.evaluationService.getEvaluationResults(run.id).subscribe({
      next: (res) => {
        this.results.set(res);
        this.loadingResults.set(false);
      },
      error: () => {
        this.loadingResults.set(false);
      },
    });
  }

  closeResultsModal(): void {
    this.showResultsModal.set(false);
    this.activeRun.set(null);
    this.results.set([]);
  }

  getProgressPercent(run: EvaluationRun): number {
    if (!run.totalQuestions || run.totalQuestions === 0) return 0;
    const pct = Math.round((run.completedQuestions / run.totalQuestions) * 100);
    return Math.min(100, Math.max(0, pct));
  }
}
