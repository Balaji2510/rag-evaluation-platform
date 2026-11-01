import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Project } from '../../../core/models/project.model';
import { EvaluationRun } from '../../../core/models/evaluation.model';
import {
  ComparisonResponse,
  MetricComparison,
} from '../../../core/models/comparison.model';
import { ProjectService } from '../../../core/services/project.service';
import { EvaluationService } from '../../../core/services/evaluation.service';
import { ComparisonService } from '../../../core/services/comparison.service';

@Component({
  selector: 'app-project-compare',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="compare-page">
      <!-- Breadcrumbs -->
      <div class="breadcrumbs">
        <a routerLink="/projects">Projects</a>
        <span class="sep">/</span>
        @if (project(); as p) {
          <a [routerLink]="['/projects', p.id]">{{ p.name }}</a>
          <span class="sep">/</span>
        }
        <span class="current">Run Comparison</span>
      </div>

      <!-- Page Header -->
      <div class="page-header">
        <div>
          <h1>Evaluation Run Comparison</h1>
          <p class="subtitle">
            Benchmark two evaluation runs head-to-head to detect quality regressions and latency trade-offs
          </p>
        </div>
        @if (project(); as p) {
          <a [routerLink]="['/projects', p.id]" class="btn btn-secondary btn-sm">
            ← Back to Project
          </a>
        }
      </div>

      <!-- Run Selector Card -->
      <div class="card selector-card">
        <div class="selector-grid">
          <!-- Run A Selection -->
          <div class="select-col">
            <label for="selectRunA">
              <span class="run-tag tag-a">RUN A (Baseline)</span>
            </label>
            <select
              id="selectRunA"
              [(ngModel)]="selectedRunAId"
              class="select-input"
              [disabled]="loadingRuns() || comparing()"
            >
              <option value="" disabled>-- Select Baseline Run A --</option>
              @for (run of completedRuns(); track run.id) {
                <option [value]="run.id">
                  {{ run.id.slice(0, 8) }} • {{ run.ragConfigurationName || 'Pipeline' }}
                  (Score: {{ run.overallScore !== null && run.overallScore !== undefined ? run.overallScore : 'N/A' }} |
                  {{ run.createdAt | date:'shortDate' }})
                </option>
              }
            </select>
          </div>

          <!-- Swap Button -->
          <div class="swap-col">
            <button
              (click)="swapRuns()"
              class="btn btn-secondary btn-icon"
              title="Swap Run A and Run B"
              [disabled]="!selectedRunAId || !selectedRunBId || comparing()"
            >
              ⇄
            </button>
          </div>

          <!-- Run B Selection -->
          <div class="select-col">
            <label for="selectRunB">
              <span class="run-tag tag-b">RUN B (Candidate)</span>
            </label>
            <select
              id="selectRunB"
              [(ngModel)]="selectedRunBId"
              class="select-input"
              [disabled]="loadingRuns() || comparing()"
            >
              <option value="" disabled>-- Select Candidate Run B --</option>
              @for (run of completedRuns(); track run.id) {
                <option [value]="run.id">
                  {{ run.id.slice(0, 8) }} • {{ run.ragConfigurationName || 'Pipeline' }}
                  (Score: {{ run.overallScore !== null && run.overallScore !== undefined ? run.overallScore : 'N/A' }} |
                  {{ run.createdAt | date:'shortDate' }})
                </option>
              }
            </select>
          </div>

          <!-- Action Button -->
          <div class="action-col">
            <button
              (click)="runComparison()"
              class="btn btn-primary btn-compare"
              [disabled]="!canCompare() || comparing()"
            >
              @if (comparing()) {
                <span class="spinner-sm"></span> Comparing...
              } @else {
                Compare Runs
              }
            </button>
          </div>
        </div>

        @if (selectedRunAId && selectedRunBId && selectedRunAId === selectedRunBId) {
          <div class="warning-banner">
            ⚠️ Please select two different evaluation runs to perform a comparison.
          </div>
        }

        @if (!loadingRuns() && completedRuns().length < 2) {
          <div class="notice-box">
            ℹ️ This project currently has {{ completedRuns().length }} completed evaluation run(s).
            At least two completed runs are required for comparison.
            <a routerLink="/evaluations" class="inline-link">Launch new evaluations →</a>
          </div>
        }
      </div>

      <!-- Error State -->
      @if (compareError()) {
        <div class="error-banner">
          <p>{{ compareError() }}</p>
        </div>
      }

      <!-- Comparison Results Presentation -->
      @if (comparison(); as comp) {
        <!-- High-Level Impact Summary Banner -->
        <div class="card summary-card">
          <div class="summary-top">
            <div class="summary-icon">💡</div>
            <div class="summary-content">
              <span class="summary-label">DETERMINISTIC EVALUATION IMPACT</span>
              <h2 class="summary-sentence">{{ comp.summary }}</h2>
            </div>
          </div>

          <div class="summary-pills-row">
            <div class="metric-pill pill-improved">
              <span class="pill-count">▲ {{ comp.improvedCount }}</span>
              <span class="pill-label">Improved</span>
              @if (comp.improvedMetrics.length > 0) {
                <span class="pill-tags">({{ comp.improvedMetrics.join(', ') }})</span>
              }
            </div>

            <div class="metric-pill pill-regressed">
              <span class="pill-count">▼ {{ comp.regressedCount }}</span>
              <span class="pill-label">Regressed</span>
              @if (comp.regressedMetrics.length > 0) {
                <span class="pill-tags">({{ comp.regressedMetrics.join(', ') }})</span>
              }
            </div>

            <div class="metric-pill pill-unchanged">
              <span class="pill-count">= {{ comp.unchangedCount }}</span>
              <span class="pill-label">Unchanged</span>
              @if (comp.unchangedMetrics.length > 0) {
                <span class="pill-tags">({{ comp.unchangedMetrics.join(', ') }})</span>
              }
            </div>
          </div>
        </div>

        <!-- Run Headers Comparison Cards -->
        <div class="run-cards-grid">
          <div class="card run-info-card baseline-card">
            <div class="run-card-header">
              <span class="run-tag tag-a">RUN A (Baseline)</span>
              <a [routerLink]="['/evaluations', comp.runA.id]" class="view-run-link" target="_blank">
                View Full Run ↗
              </a>
            </div>
            <h3 class="run-name">{{ comp.runA.ragConfigurationName || 'Pipeline A' }}</h3>
            <div class="meta-row">
              <span class="meta-lbl">Dataset:</span>
              <span class="meta-val">{{ comp.runA.datasetName || comp.runA.datasetId }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-lbl">Run ID:</span>
              <span class="meta-val code">{{ comp.runA.id.slice(0, 8) }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-lbl">Evaluated Questions:</span>
              <span class="meta-val">{{ comp.runA.completedQuestions }} / {{ comp.runA.totalQuestions }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-lbl">Timestamp:</span>
              <span class="meta-val">{{ comp.runA.createdAt | date:'medium' }}</span>
            </div>
          </div>

          <div class="card run-info-card candidate-card">
            <div class="run-card-header">
              <span class="run-tag tag-b">RUN B (Candidate)</span>
              <a [routerLink]="['/evaluations', comp.runB.id]" class="view-run-link" target="_blank">
                View Full Run ↗
              </a>
            </div>
            <h3 class="run-name">{{ comp.runB.ragConfigurationName || 'Pipeline B' }}</h3>
            <div class="meta-row">
              <span class="meta-lbl">Dataset:</span>
              <span class="meta-val">{{ comp.runB.datasetName || comp.runB.datasetId }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-lbl">Run ID:</span>
              <span class="meta-val code">{{ comp.runB.id.slice(0, 8) }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-lbl">Evaluated Questions:</span>
              <span class="meta-val">{{ comp.runB.completedQuestions }} / {{ comp.runB.totalQuestions }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-lbl">Timestamp:</span>
              <span class="meta-val">{{ comp.runB.createdAt | date:'medium' }}</span>
            </div>
          </div>
        </div>

        <!-- Comparison Table Card -->
        <div class="card table-card">
          <div class="card-header">
            <h3>Detailed Metric Comparison</h3>
            <span class="table-subtitle">Computed differences and classification based on directionality</span>
          </div>

          <div class="table-responsive">
            <table class="compare-table">
              <thead>
                <tr>
                  <th style="width: 25%;">Metric</th>
                  <th style="width: 18%;">Run A (Baseline)</th>
                  <th style="width: 18%;">Run B (Candidate)</th>
                  <th style="width: 19%;">Change</th>
                  <th style="width: 20%;">Result</th>
                </tr>
              </thead>
              <tbody>
                @for (m of comp.metrics; track m.key) {
                  <tr [class.highlight-row]="m.key === 'overallScore'">
                    <td class="col-metric">
                      <div class="metric-title-box">
                        <strong>{{ m.name }}</strong>
                        @if (m.key === 'overallScore') {
                          <span class="primary-pill">Primary</span>
                        }
                        @if (!m.higherIsBetter) {
                          <span class="note-pill">Lower is better</span>
                        }
                      </div>
                    </td>

                    <td class="col-val">
                      <div class="val-container">
                        <span
                          class="metric-val"
                          [ngClass]="getScoreTierClass(m.runA, m.higherIsBetter)"
                        >
                          {{ formatMetricValue(m.runA, m.unit) }}
                        </span>
                      </div>
                    </td>

                    <td class="col-val">
                      <div class="val-container">
                        <span
                          class="metric-val"
                          [ngClass]="getScoreTierClass(m.runB, m.higherIsBetter)"
                        >
                          {{ formatMetricValue(m.runB, m.unit) }}
                        </span>
                      </div>
                    </td>

                    <td class="col-change">
                      <div class="change-container" [ngClass]="'change-' + m.status">
                        <span class="change-pct">{{ m.formattedChange }}</span>
                        @if (m.absoluteDifference !== null && m.absoluteDifference !== undefined && m.absoluteDifference !== 0) {
                          <span class="change-abs">
                            ({{ m.absoluteDifference > 0 ? '+' : '' }}{{ m.absoluteDifference }}{{ m.unit ? ' ' + m.unit : '' }})
                          </span>
                        }
                      </div>
                    </td>

                    <td class="col-result">
                      <span class="status-badge" [ngClass]="'status-' + m.status">
                        @if (m.status === 'improved') {
                          ▲ Improved
                        } @else if (m.status === 'regressed') {
                          ▼ Regressed
                        } @else {
                          = No Change
                        }
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .compare-page {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .breadcrumbs {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: #94a3b8;
    }

    .breadcrumbs a {
      color: #38bdf8;
      text-decoration: none;
    }

    .breadcrumbs a:hover {
      text-decoration: underline;
    }

    .sep {
      color: #64748b;
    }

    .current {
      color: #cbd5e1;
      font-weight: 500;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
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
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 1.5rem;
    }

    .selector-card {
      background: #1e293b;
      border: 1px solid #3b82f6;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.4);
    }

    .selector-grid {
      display: grid;
      grid-template-columns: 1fr auto 1fr auto;
      gap: 1rem;
      align-items: flex-end;
    }

    .select-col {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .run-tag {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.2rem 0.6rem;
      border-radius: 6px;
      display: inline-block;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .tag-a {
      background: #1e3a8a;
      color: #93c5fd;
      border: 1px solid #3b82f6;
    }

    .tag-b {
      background: #581c87;
      color: #d8b4fe;
      border: 1px solid #a855f7;
    }

    .select-input {
      background: #0f172a;
      border: 1px solid #334155;
      color: #f8fafc;
      padding: 0.65rem 0.85rem;
      border-radius: 8px;
      font-size: 0.9rem;
      width: 100%;
    }

    .select-input:focus {
      outline: none;
      border-color: #38bdf8;
    }

    .swap-col {
      padding-bottom: 0.15rem;
    }

    .btn-icon {
      padding: 0.65rem 0.9rem;
      font-size: 1.1rem;
      font-weight: bold;
    }

    .btn-compare {
      padding: 0.65rem 1.4rem;
      font-weight: 600;
      white-space: nowrap;
    }

    .warning-banner {
      margin-top: 1rem;
      background: #451a03;
      border: 1px solid #b45309;
      color: #fde68a;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-size: 0.875rem;
    }

    .notice-box {
      margin-top: 1rem;
      background: #0f172a;
      border: 1px dashed #475569;
      color: #94a3b8;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-size: 0.875rem;
    }

    .inline-link {
      color: #38bdf8;
      text-decoration: underline;
      margin-left: 0.5rem;
    }

    .error-banner {
      background: #450a0a;
      border: 1px solid #dc2626;
      color: #fca5a5;
      padding: 1rem;
      border-radius: 8px;
    }

    /* Summary Hero Banner */
    .summary-card {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      border: 1px solid #38bdf8;
      box-shadow: 0 4px 20px rgba(56, 189, 248, 0.12);
    }

    .summary-top {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }

    .summary-icon {
      font-size: 2rem;
      line-height: 1;
    }

    .summary-content {
      flex: 1;
    }

    .summary-label {
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #38bdf8;
      text-transform: uppercase;
    }

    .summary-sentence {
      margin: 0.35rem 0 0 0;
      font-size: 1.35rem;
      font-weight: 700;
      color: #f8fafc;
      line-height: 1.4;
    }

    .summary-pills-row {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      padding-top: 1rem;
      border-top: 1px solid #334155;
    }

    .metric-pill {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.4rem 0.85rem;
      border-radius: 20px;
      font-size: 0.85rem;
    }

    .pill-count {
      font-weight: 800;
    }

    .pill-label {
      font-weight: 600;
    }

    .pill-tags {
      font-size: 0.75rem;
      opacity: 0.85;
    }

    .pill-improved {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid #10b981;
    }

    .pill-regressed {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid #ef4444;
    }

    .pill-unchanged {
      background: rgba(100, 116, 139, 0.15);
      color: #94a3b8;
      border: 1px solid #64748b;
    }

    /* Run Cards Grid */
    .run-cards-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
    }

    .run-info-card {
      background: #1e293b;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .baseline-card {
      border-left: 4px solid #3b82f6;
    }

    .candidate-card {
      border-left: 4px solid #a855f7;
    }

    .run-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.25rem;
    }

    .view-run-link {
      font-size: 0.8rem;
      color: #38bdf8;
      text-decoration: none;
    }

    .view-run-link:hover {
      text-decoration: underline;
    }

    .run-name {
      margin: 0 0 0.5rem 0;
      font-size: 1.15rem;
      color: #f1f5f9;
      font-weight: 600;
    }

    .meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
      padding: 0.2rem 0;
      border-bottom: 1px solid #293548;
    }

    .meta-lbl {
      color: #94a3b8;
    }

    .meta-val {
      color: #e2e8f0;
      font-weight: 500;
    }

    .meta-val.code {
      font-family: monospace;
      color: #38bdf8;
    }

    /* Comparison Table */
    .table-card {
      padding: 0;
      overflow: hidden;
    }

    .table-card .card-header {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid #334155;
    }

    .table-card .card-header h3 {
      margin: 0 0 0.25rem 0;
      font-size: 1.15rem;
      color: #f8fafc;
    }

    .table-subtitle {
      font-size: 0.85rem;
      color: #94a3b8;
    }

    .table-responsive {
      overflow-x: auto;
    }

    .compare-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    .compare-table th {
      background: #0f172a;
      color: #94a3b8;
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.9rem 1.25rem;
      border-bottom: 1px solid #334155;
    }

    .compare-table td {
      padding: 1rem 1.25rem;
      border-bottom: 1px solid #293548;
      font-size: 0.95rem;
      color: #e2e8f0;
    }

    .compare-table tr:last-child td {
      border-bottom: none;
    }

    .highlight-row {
      background: rgba(56, 189, 248, 0.04);
    }

    .metric-title-box {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .primary-pill {
      font-size: 0.7rem;
      background: #0284c7;
      color: #ffffff;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      font-weight: 600;
    }

    .note-pill {
      font-size: 0.7rem;
      background: #334155;
      color: #94a3b8;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
    }

    .metric-val {
      font-weight: 700;
      font-size: 1rem;
    }

    .val-good {
      color: #10b981;
    }

    .val-warn {
      color: #f59e0b;
    }

    .val-poor {
      color: #ef4444;
    }

    .val-neutral {
      color: #94a3b8;
    }

    .change-container {
      display: flex;
      align-items: baseline;
      gap: 0.35rem;
      font-weight: 700;
    }

    .change-pct {
      font-size: 1.05rem;
    }

    .change-abs {
      font-size: 0.8rem;
      font-weight: 400;
      opacity: 0.8;
    }

    .change-improved {
      color: #10b981;
    }

    .change-regressed {
      color: #ef4444;
    }

    .change-no-change {
      color: #94a3b8;
    }

    .status-badge {
      display: inline-block;
      font-size: 0.8rem;
      font-weight: 700;
      padding: 0.3rem 0.75rem;
      border-radius: 20px;
      letter-spacing: 0.02em;
    }

    .status-improved {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid #10b981;
    }

    .status-regressed {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid #ef4444;
    }

    .status-no-change {
      background: rgba(100, 116, 139, 0.15);
      color: #cbd5e1;
      border: 1px solid #64748b;
    }

    /* Utilities */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      border-radius: 8px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      text-decoration: none;
      transition: all 0.15s ease;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-primary {
      background: #0284c7;
      color: #ffffff;
    }

    .btn-primary:hover:not(:disabled) {
      background: #0369a1;
    }

    .btn-secondary {
      background: #334155;
      color: #f8fafc;
    }

    .btn-secondary:hover:not(:disabled) {
      background: #475569;
    }

    .btn-sm {
      padding: 0.4rem 0.85rem;
      font-size: 0.85rem;
    }

    .spinner-sm {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      display: inline-block;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @media (max-width: 900px) {
      .selector-grid {
        grid-template-columns: 1fr;
      }
      .run-cards-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class ProjectCompareComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly projectService = inject(ProjectService);
  private readonly evaluationService = inject(EvaluationService);
  private readonly comparisonService = inject(ComparisonService);

  projectId = '';
  project = signal<Project | null>(null);
  completedRuns = signal<EvaluationRun[]>([]);
  comparison = signal<ComparisonResponse | null>(null);

  selectedRunAId = '';
  selectedRunBId = '';

  loadingRuns = signal<boolean>(false);
  comparing = signal<boolean>(false);
  compareError = signal<string | null>(null);

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id') || '';

    // Check optional query params (?runA=...&runB=...)
    const queryRunA = this.route.snapshot.queryParamMap.get('runA');
    const queryRunB = this.route.snapshot.queryParamMap.get('runB');
    if (queryRunA) this.selectedRunAId = queryRunA;
    if (queryRunB) this.selectedRunBId = queryRunB;

    if (this.projectId) {
      this.loadProject();
      this.loadRuns();
    }
  }

  loadProject(): void {
    this.projectService.getProject(this.projectId).subscribe({
      next: (proj) => this.project.set(proj),
      error: (err) => console.error('Failed to load project:', err),
    });
  }

  loadRuns(): void {
    this.loadingRuns.set(true);
    this.evaluationService.listEvaluations(this.projectId).subscribe({
      next: (runs) => {
        this.loadingRuns.set(false);
        // Keep completed and evaluated runs
        const finished = runs.filter(
          (r) => r.status === 'completed' || r.completedQuestions > 0
        );
        this.completedRuns.set(finished);

        // Auto-select latest two runs if not explicitly set via query params
        if (!this.selectedRunAId && finished.length >= 2) {
          this.selectedRunAId = finished[1].id; // Earlier run as Baseline A
          this.selectedRunBId = finished[0].id; // Newer run as Candidate B
          this.runComparison();
        } else if (this.selectedRunAId && this.selectedRunBId) {
          this.runComparison();
        }
      },
      error: (err) => {
        this.loadingRuns.set(false);
        console.error('Failed to load runs for comparison:', err);
      },
    });
  }

  canCompare(): boolean {
    return (
      !!this.selectedRunAId &&
      !!this.selectedRunBId &&
      this.selectedRunAId !== this.selectedRunBId
    );
  }

  swapRuns(): void {
    const temp = this.selectedRunAId;
    this.selectedRunAId = this.selectedRunBId;
    this.selectedRunBId = temp;
    if (this.canCompare()) {
      this.runComparison();
    }
  }

  runComparison(): void {
    if (!this.canCompare()) return;

    this.comparing.set(true);
    this.compareError.set(null);

    this.comparisonService
      .compareRuns({
        runA: this.selectedRunAId,
        runB: this.selectedRunBId,
      })
      .subscribe({
        next: (res) => {
          this.comparing.set(false);
          this.comparison.set(res);
        },
        error: (err) => {
          this.comparing.set(false);
          const msg =
            err.error?.error?.message ||
            'Failed to execute evaluation comparison. Please ensure both runs are completed.';
          this.compareError.set(msg);
        },
      });
  }

  formatMetricValue(val: number | null, unit?: string | null): string {
    if (val === null || val === undefined) return 'N/A';
    if (unit === 'ms') {
      return `${Math.round(val)} ms`;
    }
    return val.toFixed(2);
  }

  getScoreTierClass(val: number | null, higherIsBetter: boolean): string {
    if (val === null || val === undefined) return 'val-neutral';
    if (!higherIsBetter) {
      // Latency: < 500ms Good, 500-1500ms Warn, > 1500ms Poor
      if (val < 500) return 'val-good';
      if (val <= 1500) return 'val-warn';
      return 'val-poor';
    }
    // Quality scores (0.0 - 1.0)
    if (val >= 0.8) return 'val-good';
    if (val >= 0.5) return 'val-warn';
    return 'val-poor';
  }
}

