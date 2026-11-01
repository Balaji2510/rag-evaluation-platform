import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Dataset } from '../../../core/models/dataset.model';
import { Project } from '../../../core/models/project.model';
import {
  InternalRAGConfig,
  InternalRAGQueryResponse,
  ProjectDocument,
} from '../../../core/models/document.model';
import { ProjectService } from '../../../core/services/project.service';
import { InternalRAGService } from '../../../core/services/internal-rag.service';
import { EvaluationService } from '../../../core/services/evaluation.service';
import {
  ApiKeyItem,
  ProjectTrends,
  WebhookItem,
} from '../../../core/models/evaluation.model';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="project-detail-page">
      <!-- Breadcrumbs -->
      <div class="breadcrumbs">
        <a routerLink="/projects">Projects</a>
        <span class="sep">/</span>
        <span class="current">{{ project()?.name || 'Project Details' }}</span>
      </div>

      <!-- Loading State -->
      @if (loadingProject()) {
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading project details...</p>
        </div>
      }

      <!-- Error State -->
      @else if (projectError()) {
        <div class="error-banner">
          <p>{{ projectError() }}</p>
          <a routerLink="/projects" class="btn btn-sm btn-secondary">Back to Projects</a>
        </div>
      }

      @else if (project(); as p) {
        <!-- Project Header / Info Banner -->
        <div class="project-header-card">
          <div class="header-top">
            <div>
              <div class="title-row">
                <h1>{{ p.name }}</h1>
                <span class="dataset-count-badge">{{ datasets().length }} {{ datasets().length === 1 ? 'Dataset' : 'Datasets' }}</span>
              </div>
              <p class="project-desc">{{ p.description || 'No description provided.' }}</p>
            </div>
            <div class="header-actions">
              <a [routerLink]="['/projects', p.id, 'compare']" class="btn btn-primary">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="20" x2="18" y2="10"></line>
                  <line x1="12" y1="20" x2="12" y2="4"></line>
                  <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
                Compare Runs
              </a>
              <a [routerLink]="['/configurations']" [queryParams]="{ projectId: p.id }" class="btn btn-secondary">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
                RAG Endpoints
              </a>
              <button (click)="openEditModal()" class="btn btn-secondary">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                Edit
              </button>
              <button (click)="deleteProject()" class="btn btn-danger">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                Delete
              </button>
            </div>
          </div>

          <div class="header-meta">
            <span>Created on {{ p.createdAt | date:'mediumDate' }}</span>
            <span>•</span>
            <span>Last updated {{ p.updatedAt | date:'mediumDate' }}</span>
          </div>
        </div>

        <!-- Project Tabs Navigation -->
        <div class="tabs-nav-bar">
          <button
            class="tab-pill-btn"
            [class.active]="activeTab() === 'datasets'"
            (click)="activeTab.set('datasets')"
          >
            📁 Evaluation Datasets ({{ datasets().length }})
          </button>
          <button
            class="tab-pill-btn"
            [class.active]="activeTab() === 'documents'"
            (click)="onDocumentsTabActive()"
          >
            📄 Documents & Internal RAG ({{ documents().length }})
          </button>
          <button
            class="tab-pill-btn"
            [class.active]="activeTab() === 'trends'"
            (click)="onTrendsTabActive()"
          >
            📈 Quality Trends ({{ projectTrends()?.totalRuns || 0 }})
          </button>
          <button
            class="tab-pill-btn"
            [class.active]="activeTab() === 'production'"
            (click)="onProductionTabActive()"
          >
            ⚙️ CI/CD & Production
          </button>
        </div>

        <!-- TAB 1: Datasets Section -->
        @if (activeTab() === 'datasets') {
          <div class="datasets-section">
            <div class="section-header">
              <div>
                <h2>Evaluation Datasets</h2>
                <p class="section-desc">Manage test datasets, ground truth answers, and evaluation queries</p>
              </div>
              <button (click)="openNewDatasetModal()" class="btn btn-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="19" y1="12" x2="5" y2="12"></line>
                </svg>
                New Dataset
              </button>
            </div>

            @if (loadingDatasets()) {
              <div class="loading-state">
                <div class="spinner"></div>
                <p>Loading datasets...</p>
              </div>
            } @else if (datasets().length === 0) {
              <div class="empty-state">
                <div class="empty-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"></path>
                  </svg>
                </div>
                <h3>No datasets created yet</h3>
                <p>Add a dataset with questions, reference context chunks, and ground truth answers to benchmark your RAG pipeline.</p>
                <button (click)="openNewDatasetModal()" class="btn btn-primary">Create First Dataset</button>
              </div>
            } @else {
              <div class="datasets-table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Dataset Name</th>
                      <th>Description</th>
                      <th>Questions</th>
                      <th>Last Updated</th>
                      <th class="actions-col">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (ds of datasets(); track ds.id) {
                      <tr>
                        <td class="name-cell">
                          <a [routerLink]="['/datasets', ds.id]" class="ds-link">
                            {{ ds.name }}
                          </a>
                        </td>
                        <td class="desc-cell">{{ ds.description || '—' }}</td>
                        <td>
                          <span class="count-pill">{{ ds.itemCount || 0 }} items</span>
                        </td>
                        <td class="date-cell">{{ ds.updatedAt | date:'mediumDate' }}</td>
                        <td class="actions-col">
                          <a [routerLink]="['/datasets', ds.id]" class="btn-sm-open">
                            Open & Edit
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

        <!-- TAB 2: Documents & Internal RAG Section -->
        @if (activeTab() === 'documents') {
          <div class="documents-rag-section">
            <!-- Upload & Ingestion Card -->
            <div class="card doc-upload-card">
              <div class="card-header">
                <div>
                  <h2>Upload Project Documents</h2>
                  <p class="section-desc">Upload knowledge base documents for chunking, Gemini embeddings, and Atlas Vector Search</p>
                </div>
                <div class="format-badges">
                  <span class="fmt-badge">PDF</span>
                  <span class="fmt-badge">TXT</span>
                  <span class="fmt-badge">Markdown</span>
                  <span class="fmt-badge">JSON</span>
                </div>
              </div>

              <div class="upload-controls">
                <input
                  type="file"
                  #fileInput
                  (change)="onFileSelected($event)"
                  accept=".pdf,.txt,.md,.json,application/pdf,text/plain,text/markdown,application/json"
                  class="file-input"
                  id="docFileInput"
                />
                <button
                  (click)="fileInput.click()"
                  class="btn btn-secondary"
                  [disabled]="uploadingDoc()"
                >
                  📁 Select File...
                </button>

                @if (selectedFile) {
                  <span class="selected-filename">{{ selectedFile.name }} ({{ formatBytes(selectedFile.size) }})</span>
                  <button
                    (click)="uploadSelectedFile()"
                    class="btn btn-primary"
                    [disabled]="uploadingDoc()"
                  >
                    @if (uploadingDoc()) {
                      <span class="spinner-sm"></span> Indexing Chunks...
                    } @else {
                      Upload & Index Document
                    }
                  </button>
                }
              </div>

              @if (uploadError()) {
                <div class="error-msg-banner">⚠️ {{ uploadError() }}</div>
              }
              @if (uploadSuccess()) {
                <div class="success-msg-banner">✅ {{ uploadSuccess() }}</div>
              }
            </div>

            <!-- Documents Table -->
            <div class="card docs-table-card">
              <div class="card-header">
                <h3>Indexed Documents ({{ documents().length }})</h3>
                <button (click)="loadDocuments()" class="btn btn-secondary btn-sm" [disabled]="loadingDocs()">
                  ↻ Refresh
                </button>
              </div>

              @if (loadingDocs()) {
                <div class="loading-state">
                  <div class="spinner"></div>
                  <p>Loading documents from MongoDB...</p>
                </div>
              } @else if (documents().length === 0) {
                <div class="empty-state-sm">
                  <p>No documents uploaded yet. Upload a PDF, TXT, Markdown, or JSON file above to populate the knowledge base.</p>
                </div>
              } @else {
                <div class="table-responsive">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Filename</th>
                        <th>Type</th>
                        <th>Vector Chunks</th>
                        <th>Uploaded</th>
                        <th class="actions-col">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (doc of documents(); track doc.id) {
                        <tr>
                          <td><strong>{{ doc.filename }}</strong></td>
                          <td><span class="type-pill">{{ doc.contentType }}</span></td>
                          <td><span class="chunk-pill">{{ doc.chunkCount || 0 }} chunks</span></td>
                          <td>{{ doc.createdAt | date:'short' }}</td>
                          <td class="actions-col">
                            <button (click)="deleteDocument(doc.id)" class="btn-delete-doc" title="Delete document & chunks">
                              Delete
                            </button>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>

            <!-- MongoDB Atlas Vector Search Settings & Interactive Query Grid -->
            <div class="rag-config-query-grid">
              <!-- Atlas Vector Search Settings Card -->
              <div class="card settings-card">
                <div class="card-header">
                  <div>
                    <h3>Atlas Vector Search Settings</h3>
                    <p class="section-desc">Tune text splitter and retrieval parameters</p>
                  </div>
                  <span class="db-badge">MongoDB Atlas</span>
                </div>

                <div class="form-grid-stacked">
                  <div class="form-group">
                    <label for="cfgChunkSize">Chunk Size (chars)</label>
                    <input
                      id="cfgChunkSize"
                      type="number"
                      [(ngModel)]="settingChunkSize"
                      min="100"
                      max="8000"
                      step="100"
                      class="input-control"
                    />
                    <span class="field-hint">Length of chunks created by RecursiveCharacterTextSplitter</span>
                  </div>

                  <div class="form-group">
                    <label for="cfgChunkOverlap">Chunk Overlap (chars)</label>
                    <input
                      id="cfgChunkOverlap"
                      type="number"
                      [(ngModel)]="settingChunkOverlap"
                      min="0"
                      max="2000"
                      step="50"
                      class="input-control"
                    />
                    <span class="field-hint">Overlap buffer between adjacent text chunks</span>
                  </div>

                  <div class="form-group">
                    <label for="cfgTopK">Top-K Retrieved Contexts</label>
                    <input
                      id="cfgTopK"
                      type="number"
                      [(ngModel)]="settingTopK"
                      min="1"
                      max="20"
                      class="input-control"
                    />
                    <span class="field-hint">Number of context passages passed to Gemini</span>
                  </div>

                  <button
                    (click)="saveRAGSettings()"
                    class="btn btn-primary"
                    [disabled]="savingSettings()"
                  >
                    {{ savingSettings() ? 'Saving...' : 'Save Vector Settings' }}
                  </button>

                  @if (settingsSavedMessage()) {
                    <span class="success-hint">✅ {{ settingsSavedMessage() }}</span>
                  }
                </div>
              </div>

              <!-- Interactive Internal RAG Playground Card -->
              <div class="card query-card">
                <div class="card-header">
                  <div>
                    <h3>Test Internal RAG Query</h3>
                    <p class="section-desc">Run embedding retrieval and grounded answer generation</p>
                  </div>
                  <span class="live-pill">Live Pipeline</span>
                </div>

                <div class="query-form">
                  <div class="form-group">
                    <label for="ragQuestion">Test Question</label>
                    <input
                      id="ragQuestion"
                      [(ngModel)]="ragTestQuestion"
                      placeholder="e.g. What is the cancellation policy?"
                      class="input-control"
                      (keyup.enter)="executeRAGQuery()"
                    />
                  </div>

                  <button
                    (click)="executeRAGQuery()"
                    class="btn btn-primary"
                    [disabled]="queryingRAG() || !ragTestQuestion.trim()"
                  >
                    @if (queryingRAG()) {
                      <span class="spinner-sm"></span> Retrieving & Generating...
                    } @else {
                      ⚡ Run Query
                    }
                  </button>

                  @if (ragQueryError()) {
                    <div class="error-msg-banner">⚠️ {{ ragQueryError() }}</div>
                  }

                  @if (ragQueryAnswer()) {
                    <div class="rag-answer-box">
                      <span class="section-label">GENERATED ANSWER (GEMINI):</span>
                      <p class="answer-text">{{ ragQueryAnswer() }}</p>
                    </div>

                    <div class="rag-contexts-box">
                      <span class="section-label">RETRIEVED CONTEXTS ({{ ragQueryContexts().length }} PASSAGES):</span>
                      <div class="contexts-list">
                        @for (ctx of ragQueryContexts(); track $index) {
                          <div class="context-snippet-card">
                            <span class="snippet-idx">Passage {{ $index + 1 }}</span>
                            <p class="snippet-content">{{ ctx }}</p>
                          </div>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>
            </div>
          </div>
        }

        <!-- TAB 3: Historical Quality Trends -->
        @if (activeTab() === 'trends') {
          <div class="datasets-section">
            <div class="section-header">
              <div>
                <h2>📈 Historical Quality & Regression Trends</h2>
                <p class="section-desc">Track evaluation trajectories, model prompts, and latency shifts across runs.</p>
              </div>
              <button (click)="loadTrends()" class="btn btn-secondary btn-sm">Refresh Trends</button>
            </div>

            @if (loadingTrends()) {
              <div class="loading-state">
                <div class="spinner"></div>
                <p>Loading historical evaluation trends...</p>
              </div>
            } @else if (!projectTrends() || projectTrends()!.trends.length === 0) {
              <div class="empty-state">
                <p>No completed evaluation runs found for this project yet.</p>
                <a routerLink="/evaluations/new" class="btn btn-primary btn-sm">Run First Evaluation</a>
              </div>
            } @else {
              <!-- Trend Visualization Chart Card -->
              <div class="card" style="padding: 1.5rem; background: #0f172a; border: 1px solid #1e293b; border-radius: 12px;">
                <h3 style="margin-top: 0; color: #f8fafc; font-size: 1.1rem; margin-bottom: 1rem;">Quality Trajectory (Overall Score & Faithfulness)</h3>
                
                <div style="height: 180px; display: flex; align-items: flex-end; gap: 16px; padding: 1rem 0; border-bottom: 1px solid #334155; overflow-x: auto;">
                  @for (pt of projectTrends()!.trends; track pt.runId) {
                    <div style="display: flex; flex-direction: column; align-items: center; min-width: 60px; height: 100%; justify-content: flex-end;">
                      <span style="font-size: 11px; color: #34d399; font-weight: bold; margin-bottom: 4px;">
                        {{ pt.overallScore !== null && pt.overallScore !== undefined ? ((pt.overallScore * 100) | number:'1.0-0') + '%' : '—' }}
                      </span>
                      <div
                        [style.height.%]="(pt.overallScore || 0) * 100"
                        style="width: 24px; background: linear-gradient(180deg, #10b981 0%, #059669 100%); border-radius: 4px 4px 0 0; min-height: 4px;"
                        [title]="'Run ' + pt.runId.slice(0, 8) + ' • Score: ' + (pt.overallScore || 0)"
                      ></div>
                      <span style="font-size: 10px; color: #94a3b8; margin-top: 6px;">{{ pt.createdAt | date:'MM/dd' }}</span>
                    </div>
                  }
                </div>

                <div style="display: flex; gap: 20px; font-size: 12px; color: #94a3b8; margin-top: 10px;">
                  <span style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 12px; height: 12px; background: #10b981; border-radius: 2px;"></span> Overall Quality
                  </span>
                  <span>Total Recorded Runs: <strong>{{ projectTrends()!.totalRuns }}</strong></span>
                </div>
              </div>

              <!-- Trends Table -->
              <div class="card" style="padding: 1.5rem; background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; margin-top: 1.5rem;">
                <h3 style="margin-top: 0; color: #f8fafc; font-size: 1.1rem; margin-bottom: 1rem;">Run History & Prompt Versions</h3>
                <div style="overflow-x: auto;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: left;">
                    <thead>
                      <tr style="border-bottom: 1px solid #334155; color: #94a3b8;">
                        <th style="padding: 8px 12px;">Run</th>
                        <th style="padding: 8px 12px;">Date</th>
                        <th style="padding: 8px 12px;">Prompt / Tag</th>
                        <th style="padding: 8px 12px;">Overall</th>
                        <th style="padding: 8px 12px;">Faithfulness</th>
                        <th style="padding: 8px 12px;">Latency</th>
                        <th style="padding: 8px 12px;">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (pt of projectTrends()!.trends; track pt.runId) {
                        <tr style="border-bottom: 1px solid #1e293b;">
                          <td style="padding: 8px 12px; font-family: monospace; color: #38bdf8;">{{ pt.runId.slice(0, 8) }}</td>
                          <td style="padding: 8px 12px; color: #94a3b8;">{{ pt.createdAt | date:'short' }}</td>
                          <td style="padding: 8px 12px; color: #cbd5e1;">{{ pt.promptVersion || 'baseline' }}</td>
                          <td style="padding: 8px 12px; font-weight: bold; color: #10b981;">
                            {{ pt.overallScore !== null && pt.overallScore !== undefined ? ((pt.overallScore * 100) | number:'1.0-0') + '%' : '—' }}
                          </td>
                          <td style="padding: 8px 12px; color: #cbd5e1;">
                            {{ pt.faithfulness !== null && pt.faithfulness !== undefined ? ((pt.faithfulness * 100) | number:'1.0-0') + '%' : '—' }}
                          </td>
                          <td style="padding: 8px 12px; color: #f59e0b;">
                            {{ pt.averageLatency ? ((pt.averageLatency | number:'1.0-0') + ' ms') : '—' }}
                          </td>
                          <td style="padding: 8px 12px;">
                            <a [routerLink]="['/evaluations', pt.runId]" style="color: #60a5fa; text-decoration: none;">Inspect →</a>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }
          </div>
        }

        <!-- TAB 4: CI/CD & Production Enterprise Settings -->
        @if (activeTab() === 'production') {
          <div class="datasets-section">
            <div class="section-header">
              <div>
                <h2>⚙️ Production, CI/CD & Governance</h2>
                <p class="section-desc">Manage Quality Gate thresholds, external API Keys, Webhooks, and Schedules.</p>
              </div>
            </div>

            <!-- Newly Created Key Alert -->
            @if (newlyCreatedSecretKey()) {
              <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; border-radius: 8px; padding: 1rem; color: white;">
                <h4 style="margin: 0 0 6px 0; color: #34d399;">🔑 New API Key Generated</h4>
                <p style="margin: 0 0 8px 0; font-size: 0.85rem; color: #cbd5e1;">
                  Copy this key now. For security, it will <strong>never be shown again</strong>:
                </p>
                <div style="background: #020617; padding: 8px 12px; border-radius: 6px; font-family: monospace; font-size: 0.95rem; color: #38bdf8; word-break: break-all;">
                  {{ newlyCreatedSecretKey() }}
                </div>
                <button (click)="newlyCreatedSecretKey.set(null)" style="margin-top: 8px; background: transparent; border: 1px solid #334155; color: #cbd5e1; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
                  Dismiss
                </button>
              </div>
            }

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.5rem;">
              <!-- 1. Quality Gate Thresholds -->
              <div class="card" style="padding: 1.5rem; background: #0f172a; border: 1px solid #1e293b; border-radius: 12px;">
                <h3 style="margin-top: 0; color: #f8fafc; font-size: 1.1rem; margin-bottom: 0.5rem;">🛡️ Quality Gate Thresholds</h3>
                <p style="color: #94a3b8; font-size: 0.85rem; margin-top: 0; margin-bottom: 1rem;">
                  Evaluations and CI/CD pipelines will fail if metrics fall below these gates.
                </p>

                <div style="display: flex; flex-direction: column; gap: 0.75rem; font-size: 0.9rem;">
                  <div>
                    <label style="color: #cbd5e1; display: block; margin-bottom: 2px;">Min Overall Score (0.0 - 1.0):</label>
                    <input type="number" step="0.05" min="0" max="1" [(ngModel)]="thresholdOverall" class="input-control" />
                  </div>
                  <div>
                    <label style="color: #cbd5e1; display: block; margin-bottom: 2px;">Min Faithfulness:</label>
                    <input type="number" step="0.05" min="0" max="1" [(ngModel)]="thresholdFaithfulness" class="input-control" />
                  </div>
                  <div>
                    <label style="color: #cbd5e1; display: block; margin-bottom: 2px;">Min Answer Correctness:</label>
                    <input type="number" step="0.05" min="0" max="1" [(ngModel)]="thresholdCorrectness" class="input-control" />
                  </div>
                  <div>
                    <label style="color: #cbd5e1; display: block; margin-bottom: 2px;">Max Latency (ms):</label>
                    <input type="number" step="100" min="50" max="10000" [(ngModel)]="thresholdMaxLatency" class="input-control" />
                  </div>
                </div>

                <button (click)="saveThresholds()" [disabled]="savingThresholds()" class="btn btn-primary btn-sm" style="margin-top: 1rem;">
                  {{ savingThresholds() ? 'Saving...' : 'Save Quality Gate' }}
                </button>
              </div>

              <!-- 2. Integration API Keys -->
              <div class="card" style="padding: 1.5rem; background: #0f172a; border: 1px solid #1e293b; border-radius: 12px;">
                <h3 style="margin-top: 0; color: #f8fafc; font-size: 1.1rem; margin-bottom: 0.5rem;">🔑 External API Keys</h3>
                <p style="color: #94a3b8; font-size: 0.85rem; margin-top: 0; margin-bottom: 1rem;">
                  API keys for GitHub Actions, GitLab CI, and CLI evaluation runners.
                </p>

                <div style="display: flex; gap: 8px; margin-bottom: 1rem;">
                  <input type="text" [(ngModel)]="newKeyName" placeholder="Key Name (e.g. CI Runner)" class="input-control" />
                  <button (click)="generateApiKey()" [disabled]="generatingKey()" class="btn btn-secondary btn-sm" style="white-space: nowrap;">
                    Generate
                  </button>
                </div>

                <div style="max-height: 200px; overflow-y: auto;">
                  @for (k of apiKeys(); track k.id) {
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; padding: 6px 0; font-size: 0.85rem;">
                      <div>
                        <strong style="color: #f1f5f9;">{{ k.name }}</strong>
                        <div style="color: #64748b; font-family: monospace; font-size: 0.75rem;">{{ k.keyPrefix }}</div>
                      </div>
                      <button (click)="revokeKey(k.id)" style="color: #f87171; background: transparent; border: none; cursor: pointer; font-size: 0.8rem;">
                        Revoke
                      </button>
                    </div>
                  }
                  @if (apiKeys().length === 0) {
                    <p style="color: #64748b; font-size: 0.85rem;">No active API keys found.</p>
                  }
                </div>
              </div>

              <!-- 3. Webhooks -->
              <div class="card" style="padding: 1.5rem; background: #0f172a; border: 1px solid #1e293b; border-radius: 12px;">
                <h3 style="margin-top: 0; color: #f8fafc; font-size: 1.1rem; margin-bottom: 0.5rem;">🔔 Webhook Endpoints</h3>
                <p style="color: #94a3b8; font-size: 0.85rem; margin-top: 0; margin-bottom: 1rem;">
                  Receive signed HTTP POST events on evaluation completion and quality gate failure.
                </p>

                <div style="display: flex; gap: 8px; margin-bottom: 1rem;">
                  <input type="url" [(ngModel)]="newWebhookUrl" placeholder="https://ci.example.com/webhook" class="input-control" />
                  <button (click)="registerWebhook()" [disabled]="savingWebhook()" class="btn btn-secondary btn-sm" style="white-space: nowrap;">
                    Add Webhook
                  </button>
                </div>

                <div style="max-height: 180px; overflow-y: auto;">
                  @for (w of webhooks(); track w.id) {
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; padding: 6px 0; font-size: 0.85rem;">
                      <div style="overflow: hidden; text-overflow: ellipsis; max-width: 260px;">
                        <span style="color: #38bdf8; font-size: 0.8rem;">{{ w.url }}</span>
                      </div>
                      <button (click)="removeWebhook(w.id)" style="color: #f87171; background: transparent; border: none; cursor: pointer; font-size: 0.8rem;">
                        Delete
                      </button>
                    </div>
                  }
                  @if (webhooks().length === 0) {
                    <p style="color: #64748b; font-size: 0.85rem;">No webhooks registered.</p>
                  }
                </div>
              </div>

              <!-- 4. CI/CD Command Line Quickstart -->
              <div class="card" style="padding: 1.5rem; background: #0f172a; border: 1px solid #1e293b; border-radius: 12px;">
                <h3 style="margin-top: 0; color: #f8fafc; font-size: 1.1rem; margin-bottom: 0.5rem;">💻 CI/CD CLI Quickstart</h3>
                <p style="color: #94a3b8; font-size: 0.85rem; margin-top: 0; margin-bottom: 0.75rem;">
                  Automate regression detection in your GitHub Actions or GitLab pipeline:
                </p>
                <pre style="background: #020617; border: 1px solid #334155; border-radius: 6px; padding: 12px; font-size: 0.8rem; color: #38bdf8; overflow-x: auto; margin: 0;"># Run automated RAG evaluation
python cli/rageval.py run \
  --project "{{ p.name }}" \
  --dataset "{{ datasets().length > 0 ? datasets()[0].name : 'regression' }}" \
  --fail-under 85 \
  --api-key "$RAGEVAL_API_KEY"</pre>
                <p style="color: #64748b; font-size: 0.75rem; margin-top: 8px; margin-bottom: 0;">
                  Exits with code 1 if the quality gate fails, blocking faulty PR deployments.
                </p>
              </div>
            </div>
          </div>
        }
      }

      <!-- Edit Project Modal -->
      @if (showEditModal()) {
        <div class="modal-backdrop" (click)="closeEditModal()">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Edit Project</h3>
              <button (click)="closeEditModal()" class="btn-close">&times;</button>
            </div>
            <form (ngSubmit)="saveProjectEdit()" class="modal-form">
              <div class="form-group">
                <label for="editName">Project Name</label>
                <input id="editName" [(ngModel)]="editName" name="editName" required />
              </div>
              <div class="form-group">
                <label for="editDesc">Description</label>
                <textarea id="editDesc" [(ngModel)]="editDescription" name="editDesc" rows="3"></textarea>
              </div>
              <div class="modal-footer">
                <button type="button" (click)="closeEditModal()" class="btn btn-secondary">Cancel</button>
                <button type="submit" class="btn btn-primary" [disabled]="savingProject()">
                  {{ savingProject() ? 'Saving...' : 'Save Changes' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- New Dataset Modal -->
      @if (showDatasetModal()) {
        <div class="modal-backdrop" (click)="closeDatasetModal()">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Create Evaluation Dataset</h3>
              <button (click)="closeDatasetModal()" class="btn-close">&times;</button>
            </div>
            <form (ngSubmit)="saveNewDataset()" class="modal-form">
              <div class="form-group">
                <label for="dsName">Dataset Name <span class="required">*</span></label>
                <input id="dsName" [(ngModel)]="newDatasetName" name="dsName" required placeholder="e.g. Q3 2026 Earnings QA" />
              </div>
              <div class="form-group">
                <label for="dsDesc">Description</label>
                <textarea id="dsDesc" [(ngModel)]="newDatasetDesc" name="dsDesc" rows="3" placeholder="Target domain, expected retrieval depth..."></textarea>
              </div>
              <div class="modal-footer">
                <button type="button" (click)="closeDatasetModal()" class="btn btn-secondary">Cancel</button>
                <button type="submit" class="btn btn-primary" [disabled]="savingDataset()">
                  {{ savingDataset() ? 'Creating...' : 'Create Dataset' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .project-detail-page {
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
      color: #38bdf8;
      text-decoration: none;
    }

    .breadcrumbs a:hover {
      text-decoration: underline;
    }

    .sep {
      color: #475569;
    }

    .current {
      color: #cbd5e1;
    }

    .project-header-card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 1.75rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .header-top {
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

    h1 {
      margin: 0;
      font-size: 1.6rem;
      font-weight: 700;
      color: #f8fafc;
    }

    .dataset-count-badge {
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid #3b82f6;
      color: #60a5fa;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 9999px;
    }

    .project-desc {
      margin: 0.5rem 0 0 0;
      color: #94a3b8;
      font-size: 0.9rem;
      line-height: 1.5;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
    }

    .header-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.75rem;
      color: #64748b;
      border-top: 1px solid #1e293b;
      padding-top: 0.75rem;
    }

    .datasets-section {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
    }

    .section-header h2 {
      margin: 0 0 0.25rem 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: #f8fafc;
    }

    .section-desc {
      margin: 0;
      color: #94a3b8;
      font-size: 0.85rem;
    }

    .datasets-table-container {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 12px;
      overflow-x: auto;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.875rem;
    }

    .data-table th {
      background: #070d17;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.7rem;
      letter-spacing: 0.05em;
      padding: 0.85rem 1.25rem;
      border-bottom: 1px solid #1e293b;
    }

    .data-table td {
      padding: 1rem 1.25rem;
      border-bottom: 1px solid #1e293b;
      color: #cbd5e1;
    }

    .data-table tr:last-child td {
      border-bottom: none;
    }

    .ds-link {
      color: #38bdf8;
      font-weight: 600;
      text-decoration: none;
    }

    .ds-link:hover {
      text-decoration: underline;
    }

    .desc-cell {
      color: #94a3b8;
      max-width: 320px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .count-pill {
      background: #1e293b;
      color: #e2e8f0;
      font-size: 0.75rem;
      padding: 3px 8px;
      border-radius: 9999px;
      border: 1px solid #334155;
    }

    .date-cell {
      color: #64748b;
      font-size: 0.8rem;
    }

    .actions-col {
      text-align: right;
    }

    .btn-sm-open {
      background: #1e293b;
      color: #cbd5e1;
      text-decoration: none;
      padding: 0.4rem 0.75rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
      border: 1px solid #334155;
      display: inline-block;
      transition: all 0.15s ease;
    }

    .btn-sm-open:hover {
      background: #3b82f6;
      color: white;
      border-color: #3b82f6;
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

    .btn-primary {
      background: #3b82f6;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #2563eb;
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
      background: rgba(239, 68, 68, 0.1);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .btn-danger:hover {
      background: #ef4444;
      color: white;
    }

    .loading-state, .empty-state {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 3rem 2rem;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }

    .empty-icon {
      width: 54px;
      height: 54px;
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
      font-size: 1.15rem;
    }

    .empty-state p {
      margin: 0 0 0.5rem 0;
      color: #94a3b8;
      font-size: 0.85rem;
      max-width: 420px;
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
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 1rem;
    }

    .modal-card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 12px;
      width: 100%;
      max-width: 500px;
      padding: 1.75rem;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.25rem;
    }

    .modal-header h3 {
      margin: 0;
      font-size: 1.25rem;
      color: #f8fafc;
    }

    .btn-close {
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 1.5rem;
      cursor: pointer;
      line-height: 1;
    }

    .modal-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    label {
      font-size: 0.8rem;
      font-weight: 600;
      color: #cbd5e1;
    }

    .required {
      color: #f87171;
    }

    input, textarea {
      background: #020617;
      border: 1px solid #334155;
      color: #f8fafc;
      padding: 0.65rem 0.85rem;
      border-radius: 8px;
      font-size: 0.875rem;
      outline: none;
      font-family: inherit;
    }

    input:focus, textarea:focus {
      border-color: #3b82f6;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 0.5rem;
    }

    /* Tabs Navigation */
    .tabs-nav-bar {
      display: flex;
      gap: 0.75rem;
      border-bottom: 1px solid #1e293b;
      padding-bottom: 0.75rem;
      margin-bottom: 0.5rem;
    }

    .tab-pill-btn {
      background: #0f172a;
      border: 1px solid #334155;
      color: #94a3b8;
      padding: 0.55rem 1.15rem;
      border-radius: 20px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .tab-pill-btn:hover {
      color: #f8fafc;
      border-color: #475569;
    }

    .tab-pill-btn.active {
      background: #1e3a8a;
      color: #93c5fd;
      border-color: #3b82f6;
    }

    /* Documents & Internal RAG section */
    .documents-rag-section {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 1.5rem;
    }

    .doc-upload-card {
      border: 1px dashed #3b82f6;
      background: rgba(15, 23, 42, 0.7);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.25rem;
    }

    .card-header h2, .card-header h3 {
      margin: 0 0 0.25rem 0;
      color: #f8fafc;
    }

    .format-badges {
      display: flex;
      gap: 0.4rem;
    }

    .fmt-badge {
      font-size: 0.7rem;
      background: #1e293b;
      color: #38bdf8;
      border: 1px solid #334155;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-weight: 700;
    }

    .upload-controls {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .file-input {
      display: none;
    }

    .selected-filename {
      color: #f1f5f9;
      font-size: 0.9rem;
      font-weight: 500;
    }

    .error-msg-banner {
      margin-top: 1rem;
      background: #450a0a;
      border: 1px solid #dc2626;
      color: #fca5a5;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-size: 0.875rem;
    }

    .success-msg-banner {
      margin-top: 1rem;
      background: #064e3b;
      border: 1px solid #059669;
      color: #a7f3d0;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-size: 0.875rem;
    }

    .empty-state-sm {
      padding: 2rem 1rem;
      text-align: center;
      color: #64748b;
      font-size: 0.875rem;
    }

    .type-pill {
      font-size: 0.75rem;
      color: #94a3b8;
      background: #1e293b;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
    }

    .chunk-pill {
      font-size: 0.75rem;
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.1);
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-weight: 600;
    }

    .btn-delete-doc {
      background: transparent;
      border: 1px solid #dc2626;
      color: #f87171;
      padding: 0.25rem 0.6rem;
      border-radius: 4px;
      font-size: 0.75rem;
      cursor: pointer;
    }

    .btn-delete-doc:hover {
      background: #dc2626;
      color: #ffffff;
    }

    /* Grid for settings and query */
    .rag-config-query-grid {
      display: grid;
      grid-template-columns: 1fr 1.25fr;
      gap: 1.5rem;
    }

    @media (max-width: 960px) {
      .rag-config-query-grid {
        grid-template-columns: 1fr;
      }
    }

    .db-badge {
      background: #047857;
      color: #ecfdf5;
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.2rem 0.6rem;
      border-radius: 12px;
    }

    .live-pill {
      background: #0369a1;
      color: #e0f2fe;
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.2rem 0.6rem;
      border-radius: 12px;
    }

    .form-grid-stacked {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .input-control {
      background: #020617;
      border: 1px solid #334155;
      color: #f8fafc;
      padding: 0.65rem 0.85rem;
      border-radius: 8px;
      font-size: 0.9rem;
      width: 100%;
    }

    .field-hint {
      font-size: 0.75rem;
      color: #64748b;
      margin-top: 0.2rem;
    }

    .success-hint {
      font-size: 0.8rem;
      color: #34d399;
      font-weight: 600;
    }

    /* Playground Query styles */
    .query-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .rag-answer-box {
      margin-top: 1rem;
      background: #020617;
      border-left: 3px solid #10b981;
      border-radius: 6px;
      padding: 1rem;
    }

    .section-label {
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      color: #94a3b8;
      display: block;
      margin-bottom: 0.5rem;
    }

    .answer-text {
      margin: 0;
      color: #f1f5f9;
      font-size: 0.95rem;
      line-height: 1.5;
    }

    .rag-contexts-box {
      margin-top: 1rem;
    }

    .contexts-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .context-snippet-card {
      background: #020617;
      border: 1px solid #1e293b;
      border-radius: 6px;
      padding: 0.75rem;
    }

    .snippet-idx {
      font-size: 0.7rem;
      color: #38bdf8;
      font-weight: 700;
      display: block;
      margin-bottom: 0.25rem;
    }

    .snippet-content {
      margin: 0;
      font-size: 0.85rem;
      color: #cbd5e1;
      line-height: 1.4;
      white-space: pre-wrap;
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
  `],
})
export class ProjectDetailComponent implements OnInit {
  private readonly projectService = inject(ProjectService);
  private readonly internalRagService = inject(InternalRAGService);
  private readonly evaluationService = inject(EvaluationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  projectId = '';
  project = signal<Project | null>(null);
  datasets = signal<Dataset[]>([]);

  activeTab = signal<'datasets' | 'documents' | 'trends' | 'production'>('datasets');
  documents = signal<ProjectDocument[]>([]);
  loadingDocs = signal<boolean>(false);
  uploadingDoc = signal<boolean>(false);
  uploadError = signal<string | null>(null);
  uploadSuccess = signal<string | null>(null);
  selectedFile: File | null = null;

  // Vector Search Settings
  settingChunkSize = 1000;
  settingChunkOverlap = 200;
  settingTopK = 4;
  savingSettings = signal<boolean>(false);
  settingsSavedMessage = signal<string | null>(null);

  // RAG Query Playground
  ragTestQuestion = '';
  queryingRAG = signal<boolean>(false);
  ragQueryAnswer = signal<string | null>(null);
  ragQueryContexts = signal<string[]>([]);
  ragQueryError = signal<string | null>(null);

  // Phase 10: Historical Trends
  projectTrends = signal<ProjectTrends | null>(null);
  loadingTrends = signal<boolean>(false);

  // Phase 10: Production Quality Gate Thresholds
  thresholdOverall = 0.80;
  thresholdFaithfulness = 0.85;
  thresholdCorrectness = 0.80;
  thresholdMaxLatency = 30000;
  savingThresholds = signal<boolean>(false);

  // Phase 10: API Keys
  apiKeys = signal<ApiKeyItem[]>([]);
  newKeyName = '';
  generatingKey = signal<boolean>(false);
  newlyCreatedSecretKey = signal<string | null>(null);

  // Phase 10: Webhooks
  webhooks = signal<WebhookItem[]>([]);
  newWebhookUrl = '';
  savingWebhook = signal<boolean>(false);

  loadingProject = signal<boolean>(true);
  loadingDatasets = signal<boolean>(true);
  projectError = signal<string | null>(null);

  // Edit Project Modal
  showEditModal = signal<boolean>(false);
  editName = '';
  editDescription = '';
  savingProject = signal<boolean>(false);

  // New Dataset Modal
  showDatasetModal = signal<boolean>(false);
  newDatasetName = '';
  newDatasetDesc = '';
  savingDataset = signal<boolean>(false);

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id') || '';
    if (this.projectId) {
      this.loadProject();
      this.loadDatasets();
    }
  }

  loadProject(): void {
    this.loadingProject.set(true);
    this.projectService.getProject(this.projectId).subscribe({
      next: (proj) => {
        this.project.set(proj);
        this.loadingProject.set(false);
      },
      error: (err) => {
        this.projectError.set(err.error?.error?.message || 'Could not load project.');
        this.loadingProject.set(false);
      },
    });
  }

  loadDatasets(): void {
    this.loadingDatasets.set(true);
    this.projectService.listDatasets(this.projectId).subscribe({
      next: (data) => {
        this.datasets.set(data);
        this.loadingDatasets.set(false);
      },
      error: () => {
        this.loadingDatasets.set(false);
      },
    });
  }

  openEditModal(): void {
    const p = this.project();
    if (p) {
      this.editName = p.name;
      this.editDescription = p.description || '';
      this.showEditModal.set(true);
    }
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
  }

  saveProjectEdit(): void {
    if (!this.editName.trim()) return;

    this.savingProject.set(true);
    this.projectService
      .updateProject(this.projectId, {
        name: this.editName.trim(),
        description: this.editDescription.trim(),
      })
      .subscribe({
        next: (updated) => {
          this.project.set(updated);
          this.savingProject.set(false);
          this.closeEditModal();
        },
        error: () => {
          this.savingProject.set(false);
          alert('Failed to update project.');
        },
      });
  }

  deleteProject(): void {
    const p = this.project();
    if (!p) return;

    if (confirm(`Are you sure you want to delete "${p.name}"? This action cannot be undone.`)) {
      this.projectService.deleteProject(this.projectId).subscribe({
        next: () => {
          this.router.navigate(['/projects']);
        },
        error: () => {
          alert('Failed to delete project.');
        },
      });
    }
  }

  openNewDatasetModal(): void {
    this.newDatasetName = '';
    this.newDatasetDesc = '';
    this.showDatasetModal.set(true);
  }

  closeDatasetModal(): void {
    this.showDatasetModal.set(false);
  }

  saveNewDataset(): void {
    if (!this.newDatasetName.trim()) return;

    this.savingDataset.set(true);
    this.projectService
      .createDataset(this.projectId, {
        name: this.newDatasetName.trim(),
        description: this.newDatasetDesc.trim(),
      })
      .subscribe({
        next: (created) => {
          this.datasets.update((list) => [created, ...list]);
          this.savingDataset.set(false);
          this.closeDatasetModal();
          // Navigate to dataset detail to start adding questions right away
          this.router.navigate(['/datasets', created.id]);
        },
        error: () => {
          this.savingDataset.set(false);
          alert('Failed to create dataset.');
        },
      });
  }

  onDocumentsTabActive(): void {
    this.activeTab.set('documents');
    this.loadDocuments();
    this.loadRAGSettings();
  }

  loadDocuments(): void {
    this.loadingDocs.set(true);
    this.internalRagService.listDocuments(this.projectId).subscribe({
      next: (docs) => {
        this.documents.set(docs);
        this.loadingDocs.set(false);
      },
      error: () => this.loadingDocs.set(false),
    });
  }

  loadRAGSettings(): void {
    this.internalRagService.getRAGSettings(this.projectId).subscribe({
      next: (cfg) => {
        this.settingChunkSize = cfg.chunkSize;
        this.settingChunkOverlap = cfg.chunkOverlap;
        this.settingTopK = cfg.topK;
      },
    });
  }

  onFileSelected(event: any): void {
    const file = event.target?.files?.[0];
    if (file) {
      this.selectedFile = file;
      this.uploadError.set(null);
      this.uploadSuccess.set(null);
    }
  }

  uploadSelectedFile(): void {
    if (!this.selectedFile) return;

    this.uploadingDoc.set(true);
    this.uploadError.set(null);
    this.uploadSuccess.set(null);

    this.internalRagService.uploadDocument(this.projectId, this.selectedFile).subscribe({
      next: (doc) => {
        this.uploadingDoc.set(false);
        this.uploadSuccess.set(`Document "${doc.filename}" indexed into ${doc.chunkCount || 'vector'} chunks.`);
        this.selectedFile = null;
        this.loadDocuments();
      },
      error: (err) => {
        this.uploadingDoc.set(false);
        this.uploadError.set(err.error?.error?.message || 'Failed to upload document.');
      },
    });
  }

  deleteDocument(docId: string): void {
    if (confirm('Delete this document and remove all its vector embeddings from MongoDB Atlas?')) {
      this.internalRagService.deleteDocument(this.projectId, docId).subscribe({
        next: () => {
          this.documents.update((list) => list.filter((d) => d.id !== docId));
        },
      });
    }
  }

  saveRAGSettings(): void {
    this.savingSettings.set(true);
    this.settingsSavedMessage.set(null);

    this.internalRagService
      .updateRAGSettings(this.projectId, {
        chunkSize: Number(this.settingChunkSize),
        chunkOverlap: Number(this.settingChunkOverlap),
        topK: Number(this.settingTopK),
      })
      .subscribe({
        next: () => {
          this.savingSettings.set(false);
          this.settingsSavedMessage.set('Vector search parameters updated successfully.');
          setTimeout(() => this.settingsSavedMessage.set(null), 3000);
        },
        error: () => this.savingSettings.set(false),
      });
  }

  executeRAGQuery(): void {
    if (!this.ragTestQuestion.trim()) return;

    this.queryingRAG.set(true);
    this.ragQueryAnswer.set(null);
    this.ragQueryContexts.set([]);
    this.ragQueryError.set(null);

    this.internalRagService.queryInternalRAG(this.projectId, this.ragTestQuestion.trim()).subscribe({
      next: (res) => {
        this.queryingRAG.set(false);
        this.ragQueryAnswer.set(res.answer);
        this.ragQueryContexts.set(res.contexts || []);
      },
      error: (err) => {
        this.queryingRAG.set(false);
        this.ragQueryError.set(err.error?.error?.message || 'Internal RAG query failed.');
      },
    });
  }

  formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // --- Phase 10: Trends & CI/CD Handlers ---

  onTrendsTabActive(): void {
    this.activeTab.set('trends');
    this.loadTrends();
  }

  loadTrends(): void {
    this.loadingTrends.set(true);
    this.evaluationService.getProjectTrends(this.projectId).subscribe({
      next: (data) => {
        this.projectTrends.set(data);
        this.loadingTrends.set(false);
      },
      error: () => this.loadingTrends.set(false),
    });
  }

  onProductionTabActive(): void {
    this.activeTab.set('production');
    this.loadThresholds();
    this.loadApiKeys();
    this.loadWebhooks();
  }

  loadThresholds(): void {
    this.evaluationService.getProjectThresholds(this.projectId).subscribe({
      next: (th) => {
        this.thresholdOverall = th.overallScore;
        this.thresholdFaithfulness = th.faithfulness;
        this.thresholdCorrectness = th.answerCorrectness;
        if (th.maxLatencyMs) this.thresholdMaxLatency = th.maxLatencyMs;
      },
    });
  }

  saveThresholds(): void {
    this.savingThresholds.set(true);
    this.evaluationService
      .updateProjectThresholds(this.projectId, {
        overallScore: Number(this.thresholdOverall),
        faithfulness: Number(this.thresholdFaithfulness),
        answerCorrectness: Number(this.thresholdCorrectness),
        answerRelevance: 0.80,
        contextRelevance: 0.75,
        maxLatencyMs: Number(this.thresholdMaxLatency),
      })
      .subscribe({
        next: () => {
          this.savingThresholds.set(false);
          alert('Quality Gate Thresholds saved successfully!');
        },
        error: () => {
          this.savingThresholds.set(false);
          alert('Failed to save thresholds.');
        },
      });
  }

  loadApiKeys(): void {
    this.evaluationService.getApiKeys().subscribe({
      next: (keys) => this.apiKeys.set(keys),
    });
  }

  generateApiKey(): void {
    const name = this.newKeyName.trim();
    if (!name) {
      alert('Please enter a descriptive key name.');
      return;
    }
    this.generatingKey.set(true);
    this.evaluationService.createApiKey({ name, projectId: this.projectId }).subscribe({
      next: (res) => {
        this.generatingKey.set(false);
        this.newKeyName = '';
        if (res.secretKey) {
          this.newlyCreatedSecretKey.set(res.secretKey);
        }
        this.loadApiKeys();
      },
      error: () => {
        this.generatingKey.set(false);
        alert('Failed to generate API key.');
      },
    });
  }

  revokeKey(keyId: string): void {
    if (!confirm('Are you sure you want to revoke this API key?')) return;
    this.evaluationService.revokeApiKey(keyId).subscribe({
      next: () => this.loadApiKeys(),
    });
  }

  loadWebhooks(): void {
    this.evaluationService.getProjectWebhooks(this.projectId).subscribe({
      next: (hooks) => this.webhooks.set(hooks),
    });
  }

  registerWebhook(): void {
    const url = this.newWebhookUrl.trim();
    if (!url) return;
    this.savingWebhook.set(true);
    this.evaluationService
      .createWebhook(this.projectId, { url, events: ['evaluation.completed', 'gate.failed'] })
      .subscribe({
        next: () => {
          this.savingWebhook.set(false);
          this.newWebhookUrl = '';
          this.loadWebhooks();
        },
        error: () => {
          this.savingWebhook.set(false);
          alert('Failed to register webhook.');
        },
      });
  }

  removeWebhook(webhookId: string): void {
    if (!confirm('Delete this webhook?')) return;
    this.evaluationService.deleteWebhook(this.projectId, webhookId).subscribe({
      next: () => this.loadWebhooks(),
    });
  }
}

