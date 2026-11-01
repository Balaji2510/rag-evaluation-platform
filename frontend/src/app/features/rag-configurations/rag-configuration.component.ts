import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Project } from '../../core/models/project.model';
import {
  RAGConfiguration,
  RAGTestResult,
} from '../../core/models/rag-configuration.model';
import { ProjectService } from '../../core/services/project.service';
import { RAGConfigurationService } from '../../core/services/rag-configuration.service';

@Component({
  selector: 'app-rag-configuration',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="rag-config-page">
      <!-- Page Header -->
      <div class="page-header">
        <div>
          <h1>RAG Application Configuration</h1>
          <p class="subtitle">Connect external RAG endpoints to evaluate retrieval accuracy and generation quality</p>
        </div>
        <button (click)="openCreateModal()" class="btn btn-primary" [disabled]="projects().length === 0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="19" y1="12" x2="5" y2="12"></line>
          </svg>
          Configure Endpoint
        </button>
      </div>

      <!-- Filters Toolbar -->
      <div class="toolbar">
        <div class="filter-group">
          <label for="projectFilter">Filter by Project:</label>
          <select
            id="projectFilter"
            [(ngModel)]="selectedProjectId"
            (change)="onProjectFilterChange()"
            class="select-input"
          >
            <option value="">All Projects</option>
            @for (p of projects(); track p.id) {
              <option [value]="p.id">{{ p.name }}</option>
            }
          </select>
        </div>

        <button (click)="loadConfigurations()" class="btn btn-secondary" [disabled]="loading()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          Refresh
        </button>
      </div>

      <!-- Loading State -->
      @if (loading()) {
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading RAG configurations...</p>
        </div>
      }

      <!-- Error State -->
      @else if (errorMessage()) {
        <div class="error-banner">
          <p>{{ errorMessage() }}</p>
          <button (click)="loadConfigurations()" class="btn btn-sm btn-retry">Retry</button>
        </div>
      }

      <!-- Empty State -->
      @else if (configurations().length === 0) {
        <div class="empty-state">
          <div class="empty-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
          </div>
          <h3>No RAG endpoints configured</h3>
          <p>Register your external RAG HTTP endpoint with request templates and answer extraction paths to run automated evaluations.</p>
          @if (projects().length === 0) {
            <a routerLink="/projects/new" class="btn btn-primary">Create a Project First</a>
          } @else {
            <button (click)="openCreateModal()" class="btn btn-primary">Configure First Endpoint</button>
          }
        </div>
      }

      <!-- Configurations Grid -->
      @else {
        <div class="config-grid">
          @for (config of configurations(); track config.id) {
            <div class="config-card">
              <div class="card-header">
                <div>
                  <div class="title-row">
                    <h3>{{ config.name }}</h3>
                    <span class="project-tag">{{ getProjectName(config.projectId) }}</span>
                  </div>
                  <div class="endpoint-pill">
                    <span class="method-tag">{{ config.method }}</span>
                    <span class="url-text" [title]="config.apiUrl">{{ config.apiUrl }}</span>
                  </div>
                </div>

                <div class="card-actions">
                  <button (click)="openTestModal(config)" class="btn btn-test">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                    Test Connection
                  </button>
                  <button (click)="openEditModal(config)" class="btn-icon" title="Edit Configuration">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button (click)="deleteConfig(config)" class="btn-icon delete" title="Delete Configuration">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Configuration Details Metadata -->
              <div class="meta-details">
                <div class="meta-item">
                  <span class="meta-label">Answer Path:</span>
                  <code>{{ config.answerPath }}</code>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Context Path:</span>
                  <code>{{ config.contextPath || '—' }}</code>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Timeout:</span>
                  <span>{{ config.timeoutSeconds }}s</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Headers:</span>
                  <span>{{ getHeaderCount(config.headers) }} configured</span>
                </div>
              </div>

              <div class="card-footer">
                <span class="date">Updated {{ config.updatedAt | date:'mediumDate' }}</span>
              </div>
            </div>
          }
        </div>
      }

      <!-- Configuration Form Modal (Create / Edit) -->
      @if (showFormModal()) {
        <div class="modal-backdrop" (click)="closeFormModal()">
          <div class="modal-card modal-lg" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>{{ editingConfigId() ? 'Edit RAG Configuration' : 'Configure RAG Application Endpoint' }}</h3>
              <button (click)="closeFormModal()" class="btn-close">&times;</button>
            </div>

            <form (ngSubmit)="saveConfiguration()" class="modal-form">
              <div class="form-row">
                <div class="form-group flex-1">
                  <label for="cfgProject">Target Project <span class="required">*</span></label>
                  <select
                    id="cfgProject"
                    [(ngModel)]="formProjectId"
                    name="formProjectId"
                    required
                    [disabled]="!!editingConfigId()"
                    class="input"
                  >
                    @for (p of projects(); track p.id) {
                      <option [value]="p.id">{{ p.name }}</option>
                    }
                  </select>
                </div>

                <div class="form-group flex-2">
                  <label for="cfgName">Configuration Name <span class="required">*</span></label>
                  <input
                    id="cfgName"
                    [(ngModel)]="formName"
                    name="formName"
                    required
                    placeholder="e.g. Production RAG Agent"
                    class="input"
                  />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group" style="width: 120px;">
                  <label for="cfgMethod">Method</label>
                  <select id="cfgMethod" [(ngModel)]="formMethod" name="formMethod" class="input">
                    <option value="POST">POST</option>
                    <option value="GET">GET</option>
                    <option value="PUT">PUT</option>
                  </select>
                </div>

                <div class="form-group flex-1">
                  <label for="cfgUrl">Endpoint API URL <span class="required">*</span></label>
                  <input
                    id="cfgUrl"
                    [(ngModel)]="formApiUrl"
                    name="formApiUrl"
                    required
                    placeholder="https://example.com/api/ask"
                    class="input"
                  />
                </div>

                <div class="form-group" style="width: 120px;">
                  <label for="cfgTimeout">Timeout (s)</label>
                  <input
                    id="cfgTimeout"
                    type="number"
                    [(ngModel)]="formTimeout"
                    name="formTimeout"
                    min="1"
                    max="300"
                    class="input"
                  />
                </div>
              </div>

              <div class="form-group">
                <label for="cfgHeaders">
                  HTTP Headers (JSON format)
                  <span class="security-note">🔒 Secrets & API keys are encrypted and stored only on backend</span>
                </label>
                <textarea
                  id="cfgHeaders"
                  [(ngModel)]="formHeadersRaw"
                  name="formHeadersRaw"
                  rows="3"
                  class="code-textarea"
                  [placeholder]="headersPlaceholder"
                ></textarea>
              </div>

              <div class="form-group">
                <label for="cfgTemplate">
                  Request JSON Template
                  <span class="hint-text">Use <code>{{ questionPlaceholderSyntax }}</code> as the question placeholder</span>
                </label>
                <textarea
                  id="cfgTemplate"
                  [(ngModel)]="formTemplateRaw"
                  name="formTemplateRaw"
                  rows="3"
                  class="code-textarea"
                  [placeholder]="templatePlaceholder"
                ></textarea>
              </div>

              <div class="form-row">
                <div class="form-group flex-1">
                  <label for="cfgAnswerPath">
                    Answer JSON Path <span class="required">*</span>
                    <span class="hint-text">(e.g. <code>answer</code> or <code>data.response</code>)</span>
                  </label>
                  <input
                    id="cfgAnswerPath"
                    [(ngModel)]="formAnswerPath"
                    name="formAnswerPath"
                    required
                    class="input"
                  />
                </div>

                <div class="form-group flex-1">
                  <label for="cfgContextPath">
                    Contexts JSON Path
                    <span class="hint-text">(e.g. <code>contexts</code> or <code>retrieved_docs</code>)</span>
                  </label>
                  <input
                    id="cfgContextPath"
                    [(ngModel)]="formContextPath"
                    name="formContextPath"
                    class="input"
                    placeholder="contexts"
                  />
                </div>
              </div>

              @if (formError()) {
                <div class="form-error-alert">{{ formError() }}</div>
              }

              <div class="modal-footer">
                <button type="button" (click)="closeFormModal()" class="btn btn-secondary">Cancel</button>
                <button type="submit" class="btn btn-primary" [disabled]="savingConfig()">
                  {{ savingConfig() ? 'Saving...' : 'Save Configuration' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Test Connection Modal -->
      @if (showTestModal()) {
        <div class="modal-backdrop" (click)="closeTestModal()">
          <div class="modal-card modal-lg" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div>
                <h3>Test RAG Endpoint Connection</h3>
                <p class="modal-sub">
                  Target: <code>{{ activeTestingConfig()?.method }} {{ activeTestingConfig()?.apiUrl }}</code>
                </p>
              </div>
              <button (click)="closeTestModal()" class="btn-close">&times;</button>
            </div>

            <div class="test-body">
              <div class="form-group">
                <label for="testQuestion">Sample Evaluation Question:</label>
                <textarea
                  id="testQuestion"
                  [(ngModel)]="testQuestion"
                  rows="2"
                  class="input"
                  placeholder="Enter sample question to test response extraction..."
                ></textarea>
              </div>

              <div class="test-trigger-row">
                <button
                  type="button"
                  (click)="runConnectionTest()"
                  class="btn btn-primary"
                  [disabled]="testingInProgress() || !testQuestion.trim()"
                >
                  @if (testingInProgress()) {
                    <span class="spinner"></span> Calling Endpoint...
                  } @else {
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                    Send Sample Question
                  }
                </button>
              </div>

              <!-- Test Result Box -->
              @if (testResult(); as res) {
                <div class="test-result-container" [class.success]="res.success" [class.failure]="!res.success">
                  <div class="result-header">
                    <div class="status-indicator">
                      <span class="badge" [class.badge-ok]="res.success" [class.badge-err]="!res.success">
                        {{ res.success ? 'TEST PASSED' : 'TEST FAILED' }}
                      </span>
                      @if (res.statusCode) {
                        <span class="http-tag">HTTP {{ res.statusCode }}</span>
                      }
                    </div>

                    @if (res.latencyMs !== null && res.latencyMs !== undefined) {
                      <span class="latency-tag">⚡ {{ res.latencyMs }} ms</span>
                    }
                  </div>

                  @if (res.error) {
                    <div class="error-msg">
                      <strong>Error:</strong> {{ res.error }}
                    </div>
                  }

                  @if (res.answer) {
                    <div class="extracted-box">
                      <span class="box-label">Extracted Answer (via '{{ activeTestingConfig()?.answerPath }}')</span>
                      <p class="extracted-text">{{ res.answer }}</p>
                    </div>
                  }

                  @if (res.contexts && res.contexts.length > 0) {
                    <div class="extracted-box">
                      <span class="box-label">Extracted Contexts ({{ res.contexts.length }} passages via '{{ activeTestingConfig()?.contextPath }}')</span>
                      <ul class="contexts-list">
                        @for (ctx of res.contexts; track ctx) {
                          <li>{{ ctx }}</li>
                        }
                      </ul>
                    </div>
                  }

                  @if (res.rawResponse) {
                    <div class="raw-response-accordion">
                      <span class="box-label">Raw Endpoint Response</span>
                      <pre><code>{{ res.rawResponse | json }}</code></pre>
                    </div>
                  }
                </div>
              }
            </div>

            <div class="modal-footer">
              <button type="button" (click)="closeTestModal()" class="btn btn-secondary">Close</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .rag-config-page {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
    }

    h1 {
      margin: 0 0 0.25rem 0;
      font-size: 1.75rem;
      font-weight: 700;
      color: #f8fafc;
    }

    .subtitle {
      margin: 0;
      color: #94a3b8;
      font-size: 0.9rem;
    }

    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      background: #0f172a;
      border: 1px solid #1e293b;
      padding: 0.75rem 1.25rem;
      border-radius: 10px;
    }

    .filter-group {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .filter-group label {
      font-size: 0.85rem;
      color: #94a3b8;
      font-weight: 600;
    }

    .select-input {
      background: #020617;
      border: 1px solid #334155;
      color: #f8fafc;
      padding: 0.45rem 0.85rem;
      border-radius: 6px;
      font-size: 0.85rem;
      outline: none;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.6rem 1.15rem;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.15s ease;
      border: none;
    }

    .btn-primary {
      background: #3b82f6;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #2563eb;
    }

    .btn-primary:disabled {
      opacity: 0.6;
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

    .btn-test {
      background: rgba(34, 197, 94, 0.15);
      border: 1px solid rgba(34, 197, 94, 0.3);
      color: #4ade80;
      padding: 0.4rem 0.85rem;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      transition: all 0.15s ease;
    }

    .btn-test:hover {
      background: #22c55e;
      color: white;
      border-color: #22c55e;
    }

    .btn-icon {
      background: transparent;
      border: 1px solid #334155;
      color: #94a3b8;
      padding: 0.4rem;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
    }

    .btn-icon:hover {
      background: #1e293b;
      color: #38bdf8;
      border-color: #38bdf8;
    }

    .btn-icon.delete:hover {
      background: rgba(239, 68, 68, 0.2);
      border-color: #ef4444;
      color: #f87171;
    }

    .config-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
      gap: 1.25rem;
    }

    .config-card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      transition: all 0.2s ease;
    }

    .config-card:hover {
      border-color: #3b82f6;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
    }

    .title-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .title-row h3 {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 600;
      color: #f8fafc;
    }

    .project-tag {
      background: #1e293b;
      border: 1px solid #334155;
      color: #94a3b8;
      font-size: 0.7rem;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .endpoint-pill {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: #020617;
      border: 1px solid #1e293b;
      padding: 0.35rem 0.65rem;
      border-radius: 6px;
      max-width: 340px;
    }

    .method-tag {
      background: #1e3a5f;
      color: #38bdf8;
      font-size: 0.7rem;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
    }

    .url-text {
      color: #cbd5e1;
      font-size: 0.75rem;
      font-family: monospace;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .card-actions {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      flex-shrink: 0;
    }

    .meta-details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem 1rem;
      background: #070d17;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 0.75rem 1rem;
      font-size: 0.8rem;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    .meta-label {
      color: #64748b;
      font-size: 0.75rem;
    }

    code {
      background: #1e293b;
      color: #38bdf8;
      padding: 1px 4px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.75rem;
    }

    .card-footer {
      border-top: 1px solid #1e293b;
      padding-top: 0.75rem;
      font-size: 0.75rem;
      color: #64748b;
    }

    .loading-state, .empty-state {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 3.5rem 2rem;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }

    .empty-icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: rgba(59, 130, 246, 0.1);
      color: #60a5fa;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 0.5rem;
    }

    .empty-state h3 {
      margin: 0;
      color: #f8fafc;
      font-size: 1.2rem;
    }

    .empty-state p {
      margin: 0 0 0.75rem 0;
      color: #94a3b8;
      font-size: 0.85rem;
      max-width: 440px;
      line-height: 1.5;
    }

    .spinner {
      width: 24px;
      height: 24px;
      border: 3px solid rgba(255, 255, 255, 0.2);
      border-radius: 50%;
      border-top-color: #3b82f6;
      animation: spin 0.8s linear infinite;
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
      z-index: 100;
      padding: 1.5rem;
    }

    .modal-card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 12px;
      width: 100%;
      max-width: 580px;
      padding: 1.75rem;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
      max-height: 90vh;
      overflow-y: auto;
    }

    .modal-card.modal-lg {
      max-width: 680px;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.25rem;
    }

    .modal-header h3 {
      margin: 0;
      font-size: 1.25rem;
      color: #f8fafc;
    }

    .modal-sub {
      margin: 0.25rem 0 0 0;
      font-size: 0.8rem;
      color: #94a3b8;
    }

    .btn-close {
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 1.5rem;
      cursor: pointer;
    }

    .modal-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .form-row {
      display: flex;
      gap: 1rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .flex-1 { flex: 1; }
    .flex-2 { flex: 2; }

    label {
      font-size: 0.8rem;
      font-weight: 600;
      color: #cbd5e1;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .required {
      color: #f87171;
    }

    .security-note {
      color: #38bdf8;
      font-size: 0.7rem;
      font-weight: normal;
    }

    .hint-text {
      color: #64748b;
      font-size: 0.7rem;
      font-weight: normal;
    }

    .input {
      background: #020617;
      border: 1px solid #334155;
      color: #f8fafc;
      padding: 0.65rem 0.85rem;
      border-radius: 8px;
      font-size: 0.875rem;
      outline: none;
      font-family: inherit;
    }

    .input:focus {
      border-color: #3b82f6;
    }

    .code-textarea {
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 0.8rem;
      line-height: 1.4;
      background: #070d17;
      color: #38bdf8;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 0.75rem;
      outline: none;
    }

    .code-textarea:focus {
      border-color: #3b82f6;
    }

    .form-error-alert {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
      padding: 0.65rem 1rem;
      border-radius: 6px;
      font-size: 0.85rem;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 1rem;
    }

    /* Test Results Styles */
    .test-body {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .test-trigger-row {
      display: flex;
      justify-content: flex-start;
    }

    .test-result-container {
      background: #070d17;
      border-radius: 8px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      border: 1px solid #1e293b;
    }

    .test-result-container.success {
      border-color: rgba(34, 197, 94, 0.3);
    }

    .test-result-container.failure {
      border-color: rgba(239, 68, 68, 0.3);
    }

    .result-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .status-indicator {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .badge {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 9999px;
      letter-spacing: 0.05em;
    }

    .badge-ok {
      background: rgba(34, 197, 94, 0.2);
      color: #4ade80;
    }

    .badge-err {
      background: rgba(239, 68, 68, 0.2);
      color: #f87171;
    }

    .http-tag {
      font-family: monospace;
      font-size: 0.75rem;
      color: #94a3b8;
    }

    .latency-tag {
      font-family: monospace;
      font-size: 0.8rem;
      color: #38bdf8;
    }

    .error-msg {
      color: #f87171;
      font-size: 0.85rem;
      line-height: 1.4;
    }

    .extracted-box {
      background: #0b1120;
      border: 1px solid #1e293b;
      border-radius: 6px;
      padding: 0.85rem 1rem;
    }

    .box-label {
      display: block;
      font-size: 0.7rem;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.4rem;
    }

    .extracted-text {
      margin: 0;
      color: #f8fafc;
      font-size: 0.9rem;
      line-height: 1.5;
    }

    .contexts-list {
      margin: 0;
      padding-left: 1.25rem;
      color: #cbd5e1;
      font-size: 0.85rem;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .raw-response-accordion {
      background: #020617;
      border: 1px solid #1e293b;
      border-radius: 6px;
      padding: 0.75rem 1rem;
    }

    pre {
      margin: 0;
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 0.75rem;
      color: #38bdf8;
      max-height: 160px;
      overflow: auto;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `],
})
export class RAGConfigurationComponent implements OnInit {
  private readonly ragService = inject(RAGConfigurationService);
  private readonly projectService = inject(ProjectService);
  private readonly route = inject(ActivatedRoute);

  projects = signal<Project[]>([]);
  configurations = signal<RAGConfiguration[]>([]);
  selectedProjectId = '';
  loading = signal<boolean>(true);
  errorMessage = signal<string | null>(null);

  // Form Modal (Create / Edit)
  showFormModal = signal<boolean>(false);
  editingConfigId = signal<string | null>(null);
  formProjectId = '';
  formName = '';
  formApiUrl = '';
  formMethod = 'POST';
  formHeadersRaw = '{\n  "Content-Type": "application/json"\n}';
  formTemplateRaw = '{\n  "question": "{{question}}"\n}';
  formAnswerPath = 'answer';
  formContextPath = 'contexts';
  formTimeout = 30;
  savingConfig = signal<boolean>(false);
  formError = signal<string | null>(null);

  readonly headersPlaceholder = '{\n  "Authorization": "Bearer YOUR_SECRET_API_KEY",\n  "Content-Type": "application/json"\n}';
  readonly templatePlaceholder = '{\n  "question": "{{question}}"\n}';
  readonly questionPlaceholderSyntax = '{{question}}';

  // Test Modal
  showTestModal = signal<boolean>(false);
  activeTestingConfig = signal<RAGConfiguration | null>(null);
  testQuestion = 'What is Retrieval-Augmented Generation and how does it work?';
  testingInProgress = signal<boolean>(false);
  testResult = signal<RAGTestResult | null>(null);

  ngOnInit(): void {
    const queryProj = this.route.snapshot.queryParams['projectId'];
    if (queryProj) {
      this.selectedProjectId = queryProj;
    }

    this.loadProjects();
    this.loadConfigurations();
  }

  loadProjects(): void {
    this.projectService.listProjects().subscribe({
      next: (data) => {
        this.projects.set(data);
        if (!this.formProjectId && data.length > 0) {
          this.formProjectId = data[0].id;
        }
      },
      error: () => {},
    });
  }

  loadConfigurations(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.ragService.listConfigurations(this.selectedProjectId || undefined).subscribe({
      next: (configs) => {
        this.configurations.set(configs);
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error?.message || 'Could not load RAG configurations.');
        this.loading.set(false);
      },
    });
  }

  onProjectFilterChange(): void {
    this.loadConfigurations();
  }

  getProjectName(projectId: string): string {
    const p = this.projects().find((item) => item.id === projectId);
    return p ? p.name : 'Project';
  }

  getHeaderCount(headers: Record<string, string>): number {
    return Object.keys(headers || {}).length;
  }

  openCreateModal(): void {
    this.editingConfigId.set(null);
    this.formName = '';
    this.formApiUrl = '';
    this.formMethod = 'POST';
    this.formHeadersRaw = '{\n  "Content-Type": "application/json"\n}';
    this.formTemplateRaw = '{\n  "question": "{{question}}"\n}';
    this.formAnswerPath = 'answer';
    this.formContextPath = 'contexts';
    this.formTimeout = 30;
    this.formError.set(null);

    if (this.selectedProjectId) {
      this.formProjectId = this.selectedProjectId;
    } else if (this.projects().length > 0) {
      this.formProjectId = this.projects()[0].id;
    }

    this.showFormModal.set(true);
  }

  openEditModal(config: RAGConfiguration): void {
    this.editingConfigId.set(config.id);
    this.formProjectId = config.projectId;
    this.formName = config.name;
    this.formApiUrl = config.apiUrl;
    this.formMethod = config.method;
    this.formHeadersRaw = JSON.stringify(config.headers || {}, null, 2);
    this.formTemplateRaw = JSON.stringify(config.requestTemplate || { question: '{{question}}' }, null, 2);
    this.formAnswerPath = config.answerPath;
    this.formContextPath = config.contextPath || '';
    this.formTimeout = config.timeoutSeconds || 30;
    this.formError.set(null);
    this.showFormModal.set(true);
  }

  closeFormModal(): void {
    this.showFormModal.set(false);
  }

  saveConfiguration(): void {
    if (!this.formName.trim() || !this.formApiUrl.trim() || !this.formProjectId) {
      this.formError.set('Please fill out all required fields.');
      return;
    }

    let parsedHeaders = {};
    if (this.formHeadersRaw.trim()) {
      try {
        parsedHeaders = JSON.parse(this.formHeadersRaw.trim());
      } catch (err) {
        this.formError.set('Headers must be valid JSON: ' + String(err));
        return;
      }
    }

    let parsedTemplate = { question: '{{question}}' };
    if (this.formTemplateRaw.trim()) {
      try {
        parsedTemplate = JSON.parse(this.formTemplateRaw.trim());
      } catch (err) {
        this.formError.set('Request template must be valid JSON: ' + String(err));
        return;
      }
    }

    this.savingConfig.set(true);
    this.formError.set(null);

    const editId = this.editingConfigId();
    if (editId) {
      this.ragService
        .updateConfiguration(editId, {
          name: this.formName.trim(),
          apiUrl: this.formApiUrl.trim(),
          method: this.formMethod,
          headers: parsedHeaders,
          requestTemplate: parsedTemplate,
          answerPath: this.formAnswerPath.trim(),
          contextPath: this.formContextPath.trim() || undefined,
          timeoutSeconds: this.formTimeout,
        })
        .subscribe({
          next: (updated) => {
            this.configurations.update((list) =>
              list.map((c) => (c.id === updated.id ? updated : c))
            );
            this.savingConfig.set(false);
            this.closeFormModal();
          },
          error: (err) => {
            this.savingConfig.set(false);
            this.formError.set(err.error?.error?.message || 'Failed to update configuration.');
          },
        });
    } else {
      this.ragService
        .createConfiguration({
          projectId: this.formProjectId,
          name: this.formName.trim(),
          apiUrl: this.formApiUrl.trim(),
          method: this.formMethod,
          headers: parsedHeaders,
          requestTemplate: parsedTemplate,
          answerPath: this.formAnswerPath.trim(),
          contextPath: this.formContextPath.trim() || undefined,
          timeoutSeconds: this.formTimeout,
        })
        .subscribe({
          next: (created) => {
            this.configurations.update((list) => [created, ...list]);
            this.savingConfig.set(false);
            this.closeFormModal();
          },
          error: (err) => {
            this.savingConfig.set(false);
            this.formError.set(err.error?.error?.message || 'Failed to create configuration.');
          },
        });
    }
  }

  deleteConfig(config: RAGConfiguration): void {
    if (confirm(`Delete RAG configuration "${config.name}"?`)) {
      this.ragService.deleteConfiguration(config.id).subscribe({
        next: () => {
          this.configurations.update((list) => list.filter((c) => c.id !== config.id));
        },
        error: () => {
          alert('Failed to delete configuration.');
        },
      });
    }
  }

  openTestModal(config: RAGConfiguration): void {
    this.activeTestingConfig.set(config);
    this.testResult.set(null);
    this.showTestModal.set(true);
  }

  closeTestModal(): void {
    this.showTestModal.set(false);
  }

  runConnectionTest(): void {
    const config = this.activeTestingConfig();
    if (!config || !this.testQuestion.trim()) return;

    this.testingInProgress.set(true);
    this.testResult.set(null);

    this.ragService
      .testConfiguration(config.id, this.testQuestion.trim())
      .subscribe({
        next: (res) => {
          this.testResult.set(res);
          this.testingInProgress.set(false);
        },
        error: (err) => {
          this.testingInProgress.set(false);
          this.testResult.set({
            success: false,
            error: err.error?.error?.message || 'Failed to reach test runner.',
            contexts: [],
          });
        },
      });
  }
}
