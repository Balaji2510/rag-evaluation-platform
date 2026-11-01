import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { WorkspaceService } from '../../core/services/workspace.service';
import { EvaluationService } from '../../core/services/evaluation.service';
import { ApiKeyItem, ProjectThresholds, WebhookItem } from '../../core/models/evaluation.model';
import { Project } from '../../core/models/project.model';

type SettingsTab = 'api-keys' | 'thresholds' | 'webhooks' | 'evaluator';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="settings-page">
      <!-- 1. Header -->
      <header class="settings-header">
        <div class="header-titles">
          <div class="title-row">
            <h1 class="page-title">Settings & Developer Integrations</h1>
            <span class="badge-postman">Postman for RAG</span>
          </div>
          <p class="page-subtitle">
            Configure external API keys for CI/CD pipelines, quality gate thresholds, webhook dispatchers, and evaluation models.
          </p>
        </div>
      </header>

      <!-- 2. Settings Tabs Navigation -->
      <nav class="settings-tabs-nav">
        <button
          type="button"
          class="tab-btn"
          [class.active]="activeTab() === 'api-keys'"
          (click)="switchTab('api-keys')"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 2l-2 2m-1-1l-3 3m-1-1l-2 2m-1-1l-3 3"></path>
            <circle cx="7.5" cy="16.5" r="4.5"></circle>
          </svg>
          <span>API Keys & CI/CD</span>
          <span class="tab-counter">{{ apiKeys().length }}</span>
        </button>

        <button
          type="button"
          class="tab-btn"
          [class.active]="activeTab() === 'thresholds'"
          (click)="switchTab('thresholds')"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          <span>Quality Gate Thresholds</span>
        </button>

        <button
          type="button"
          class="tab-btn"
          [class.active]="activeTab() === 'webhooks'"
          (click)="switchTab('webhooks')"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <span>Webhooks & Alerts</span>
          <span class="tab-counter">{{ webhooks().length }}</span>
        </button>

        <button
          type="button"
          class="tab-btn"
          [class.active]="activeTab() === 'evaluator'"
          (click)="switchTab('evaluator')"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          <span>Evaluator & Platform</span>
        </button>
      </nav>

      <!-- TAB 1: API KEYS & CI/CD -->
      @if (activeTab() === 'api-keys') {
        <div class="tab-content-pane">
          <!-- Newly Generated Key Alert Banner -->
          @if (newlyCreatedKey()) {
            <div class="key-created-alert">
              <div class="alert-header">
                <div class="alert-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <div>
                  <h3 class="alert-title">API Key Created Successfully</h3>
                  <p class="alert-desc">
                    Save this secret key now. For your security, <strong>it will never be displayed again</strong>.
                  </p>
                </div>
                <button type="button" class="btn-dismiss" (click)="newlyCreatedKey.set(null)">×</button>
              </div>

              <div class="key-reveal-box">
                <span class="key-token monospace">{{ newlyCreatedKey()!.secretKey }}</span>
                <button
                  type="button"
                  class="btn-copy-token"
                  (click)="copyToClipboard(newlyCreatedKey()!.secretKey!, 'token')"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  <span>{{ copiedField() === 'token' ? 'Copied!' : 'Copy Key' }}</span>
                </button>
              </div>
            </div>
          }

          <!-- API Keys Management Card -->
          <div class="card-section">
            <div class="card-section-header">
              <div>
                <h2 class="section-title">External Integration API Keys</h2>
                <p class="section-subtitle">
                  Use API keys to authenticate automated evaluations from GitHub Actions, CI/CD runners, or the <code>rageval</code> CLI.
                </p>
              </div>
              <button type="button" class="btn-action primary" (click)="openCreateKeyModal()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 5v14M5 12h14"></path>
                </svg>
                <span>Generate New API Key</span>
              </button>
            </div>

            <!-- API Keys Table -->
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>NAME</th>
                    <th>KEY PREFIX</th>
                    <th>SCOPE</th>
                    <th>CREATED</th>
                    <th>LAST USED</th>
                    <th>STATUS</th>
                    <th class="text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  @for (key of apiKeys(); track key.id) {
                    <tr>
                      <td class="cell-key-name">
                        <span class="key-name-text">{{ key.name }}</span>
                      </td>
                      <td>
                        <span class="prefix-badge monospace">{{ key.keyPrefix }}...</span>
                      </td>
                      <td>
                        <span class="scope-pill">
                          {{ key.projectId ? getProjectName(key.projectId) : 'Global (All Projects)' }}
                        </span>
                      </td>
                      <td class="cell-muted">{{ key.createdAt | date: 'mediumDate' }}</td>
                      <td class="cell-muted monospace">
                        {{ key.lastUsedAt ? (key.lastUsedAt | date: 'short') : 'Never' }}
                      </td>
                      <td>
                        <span class="status-badge" [class.active]="!key.isRevoked" [class.revoked]="key.isRevoked">
                          <span class="badge-dot"></span>
                          {{ key.isRevoked ? 'REVOKED' : 'ACTIVE' }}
                        </span>
                      </td>
                      <td class="text-right">
                        @if (!key.isRevoked) {
                          <button
                            type="button"
                            class="btn-revoke"
                            (click)="revokeApiKey(key.id, key.name)"
                            title="Revoke API Key"
                          >
                            Revoke
                          </button>
                        } @else {
                          <span class="text-muted">—</span>
                        }
                      </td>
                    </tr>
                  }
                  @if (apiKeys().length === 0) {
                    <tr>
                      <td colspan="7" class="empty-table-cell">
                        No API keys generated yet. Click <strong>Generate New API Key</strong> to authenticate external pipelines.
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>

          <!-- Developer Integration Guide (Postman / Linear style) -->
          <div class="card-section docs-card">
            <h2 class="section-title">Integration & Automation Guide</h2>
            <p class="section-subtitle">Connect your RAG Evaluation Platform to your continuous delivery workflows.</p>

            <div class="code-snippets-grid">
              <!-- CLI Usage -->
              <div class="snippet-block">
                <div class="snippet-header">
                  <span class="snippet-title">RAG Eval CLI Usage</span>
                  <button type="button" class="btn-copy-code" (click)="copyToClipboard(cliCodeSnippet, 'cli')">
                    {{ copiedField() === 'cli' ? 'Copied!' : 'Copy' }}
                  </button>
                </div>
                <pre class="code-box"><code>{{ cliCodeSnippet }}</code></pre>
              </div>

              <!-- cURL API -->
              <div class="snippet-block">
                <div class="snippet-header">
                  <span class="snippet-title">cURL API Request</span>
                  <button type="button" class="btn-copy-code" (click)="copyToClipboard(curlCodeSnippet, 'curl')">
                    {{ copiedField() === 'curl' ? 'Copied!' : 'Copy' }}
                  </button>
                </div>
                <pre class="code-box"><code>{{ curlCodeSnippet }}</code></pre>
              </div>

              <!-- GitHub Actions Workflow -->
              <div class="snippet-block full-width">
                <div class="snippet-header">
                  <span class="snippet-title">GitHub Actions Quality Gate Workflow (.github/workflows/rag-eval.yml)</span>
                  <button type="button" class="btn-copy-code" (click)="copyToClipboard(githubActionsSnippet, 'gha')">
                    {{ copiedField() === 'gha' ? 'Copied!' : 'Copy' }}
                  </button>
                </div>
                <pre class="code-box"><code>{{ githubActionsSnippet }}</code></pre>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- TAB 2: QUALITY GATE THRESHOLDS -->
      @if (activeTab() === 'thresholds') {
        <div class="tab-content-pane">
          <div class="card-section">
            <div class="card-section-header">
              <div>
                <h2 class="section-title">Quality Gate Standards</h2>
                <p class="section-subtitle">
                  Define automated pass/fail criteria for pull requests and benchmark runs. If any metric falls below its threshold, the Quality Gate fails with exit code 1.
                </p>
              </div>

              <div class="project-selector-inline">
                <label class="inline-label">Configure for Project:</label>
                <select [(ngModel)]="thresholdProjectId" (change)="loadProjectThresholds()" class="select-project-control">
                  @for (p of workspace.projects(); track p.id) {
                    <option [value]="p.id">{{ p.name }}</option>
                  }
                </select>
              </div>
            </div>

            <!-- Thresholds Sliders / Inputs Form -->
            <div class="thresholds-form-grid">
              <!-- Overall Score -->
              <div class="threshold-field-card">
                <div class="field-header">
                  <span class="field-name">Overall RAG Score Threshold</span>
                  <span class="field-val monospace">{{ (thresholds.overallScore * 100 | number: '1.0-0') }}%</span>
                </div>
                <p class="field-desc">Aggregate weighted quality benchmark across all test questions.</p>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  [(ngModel)]="thresholds.overallScore"
                  class="range-slider"
                />
              </div>

              <!-- Faithfulness -->
              <div class="threshold-field-card">
                <div class="field-header">
                  <span class="field-name">Faithfulness (Hallucination Gate)</span>
                  <span class="field-val monospace">{{ (thresholds.faithfulness * 100 | number: '1.0-0') }}%</span>
                </div>
                <p class="field-desc">Ensures generated answers do not claim facts outside retrieved context passages.</p>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  [(ngModel)]="thresholds.faithfulness"
                  class="range-slider"
                />
              </div>

              <!-- Answer Correctness -->
              <div class="threshold-field-card">
                <div class="field-header">
                  <span class="field-name">Answer Correctness Threshold</span>
                  <span class="field-val monospace">{{ (thresholds.answerCorrectness * 100 | number: '1.0-0') }}%</span>
                </div>
                <p class="field-desc">Semantic alignment and factual parity with golden reference answers.</p>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  [(ngModel)]="thresholds.answerCorrectness"
                  class="range-slider"
                />
              </div>

              <!-- Answer Relevance -->
              <div class="threshold-field-card">
                <div class="field-header">
                  <span class="field-name">Answer Relevance Threshold</span>
                  <span class="field-val monospace">{{ (thresholds.answerRelevance * 100 | number: '1.0-0') }}%</span>
                </div>
                <p class="field-desc">Directness and adherence of the answer to the user's specific prompt.</p>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  [(ngModel)]="thresholds.answerRelevance"
                  class="range-slider"
                />
              </div>

              <!-- Context Relevance -->
              <div class="threshold-field-card">
                <div class="field-header">
                  <span class="field-name">Context Relevance Threshold</span>
                  <span class="field-val monospace">{{ (thresholds.contextRelevance * 100 | number: '1.0-0') }}%</span>
                </div>
                <p class="field-desc">Verifies that retrieved chunks are focused and free from distracting noise.</p>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  [(ngModel)]="thresholds.contextRelevance"
                  class="range-slider"
                />
              </div>

              <!-- Max Latency -->
              <div class="threshold-field-card">
                <div class="field-header">
                  <span class="field-name">Maximum Latency SLA</span>
                  <span class="field-val monospace">{{ (thresholds.maxLatencyMs || 30000 | number: '1.0-0') }} ms</span>
                </div>
                <p class="field-desc">Maximum allowable average round-trip response time before flagging latency regression.</p>
                <input
                  type="number"
                  [(ngModel)]="thresholds.maxLatencyMs"
                  class="number-input"
                  step="500"
                  min="500"
                  max="60000"
                />
              </div>
            </div>

            <!-- Save CTA -->
            <div class="thresholds-actions-bar">
              @if (thresholdSuccessMsg()) {
                <span class="msg-success">✓ {{ thresholdSuccessMsg() }}</span>
              }
              <button
                type="button"
                class="btn-action primary"
                [disabled]="isSavingThresholds()"
                (click)="saveThresholds()"
              >
                <span>{{ isSavingThresholds() ? 'Saving Changes...' : 'Save Thresholds' }}</span>
              </button>
            </div>
          </div>
        </div>
      }

      <!-- TAB 3: WEBHOOKS & ALERTS -->
      @if (activeTab() === 'webhooks') {
        <div class="tab-content-pane">
          <div class="card-section">
            <div class="card-section-header">
              <div>
                <h2 class="section-title">Outgoing Webhooks</h2>
                <p class="section-subtitle">
                  Deliver evaluation payloads, quality gate verdicts, and regression alerts to Slack, Discord, or internal APIs.
                </p>
              </div>
              <button type="button" class="btn-action primary" (click)="openWebhookModal()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 5v14M5 12h14"></path>
                </svg>
                <span>Add Webhook</span>
              </button>
            </div>

            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>TARGET ENDPOINT URL</th>
                    <th>PROJECT</th>
                    <th>SUBSCRIBED EVENTS</th>
                    <th>CREATED</th>
                    <th>STATUS</th>
                    <th class="text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  @for (hook of webhooks(); track hook.id) {
                    <tr>
                      <td>
                        <span class="monospace text-white">{{ hook.url }}</span>
                      </td>
                      <td>{{ getProjectName(hook.projectId) }}</td>
                      <td>
                        <div class="events-pill-row">
                          @for (ev of hook.events; track ev) {
                            <span class="event-pill">{{ ev }}</span>
                          }
                        </div>
                      </td>
                      <td class="cell-muted">{{ hook.createdAt | date: 'mediumDate' }}</td>
                      <td>
                        <span class="status-badge" [class.active]="hook.isActive">
                          <span class="badge-dot"></span>
                          {{ hook.isActive ? 'ACTIVE' : 'INACTIVE' }}
                        </span>
                      </td>
                      <td class="text-right">
                        <button
                          type="button"
                          class="btn-revoke"
                          (click)="deleteWebhook(hook.projectId, hook.id)"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  }
                  @if (webhooks().length === 0) {
                    <tr>
                      <td colspan="6" class="empty-table-cell">
                        No webhooks configured. Click <strong>Add Webhook</strong> to receive evaluation run notifications.
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      }

      <!-- TAB 4: EVALUATOR & PLATFORM CONFIG -->
      @if (activeTab() === 'evaluator') {
        <div class="tab-content-pane">
          <div class="card-section">
            <h2 class="section-title">Evaluator Engine Configuration</h2>
            <p class="section-subtitle">Google Gemini LLM-as-a-judge and vector infrastructure specifications.</p>

            <div class="platform-specs-grid">
              <div class="spec-card">
                <span class="spec-label">ACTIVE EVALUATOR MODEL</span>
                <span class="spec-val">Google Gemini 3.5 Flash-Lite</span>
                <p class="spec-sub">Ultra-fast inference (700ms - 1.2s per metric evaluation)</p>
              </div>

              <div class="spec-card">
                <span class="spec-label">VECTOR EMBEDDINGS MODEL</span>
                <span class="spec-val monospace">models/gemini-embedding-001</span>
                <p class="spec-sub">3072-dimensional dense semantic vectors</p>
              </div>

              <div class="spec-card">
                <span class="spec-label">INTERNAL VECTOR STORE</span>
                <span class="spec-val">MongoDB Atlas Vector Search</span>
                <p class="spec-sub">Cosine similarity indexing with chunk-level metadata</p>
              </div>

              <div class="spec-card">
                <span class="spec-label">BACKEND API RUNTIME</span>
                <span class="spec-val monospace">FastAPI 0.115+ (Python 3.14)</span>
                <p class="spec-sub">Async Motor MongoDB client & LangChain pipeline</p>
              </div>
            </div>
          </div>

          <div class="card-section">
            <h2 class="section-title">Account & Workspace Information</h2>
            <div class="account-info-box">
              <div class="info-row">
                <span class="info-label">Current User:</span>
                <strong class="info-val">{{ authService.currentUser()?.name }}</strong>
              </div>
              <div class="info-row">
                <span class="info-label">Email Address:</span>
                <span class="info-val monospace">{{ authService.currentUser()?.email }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Workspace Role:</span>
                <span class="badge-role">Administrator</span>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- MODAL: Generate API Key -->
      @if (isCreateKeyModalOpen()) {
        <div class="modal-backdrop" (click)="closeCreateKeyModal()">
          <div class="modal-dialog" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3 class="modal-title">Generate API Key</h3>
              <button type="button" class="btn-close-modal" (click)="closeCreateKeyModal()">×</button>
            </div>

            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Key Name / Description</label>
                <input
                  type="text"
                  [(ngModel)]="newKeyName"
                  placeholder="e.g. GitHub Actions CI/CD"
                  class="form-control"
                />
              </div>

              <div class="form-group">
                <label class="form-label">Project Scope (Optional)</label>
                <select [(ngModel)]="newKeyProjectId" class="form-control">
                  <option [value]="''">All Projects (Global)</option>
                  @for (p of workspace.projects(); track p.id) {
                    <option [value]="p.id">{{ p.name }}</option>
                  }
                </select>
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-cancel" (click)="closeCreateKeyModal()">Cancel</button>
              <button
                type="button"
                class="btn-action primary"
                [disabled]="!newKeyName.trim() || isSubmittingKey()"
                (click)="submitCreateApiKey()"
              >
                <span>{{ isSubmittingKey() ? 'Generating...' : 'Create API Key' }}</span>
              </button>
            </div>
          </div>
        </div>
      }

      <!-- MODAL: Add Webhook -->
      @if (isWebhookModalOpen()) {
        <div class="modal-backdrop" (click)="closeWebhookModal()">
          <div class="modal-dialog" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3 class="modal-title">Register Outgoing Webhook</h3>
              <button type="button" class="btn-close-modal" (click)="closeWebhookModal()">×</button>
            </div>

            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Project</label>
                <select [(ngModel)]="newWebhookProjectId" class="form-control">
                  @for (p of workspace.projects(); track p.id) {
                    <option [value]="p.id">{{ p.name }}</option>
                  }
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Webhook Destination URL</label>
                <input
                  type="url"
                  [(ngModel)]="newWebhookUrl"
                  placeholder="https://hooks.slack.com/services/..."
                  class="form-control"
                />
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-cancel" (click)="closeWebhookModal()">Cancel</button>
              <button
                type="button"
                class="btn-action primary"
                [disabled]="!newWebhookUrl.trim() || isSubmittingWebhook()"
                (click)="submitCreateWebhook()"
              >
                <span>{{ isSubmittingWebhook() ? 'Registering...' : 'Save Webhook' }}</span>
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .settings-page {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      max-width: 1200px;
      margin: 0 auto;
      color: #f1f5f9;
    }

    /* 1. Header */
    .settings-header {
      padding-bottom: 1rem;
      border-bottom: 1px solid #1a2333;
    }

    .title-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .page-title {
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.025em;
      margin: 0;
      color: #f8fafc;
    }

    .badge-postman {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.2rem 0.55rem;
      background: #111e33;
      border: 1px solid #1e355b;
      color: #38bdf8;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .page-subtitle {
      font-size: 0.84rem;
      color: #94a3b8;
      margin: 0.35rem 0 0;
    }

    /* 2. Tabs Nav */
    .settings-tabs-nav {
      display: flex;
      gap: 0.5rem;
      border-bottom: 1px solid #1a2333;
      padding-bottom: 0.5rem;
    }

    .tab-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 6px;
      padding: 0.5rem 0.85rem;
      color: #94a3b8;
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .tab-btn:hover {
      background: #111a2c;
      color: #f1f5f9;
    }

    .tab-btn.active {
      background: #132238;
      border-color: #243859;
      color: #38bdf8;
    }

    .tab-counter {
      background: #1b263b;
      font-size: 0.65rem;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 10px;
      color: #cbd5e1;
    }

    /* Tab Panes & Cards */
    .tab-content-pane {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .card-section {
      background: #0b1120;
      border: 1px solid #1a2333;
      border-radius: 6px;
      padding: 1.25rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .card-section-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .section-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: #f8fafc;
      margin: 0;
      letter-spacing: -0.015em;
    }

    .section-subtitle {
      font-size: 0.775rem;
      color: #94a3b8;
      margin: 0.25rem 0 0;
    }

    /* Actions */
    .btn-action {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.45rem 0.85rem;
      border-radius: 5px;
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s ease;
    }

    .btn-action.primary {
      background: #0284c7;
      color: #ffffff;
      border-color: #0369a1;
    }

    .btn-action.primary:hover:not(:disabled) {
      background: #0369a1;
    }

    /* Key Created Alert */
    .key-created-alert {
      background: #0d1e2e;
      border: 1px solid #144062;
      border-radius: 6px;
      padding: 1.15rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }

    .alert-header {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
    }

    .alert-icon {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      background: rgba(16, 185, 129, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .alert-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: #f8fafc;
      margin: 0;
    }

    .alert-desc {
      font-size: 0.775rem;
      color: #94a3b8;
      margin: 2px 0 0;
    }

    .btn-dismiss {
      margin-left: auto;
      background: transparent;
      border: none;
      color: #64748b;
      font-size: 1.25rem;
      cursor: pointer;
      line-height: 1;
    }

    .key-reveal-box {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: #070d17;
      border: 1px solid #1a2f47;
      border-radius: 5px;
      padding: 0.5rem 0.85rem;
    }

    .key-token {
      flex: 1;
      font-size: 0.875rem;
      color: #38bdf8;
      word-break: break-all;
    }

    .btn-copy-token {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: #172840;
      border: 1px solid #233e63;
      color: #f1f5f9;
      padding: 0.35rem 0.65rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-copy-token:hover {
      background: #1e3557;
      border-color: #38bdf8;
    }

    /* Tables */
    .table-container {
      overflow-x: auto;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8125rem;
      text-align: left;
    }

    .data-table th {
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: #64748b;
      padding: 0.6rem 0.75rem;
      border-bottom: 1px solid #1a2333;
      background: #090e1a;
      text-transform: uppercase;
    }

    .data-table td {
      padding: 0.65rem 0.75rem;
      border-bottom: 1px solid #141c2c;
      color: #cbd5e1;
    }

    .cell-key-name {
      font-weight: 600;
      color: #f1f5f9;
    }

    .prefix-badge {
      background: #111a2c;
      border: 1px solid #1e2e4a;
      color: #38bdf8;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.75rem;
    }

    .scope-pill {
      font-size: 0.7rem;
      color: #94a3b8;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.65rem;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .badge-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
    }

    .status-badge.active {
      background: rgba(16, 185, 129, 0.12);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.25);
    }
    .status-badge.active .badge-dot { background: #10b981; }

    .status-badge.revoked {
      background: rgba(239, 68, 68, 0.12);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.25);
    }
    .status-badge.revoked .badge-dot { background: #ef4444; }

    .btn-revoke {
      background: transparent;
      border: 1px solid #33222a;
      color: #f87171;
      font-size: 0.725rem;
      font-weight: 600;
      padding: 0.2rem 0.55rem;
      border-radius: 4px;
      cursor: pointer;
    }

    .btn-revoke:hover {
      background: #451620;
      border-color: #ef4444;
    }

    .empty-table-cell {
      text-align: center;
      color: #64748b;
      padding: 2rem !important;
    }

    /* Documentation Code Snippets */
    .docs-card {
      background: #090e1a;
    }

    .code-snippets-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .snippet-block {
      background: #0b1120;
      border: 1px solid #1a2333;
      border-radius: 6px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .snippet-block.full-width {
      grid-column: 1 / -1;
    }

    .snippet-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.45rem 0.75rem;
      background: #0f1626;
      border-bottom: 1px solid #1a2333;
    }

    .snippet-title {
      font-size: 0.725rem;
      font-weight: 700;
      color: #94a3b8;
    }

    .btn-copy-code {
      background: transparent;
      border: 1px solid #23314a;
      color: #38bdf8;
      font-size: 0.68rem;
      padding: 1px 6px;
      border-radius: 3px;
      cursor: pointer;
    }

    .code-box {
      margin: 0;
      padding: 0.75rem;
      font-family: monospace;
      font-size: 0.75rem;
      color: #cbd5e1;
      overflow-x: auto;
      line-height: 1.45;
    }

    /* Thresholds Form */
    .thresholds-form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .threshold-field-card {
      background: #0f1626;
      border: 1px solid #1a253a;
      border-radius: 6px;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .field-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .field-name {
      font-size: 0.8125rem;
      font-weight: 600;
      color: #f1f5f9;
    }

    .field-val {
      font-size: 0.95rem;
      font-weight: 700;
      color: #38bdf8;
    }

    .field-desc {
      font-size: 0.725rem;
      color: #64748b;
      margin: 0;
    }

    .range-slider {
      width: 100%;
      accent-color: #38bdf8;
      cursor: pointer;
    }

    .number-input {
      background: #090e1a;
      border: 1px solid #1a253a;
      color: #f1f5f9;
      font-family: monospace;
      padding: 0.35rem 0.65rem;
      border-radius: 4px;
      font-size: 0.8125rem;
      outline: none;
    }

    .thresholds-actions-bar {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 1rem;
      border-top: 1px solid #1a2333;
      padding-top: 1rem;
    }

    .msg-success {
      color: #34d399;
      font-size: 0.8125rem;
      font-weight: 600;
    }

    .inline-label {
      font-size: 0.75rem;
      color: #94a3b8;
      margin-right: 0.5rem;
    }

    .select-project-control {
      background: #090e1a;
      border: 1px solid #1a253a;
      color: #f1f5f9;
      padding: 0.35rem 0.65rem;
      border-radius: 4px;
      font-size: 0.8125rem;
      outline: none;
    }

    /* Webhooks */
    .events-pill-row {
      display: flex;
      gap: 0.35rem;
      flex-wrap: wrap;
    }

    .event-pill {
      background: #111e33;
      color: #38bdf8;
      border: 1px solid #1e355b;
      font-size: 0.65rem;
      padding: 1px 5px;
      border-radius: 3px;
      font-family: monospace;
    }

    /* Evaluator Specs */
    .platform-specs-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
    }

    .spec-card {
      background: #0f1626;
      border: 1px solid #1a253a;
      border-radius: 6px;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .spec-label {
      font-size: 0.65rem;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.05em;
    }

    .spec-val {
      font-size: 0.95rem;
      font-weight: 700;
      color: #f1f5f9;
    }

    .spec-sub {
      font-size: 0.7rem;
      color: #94a3b8;
      margin: 0;
    }

    .account-info-box {
      background: #0f1626;
      border: 1px solid #1a253a;
      border-radius: 6px;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .info-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8125rem;
    }

    .info-label {
      color: #64748b;
      width: 120px;
    }

    .badge-role {
      background: #1e293b;
      color: #38bdf8;
      font-size: 0.7rem;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 4px;
    }

    /* Modals */
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-dialog {
      background: #0d1424;
      border: 1px solid #1e2d48;
      border-radius: 8px;
      width: 480px;
      max-width: 90vw;
      box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.8);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid #1a2333;
    }

    .modal-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: #f8fafc;
      margin: 0;
    }

    .btn-close-modal {
      background: transparent;
      border: none;
      color: #64748b;
      font-size: 1.35rem;
      cursor: pointer;
      line-height: 1;
    }

    .modal-body {
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .form-label {
      font-size: 0.725rem;
      font-weight: 600;
      color: #94a3b8;
    }

    .form-control {
      background: #090e1a;
      border: 1px solid #1a253a;
      color: #f1f5f9;
      font-size: 0.8125rem;
      padding: 0.5rem 0.65rem;
      border-radius: 5px;
      outline: none;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.65rem;
      padding: 0.85rem 1.25rem;
      background: #090e1a;
      border-top: 1px solid #1a2333;
    }

    .btn-cancel {
      background: transparent;
      border: 1px solid #28374f;
      color: #94a3b8;
      padding: 0.45rem 0.85rem;
      border-radius: 5px;
      font-size: 0.8125rem;
      cursor: pointer;
    }

    .cell-muted { color: #64748b; }
    .text-right { text-align: right; }
    .monospace { font-family: monospace; }
  `],
})
export class SettingsComponent implements OnInit {
  readonly authService = inject(AuthService);
  readonly workspace = inject(WorkspaceService);
  private readonly evaluationService = inject(EvaluationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly activeTab = signal<SettingsTab>('api-keys');
  readonly apiKeys = signal<ApiKeyItem[]>([]);
  readonly webhooks = signal<WebhookItem[]>([]);
  readonly newlyCreatedKey = signal<ApiKeyItem | null>(null);

  // Thresholds state
  thresholdProjectId: string = '';
  thresholds: ProjectThresholds = {
    overallScore: 0.80,
    faithfulness: 0.85,
    answerCorrectness: 0.80,
    answerRelevance: 0.80,
    contextRelevance: 0.75,
    maxLatencyMs: 30000,
  };
  readonly isSavingThresholds = signal<boolean>(false);
  readonly thresholdSuccessMsg = signal<string | null>(null);

  // Key creation modal state
  readonly isCreateKeyModalOpen = signal<boolean>(false);
  readonly isSubmittingKey = signal<boolean>(false);
  newKeyName: string = '';
  newKeyProjectId: string = '';

  // Webhook creation modal state
  readonly isWebhookModalOpen = signal<boolean>(false);
  readonly isSubmittingWebhook = signal<boolean>(false);
  newWebhookUrl: string = '';
  newWebhookProjectId: string = '';

  // Copy feedback
  readonly copiedField = signal<string | null>(null);

  // Code snippets
  readonly cliCodeSnippet = `# Install or run CLI binary
export RAGEVAL_API_KEY="rageval_live_..."

# Run regression test suite and fail under threshold
rageval run \\
  --project customer-support \\
  --dataset regression-v2 \\
  --fail-under 85`;

  readonly curlCodeSnippet = `curl -X POST "http://localhost:8000/api/evaluations" \\
  -H "X-API-Key: rageval_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "projectId": "62072b9f-...",
    "datasetId": "dset-101",
    "ragConfigurationId": "internal"
  }'`;

  readonly githubActionsSnippet = `name: RAG Quality Gate
on: [pull_request]

jobs:
  rag-evaluation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run RAG Evaluation Benchmark
        env:
          RAGEVAL_API_KEY: \${{ secrets.RAGEVAL_API_KEY }}
        run: |
          curl -s -f -X POST "https://api.rageval.dev/api/evaluations/run" \\
            -H "X-API-Key: $RAGEVAL_API_KEY" \\
            -H "Content-Type: application/json" \\
            -d '{"projectId":"main","datasetId":"golden-regression","ragConfigurationId":"internal"}'
`;

  ngOnInit(): void {
    this.workspace.loadProjects();

    // Check query params for tab
    this.route.queryParams.subscribe((params) => {
      if (params['tab']) {
        const t = params['tab'] as SettingsTab;
        if (['api-keys', 'thresholds', 'webhooks', 'evaluator'].includes(t)) {
          this.activeTab.set(t);
        }
      }
    });

    this.loadApiKeys();

    // Set initial project for thresholds
    const curr = this.workspace.currentProject();
    if (curr) {
      this.thresholdProjectId = curr.id;
      this.loadProjectThresholds();
      this.loadProjectWebhooks(curr.id);
    }
  }

  switchTab(tab: SettingsTab): void {
    this.activeTab.set(tab);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
    });

    if (tab === 'thresholds' && !this.thresholdProjectId) {
      const p = this.workspace.currentProject() || this.workspace.projects()[0];
      if (p) {
        this.thresholdProjectId = p.id;
        this.loadProjectThresholds();
      }
    }
    if (tab === 'webhooks') {
      const p = this.workspace.currentProject() || this.workspace.projects()[0];
      if (p) {
        this.loadProjectWebhooks(p.id);
      }
    }
  }

  loadApiKeys(): void {
    this.evaluationService.getApiKeys().subscribe({
      next: (keys) => this.apiKeys.set(keys),
      error: () => {
        // Fallback demo sample for offline preview
        this.apiKeys.set([
          {
            id: 'key-1',
            name: 'GitHub Actions CI/CD Pipeline',
            keyPrefix: 'rageval_live_9f8a2',
            projectId: null,
            createdAt: new Date().toISOString(),
            lastUsedAt: new Date().toISOString(),
            isRevoked: false,
          },
        ]);
      },
    });
  }

  openCreateKeyModal(): void {
    this.newKeyName = '';
    this.newKeyProjectId = '';
    this.isCreateKeyModalOpen.set(true);
  }

  closeCreateKeyModal(): void {
    this.isCreateKeyModalOpen.set(false);
  }

  submitCreateApiKey(): void {
    if (!this.newKeyName.trim()) return;
    this.isSubmittingKey.set(true);

    this.evaluationService
      .createApiKey({
        name: this.newKeyName.trim(),
        projectId: this.newKeyProjectId ? this.newKeyProjectId : undefined,
      })
      .subscribe({
        next: (created) => {
          this.isSubmittingKey.set(false);
          this.closeCreateKeyModal();
          this.newlyCreatedKey.set(created);
          this.loadApiKeys();
        },
        error: (err) => {
          console.error('Failed to create API key:', err);
          this.isSubmittingKey.set(false);
        },
      });
  }

  revokeApiKey(keyId: string, name: string): void {
    if (!confirm(`Are you sure you want to revoke API key "${name}"? External requests using this key will immediately fail.`)) {
      return;
    }

    this.evaluationService.revokeApiKey(keyId).subscribe({
      next: () => this.loadApiKeys(),
      error: (err) => {
        console.error('Failed to revoke API key:', err);
        this.loadApiKeys();
      },
    });
  }

  loadProjectThresholds(): void {
    if (!this.thresholdProjectId) return;
    this.evaluationService.getProjectThresholds(this.thresholdProjectId).subscribe({
      next: (th) => {
        this.thresholds = {
          overallScore: th.overallScore ?? 0.80,
          faithfulness: th.faithfulness ?? 0.85,
          answerCorrectness: th.answerCorrectness ?? 0.80,
          answerRelevance: th.answerRelevance ?? 0.80,
          contextRelevance: th.contextRelevance ?? 0.75,
          maxLatencyMs: th.maxLatencyMs ?? 30000,
        };
      },
    });
  }

  saveThresholds(): void {
    if (!this.thresholdProjectId) return;
    this.isSavingThresholds.set(true);
    this.thresholdSuccessMsg.set(null);

    this.evaluationService
      .updateProjectThresholds(this.thresholdProjectId, this.thresholds)
      .subscribe({
        next: () => {
          this.isSavingThresholds.set(false);
          this.thresholdSuccessMsg.set('Quality gate thresholds saved successfully.');
          setTimeout(() => this.thresholdSuccessMsg.set(null), 4000);
        },
        error: (err) => {
          console.error('Failed to update thresholds:', err);
          this.isSavingThresholds.set(false);
        },
      });
  }

  loadProjectWebhooks(projectId: string): void {
    this.evaluationService.getProjectWebhooks(projectId).subscribe({
      next: (hooks) => this.webhooks.set(hooks),
      error: () => this.webhooks.set([]),
    });
  }

  openWebhookModal(): void {
    this.newWebhookUrl = '';
    const p = this.workspace.currentProject() || this.workspace.projects()[0];
    this.newWebhookProjectId = p ? p.id : '';
    this.isWebhookModalOpen.set(true);
  }

  closeWebhookModal(): void {
    this.isWebhookModalOpen.set(false);
  }

  submitCreateWebhook(): void {
    if (!this.newWebhookUrl.trim() || !this.newWebhookProjectId) return;
    this.isSubmittingWebhook.set(true);

    this.evaluationService
      .createWebhook(this.newWebhookProjectId, {
        url: this.newWebhookUrl.trim(),
        events: ['evaluation.completed', 'quality_gate.breached'],
      })
      .subscribe({
        next: () => {
          this.isSubmittingWebhook.set(false);
          this.closeWebhookModal();
          this.loadProjectWebhooks(this.newWebhookProjectId);
        },
        error: (err) => {
          console.error('Failed to register webhook:', err);
          this.isSubmittingWebhook.set(false);
        },
      });
  }

  deleteWebhook(projectId: string, webhookId: string): void {
    if (!confirm('Are you sure you want to delete this webhook destination?')) return;
    this.evaluationService.deleteWebhook(projectId, webhookId).subscribe({
      next: () => this.loadProjectWebhooks(projectId),
    });
  }

  getProjectName(projectId?: string | null): string {
    if (!projectId) return 'Global';
    const found = this.workspace.projects().find((p) => p.id === projectId);
    return found ? found.name : projectId.slice(0, 8);
  }

  copyToClipboard(text: string, fieldName: string): void {
    navigator.clipboard.writeText(text);
    this.copiedField.set(fieldName);
    setTimeout(() => this.copiedField.set(null), 2500);
  }
}
