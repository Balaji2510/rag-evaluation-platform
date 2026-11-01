import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatasetDetail, DatasetItem } from '../../../core/models/dataset.model';
import { DatasetService } from '../../../core/services/dataset.service';

@Component({
  selector: 'app-dataset-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="dataset-detail-page">
      <!-- Breadcrumbs -->
      <div class="breadcrumbs">
        <a routerLink="/projects">Projects</a>
        <span class="sep">/</span>
        @if (dataset()?.projectId) {
          <a [routerLink]="['/projects', dataset()?.projectId]">Project</a>
          <span class="sep">/</span>
        }
        <span class="current">{{ dataset()?.name || 'Dataset Details' }}</span>
      </div>

      <!-- Loading State -->
      @if (loading()) {
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading dataset and evaluation items...</p>
        </div>
      }

      <!-- Error State -->
      @else if (errorMessage()) {
        <div class="error-banner">
          <p>{{ errorMessage() }}</p>
          <button (click)="loadDataset()" class="btn btn-sm btn-secondary">Retry</button>
        </div>
      }

      @else if (dataset(); as ds) {
        <!-- Dataset Header Card -->
        <div class="dataset-header-card">
          <div class="header-top">
            <div>
              <div class="title-row">
                <h1>{{ ds.name }}</h1>
                <span class="count-badge">{{ ds.items.length }} {{ ds.items.length === 1 ? 'Question' : 'Questions' }}</span>
              </div>
              <p class="dataset-desc">{{ ds.description || 'Evaluation benchmark suite for RAG retrieval and generation accuracy.' }}</p>
            </div>

            <div class="header-actions">
              <button (click)="openImportModal()" class="btn btn-secondary">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Import CSV / JSON
              </button>
              <button (click)="openAddModal()" class="btn btn-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="19" y1="12" x2="5" y2="12"></line>
                </svg>
                Add Question
              </button>
            </div>
          </div>
        </div>

        <!-- Questions Section -->
        <div class="table-section">
          <div class="table-toolbar">
            <h2>Evaluation Questions ({{ filteredItems().length }})</h2>
            <div class="search-box">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input type="text" [(ngModel)]="searchFilter" placeholder="Filter questions..." />
            </div>
          </div>

          @if (ds.items.length === 0) {
            <div class="empty-state">
              <div class="empty-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </div>
              <h3>No evaluation questions yet</h3>
              <p>Add sample queries with ground-truth answers and expected context chunks to evaluate retrieval precision and generation faithfulness.</p>
              <div class="empty-actions">
                <button (click)="openAddModal()" class="btn btn-primary">Add Single Question</button>
                <button (click)="openImportModal()" class="btn btn-secondary">Import from CSV / JSON</button>
              </div>
            </div>
          } @else if (filteredItems().length === 0) {
            <div class="empty-state">
              <p>No questions match your filter "{{ searchFilter }}".</p>
              <button (click)="searchFilter = ''" class="btn btn-secondary">Clear Filter</button>
            </div>
          } @else {
            <div class="items-table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th style="width: 28%;">Question</th>
                    <th style="width: 32%;">Expected Answer</th>
                    <th style="width: 22%;">Expected Contexts</th>
                    <th style="width: 10%;">Metadata</th>
                    <th style="width: 8%; text-align: right;">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of filteredItems(); track item.id) {
                    <tr>
                      <td class="question-cell">
                        <strong>{{ item.question }}</strong>
                      </td>
                      <td class="answer-cell">
                        {{ item.expectedAnswer }}
                      </td>
                      <td>
                        @if (item.expectedContexts && item.expectedContexts.length > 0) {
                          <div class="contexts-preview">
                            <span class="context-pill">{{ item.expectedContexts.length }} chunk(s)</span>
                            <span class="context-snippet" [title]="item.expectedContexts.join('\n\n')">
                              {{ item.expectedContexts[0] }}
                            </span>
                          </div>
                        } @else {
                          <span class="empty-tag">None</span>
                        }
                      </td>
                      <td>
                        @if (item.metadata && getMetaKeys(item.metadata).length > 0) {
                          <div class="tags-list">
                            @for (key of getMetaKeys(item.metadata); track key) {
                              <span class="meta-tag">{{ key }}: {{ item.metadata[key] }}</span>
                            }
                          </div>
                        } @else {
                          <span class="empty-tag">—</span>
                        }
                      </td>
                      <td class="actions-cell">
                        <div class="row-actions">
                          <button (click)="openEditModal(item)" class="btn-icon" title="Edit Question">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                          <button (click)="deleteItem(item)" class="btn-icon delete" title="Delete Question">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      }

      <!-- Add / Edit Question Modal -->
      @if (showItemModal()) {
        <div class="modal-backdrop" (click)="closeItemModal()">
          <div class="modal-card modal-lg" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>{{ editingItemId() ? 'Edit Evaluation Question' : 'Add Evaluation Question' }}</h3>
              <button (click)="closeItemModal()" class="btn-close">&times;</button>
            </div>
            <form (ngSubmit)="saveItem()" class="modal-form">
              <div class="form-group">
                <label for="itemQuestion">Evaluation Query / Question <span class="required">*</span></label>
                <textarea
                  id="itemQuestion"
                  name="itemQuestion"
                  [(ngModel)]="itemQuestion"
                  required
                  rows="2"
                  placeholder="e.g. What is the cancellation policy for enterprise subscriptions?"
                ></textarea>
              </div>

              <div class="form-group">
                <label for="itemAnswer">Ground Truth Expected Answer <span class="required">*</span></label>
                <textarea
                  id="itemAnswer"
                  name="itemAnswer"
                  [(ngModel)]="itemExpectedAnswer"
                  required
                  rows="3"
                  placeholder="The exact or ideal answer expected from the generation LLM..."
                ></textarea>
              </div>

              <div class="form-group">
                <label for="itemContexts">Expected Reference Contexts (One chunk per line or separated by '---')</label>
                <textarea
                  id="itemContexts"
                  name="itemContexts"
                  [(ngModel)]="itemContextsRaw"
                  rows="3"
                  placeholder="Relevant source chunks that must be retrieved..."
                ></textarea>
              </div>

              <div class="form-group">
                <label for="itemMetadata">Metadata (JSON format optional)</label>
                <input
                  id="itemMetadata"
                  name="itemMetadata"
                  [(ngModel)]="itemMetadataRaw"
                  placeholder='e.g. {"difficulty": "hard", "category": "billing"}'
                />
              </div>

              <div class="modal-footer">
                <button type="button" (click)="closeItemModal()" class="btn btn-secondary">Cancel</button>
                <button type="submit" class="btn btn-primary" [disabled]="savingItem()">
                  {{ savingItem() ? 'Saving...' : (editingItemId() ? 'Update Question' : 'Save Question') }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- CSV / JSON Import Modal -->
      @if (showImportModal()) {
        <div class="modal-backdrop" (click)="closeImportModal()">
          <div class="modal-card modal-lg" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Import Dataset Items</h3>
              <button (click)="closeImportModal()" class="btn-close">&times;</button>
            </div>

            <div class="import-tabs">
              <button
                type="button"
                [class.active]="importTab === 'json'"
                (click)="importTab = 'json'"
                class="tab-btn"
              >
                JSON Array
              </button>
              <button
                type="button"
                [class.active]="importTab === 'csv'"
                (click)="importTab = 'csv'"
                class="tab-btn"
              >
                CSV Format
              </button>
            </div>

            <div class="import-body">
              @if (importTab === 'json') {
                <p class="import-hint">
                  Paste a JSON array of evaluation items with <code>question</code> and <code>expectedAnswer</code>:
                </p>
                <textarea
                  [(ngModel)]="rawImportText"
                  rows="8"
                  class="code-textarea"
                  placeholder='[
  {
    "question": "What is the warranty period?",
    "expectedAnswer": "The standard warranty is 2 years.",
    "expectedContexts": ["Section 4: Hardware warranty covers 24 months."],
    "metadata": {"source": "manual"}
  }
]'
                ></textarea>
              } @else {
                <p class="import-hint">
                  Paste CSV text. Columns: <code>question,expectedAnswer,expectedContexts,metadata</code> (comma or semicolon separated):
                </p>
                <textarea
                  [(ngModel)]="rawImportText"
                  rows="8"
                  class="code-textarea"
                  placeholder="question,expectedAnswer,expectedContexts,metadata
What is the battery life?,Up to 18 hours.,Battery lasts 18h under normal use.,category=specs"
                ></textarea>
              }

              @if (importError()) {
                <div class="import-error-msg">{{ importError() }}</div>
              }

              @if (importSuccessMsg()) {
                <div class="import-success-msg">{{ importSuccessMsg() }}</div>
              }
            </div>

            <div class="modal-footer">
              <button type="button" (click)="closeImportModal()" class="btn btn-secondary">Cancel</button>
              <button
                type="button"
                (click)="executeImport()"
                class="btn btn-primary"
                [disabled]="importing() || !rawImportText.trim()"
              >
                {{ importing() ? 'Importing...' : 'Parse & Import Items' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .dataset-detail-page {
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

    .dataset-header-card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 1.75rem;
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

    .count-badge {
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid #3b82f6;
      color: #60a5fa;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 9999px;
    }

    .dataset-desc {
      margin: 0.5rem 0 0 0;
      color: #94a3b8;
      font-size: 0.9rem;
      line-height: 1.4;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
    }

    .table-section {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .table-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
    }

    .table-toolbar h2 {
      margin: 0;
      font-size: 1.2rem;
      font-weight: 600;
      color: #f8fafc;
    }

    .search-box {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: #0f172a;
      border: 1px solid #1e293b;
      padding: 0.45rem 0.75rem;
      border-radius: 8px;
      width: 260px;
    }

    .search-box svg {
      color: #64748b;
    }

    .search-box input {
      background: transparent;
      border: none;
      outline: none;
      color: #f8fafc;
      font-size: 0.85rem;
      width: 100%;
    }

    .items-table-container {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 12px;
      overflow-x: auto;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.85rem;
    }

    .data-table th {
      background: #070d17;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.7rem;
      letter-spacing: 0.05em;
      padding: 0.85rem 1rem;
      border-bottom: 1px solid #1e293b;
    }

    .data-table td {
      padding: 0.9rem 1rem;
      border-bottom: 1px solid #1e293b;
      color: #cbd5e1;
      vertical-align: top;
    }

    .data-table tr:last-child td {
      border-bottom: none;
    }

    .question-cell strong {
      color: #f8fafc;
      font-weight: 600;
      line-height: 1.4;
      display: block;
    }

    .answer-cell {
      color: #94a3b8;
      line-height: 1.4;
    }

    .contexts-preview {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .context-pill {
      background: #1e293b;
      border: 1px solid #334155;
      color: #38bdf8;
      font-size: 0.7rem;
      padding: 1px 6px;
      border-radius: 4px;
      align-self: flex-start;
      font-family: monospace;
    }

    .context-snippet {
      font-size: 0.75rem;
      color: #64748b;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      font-style: italic;
    }

    .tags-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
    }

    .meta-tag {
      background: #111c33;
      border: 1px solid #1e3a5f;
      color: #93c5fd;
      font-size: 0.7rem;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
    }

    .empty-tag {
      color: #475569;
      font-size: 0.75rem;
    }

    .row-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.35rem;
    }

    .btn-icon {
      background: transparent;
      border: 1px solid #334155;
      color: #94a3b8;
      padding: 0.35rem;
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
      background: rgba(239, 68, 68, 0.15);
      border-color: #ef4444;
      color: #f87171;
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

    .empty-actions {
      display: flex;
      gap: 0.75rem;
      margin-top: 0.5rem;
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
      margin: 0;
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

    /* Modals */
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
      max-width: 520px;
      padding: 1.75rem;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
      max-height: 90vh;
      overflow-y: auto;
    }

    .modal-card.modal-lg {
      max-width: 650px;
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
    }

    .modal-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
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

    .code-textarea {
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 0.8rem;
      line-height: 1.4;
      background: #070d17;
      color: #38bdf8;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 0.75rem;
    }

    .import-tabs {
      display: flex;
      gap: 0.5rem;
      border-bottom: 1px solid #1e293b;
      margin-bottom: 1rem;
    }

    .tab-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      padding: 0.5rem 1rem;
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
      border-bottom: 2px solid transparent;
    }

    .tab-btn.active {
      color: #38bdf8;
      border-bottom-color: #38bdf8;
    }

    .import-hint {
      margin: 0 0 0.5rem 0;
      font-size: 0.8rem;
      color: #94a3b8;
    }

    .import-hint code {
      background: #1e293b;
      color: #38bdf8;
      padding: 1px 4px;
      border-radius: 4px;
    }

    .import-error-msg {
      margin-top: 0.5rem;
      color: #f87171;
      font-size: 0.8rem;
    }

    .import-success-msg {
      margin-top: 0.5rem;
      color: #4ade80;
      font-size: 0.8rem;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `],
})
export class DatasetDetailComponent implements OnInit {
  private readonly datasetService = inject(DatasetService);
  private readonly route = inject(ActivatedRoute);

  datasetId = '';
  dataset = signal<DatasetDetail | null>(null);
  loading = signal<boolean>(true);
  errorMessage = signal<string | null>(null);
  searchFilter = '';

  // Add / Edit Modal
  showItemModal = signal<boolean>(false);
  editingItemId = signal<string | null>(null);
  itemQuestion = '';
  itemExpectedAnswer = '';
  itemContextsRaw = '';
  itemMetadataRaw = '';
  savingItem = signal<boolean>(false);

  // Import Modal
  showImportModal = signal<boolean>(false);
  importTab: 'json' | 'csv' = 'json';
  rawImportText = '';
  importing = signal<boolean>(false);
  importError = signal<string | null>(null);
  importSuccessMsg = signal<string | null>(null);

  ngOnInit(): void {
    this.datasetId = this.route.snapshot.paramMap.get('id') || '';
    if (this.datasetId) {
      this.loadDataset();
    }
  }

  loadDataset(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.datasetService.getDataset(this.datasetId).subscribe({
      next: (data) => {
        this.dataset.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error?.message || 'Could not load dataset.');
        this.loading.set(false);
      },
    });
  }

  filteredItems(): DatasetItem[] {
    const ds = this.dataset();
    if (!ds) return [];

    const query = this.searchFilter.trim().toLowerCase();
    if (!query) return ds.items;

    return ds.items.filter(
      (item) =>
        item.question.toLowerCase().includes(query) ||
        item.expectedAnswer.toLowerCase().includes(query)
    );
  }

  getMetaKeys(meta: Record<string, any>): string[] {
    return Object.keys(meta || {});
  }

  openAddModal(): void {
    this.editingItemId.set(null);
    this.itemQuestion = '';
    this.itemExpectedAnswer = '';
    this.itemContextsRaw = '';
    this.itemMetadataRaw = '';
    this.showItemModal.set(true);
  }

  openEditModal(item: DatasetItem): void {
    this.editingItemId.set(item.id);
    this.itemQuestion = item.question;
    this.itemExpectedAnswer = item.expectedAnswer;
    this.itemContextsRaw = (item.expectedContexts || []).join('\n---\n');
    this.itemMetadataRaw = Object.keys(item.metadata || {}).length
      ? JSON.stringify(item.metadata)
      : '';
    this.showItemModal.set(true);
  }

  closeItemModal(): void {
    this.showItemModal.set(false);
  }

  saveItem(): void {
    if (!this.itemQuestion.trim() || !this.itemExpectedAnswer.trim()) return;

    // Parse contexts
    const contexts = this.itemContextsRaw
      .split(/---|\n\n/)
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    // Parse metadata
    let metadata: Record<string, any> = {};
    if (this.itemMetadataRaw.trim()) {
      try {
        metadata = JSON.parse(this.itemMetadataRaw.trim());
      } catch {
        // Fallback to simple key=value parsing
        this.itemMetadataRaw.split(',').forEach((pair) => {
          const [k, v] = pair.split('=').map((s) => s.trim());
          if (k && v) metadata[k] = v;
        });
      }
    }

    const payload = {
      question: this.itemQuestion.trim(),
      expectedAnswer: this.itemExpectedAnswer.trim(),
      expectedContexts: contexts,
      metadata,
    };

    this.savingItem.set(true);

    const editId = this.editingItemId();
    if (editId) {
      this.datasetService.updateItem(this.datasetId, editId, payload).subscribe({
        next: (updated) => {
          this.dataset.update((ds) => {
            if (!ds) return null;
            return {
              ...ds,
              items: ds.items.map((i) => (i.id === updated.id ? updated : i)),
            };
          });
          this.savingItem.set(false);
          this.closeItemModal();
        },
        error: () => {
          this.savingItem.set(false);
          alert('Failed to update question.');
        },
      });
    } else {
      this.datasetService.addItem(this.datasetId, payload).subscribe({
        next: (created) => {
          this.dataset.update((ds) => {
            if (!ds) return null;
            return {
              ...ds,
              items: [...ds.items, created],
              itemCount: ds.items.length + 1,
            };
          });
          this.savingItem.set(false);
          this.closeItemModal();
        },
        error: () => {
          this.savingItem.set(false);
          alert('Failed to add question.');
        },
      });
    }
  }

  deleteItem(item: DatasetItem): void {
    if (confirm(`Delete question "${item.question.slice(0, 50)}..."?`)) {
      this.datasetService.deleteItem(this.datasetId, item.id).subscribe({
        next: () => {
          this.dataset.update((ds) => {
            if (!ds) return null;
            return {
              ...ds,
              items: ds.items.filter((i) => i.id !== item.id),
              itemCount: Math.max(0, ds.items.length - 1),
            };
          });
        },
        error: () => {
          alert('Failed to delete question.');
        },
      });
    }
  }

  openImportModal(): void {
    this.rawImportText = '';
    this.importError.set(null);
    this.importSuccessMsg.set(null);
    this.showImportModal.set(true);
  }

  closeImportModal(): void {
    this.showImportModal.set(false);
  }

  executeImport(): void {
    this.importError.set(null);
    this.importSuccessMsg.set(null);
    const text = this.rawImportText.trim();
    if (!text) return;

    let itemsToImport: any[] = [];

    if (this.importTab === 'json') {
      try {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
          this.importError.set('JSON must be an array of objects.');
          return;
        }
        itemsToImport = parsed.map((item) => ({
          question: item.question || '',
          expectedAnswer: item.expectedAnswer || '',
          expectedContexts: Array.isArray(item.expectedContexts)
            ? item.expectedContexts
            : item.expectedContexts ? [String(item.expectedContexts)] : [],
          metadata: item.metadata || {},
        }));
      } catch (err) {
        this.importError.set('Invalid JSON format: ' + String(err));
        return;
      }
    } else {
      // CSV Parsing
      try {
        const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
        if (lines.length < 2) {
          this.importError.set('CSV must contain a header row and at least one data row.');
          return;
        }

        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
        const qIdx = headers.indexOf('question');
        const aIdx = headers.indexOf('expectedanswer');

        if (qIdx === -1 || aIdx === -1) {
          this.importError.set('CSV must include "question" and "expectedAnswer" headers.');
          return;
        }

        const cIdx = headers.indexOf('expectedcontexts');
        const mIdx = headers.indexOf('metadata');

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c) => c.trim());
          if (cols[qIdx] && cols[aIdx]) {
            itemsToImport.push({
              question: cols[qIdx],
              expectedAnswer: cols[aIdx],
              expectedContexts: cIdx !== -1 && cols[cIdx] ? [cols[cIdx]] : [],
              metadata: mIdx !== -1 && cols[mIdx] ? { info: cols[mIdx] } : {},
            });
          }
        }
      } catch (err) {
        this.importError.set('Error parsing CSV: ' + String(err));
        return;
      }
    }

    if (itemsToImport.length === 0) {
      this.importError.set('No valid items found to import.');
      return;
    }

    this.importing.set(true);
    this.datasetService
      .importItems(this.datasetId, { items: itemsToImport })
      .subscribe({
        next: (res) => {
          this.importing.set(false);
          this.importSuccessMsg.set(`Successfully imported ${res.importedCount} questions.`);
          this.loadDataset();
          setTimeout(() => this.closeImportModal(), 1200);
        },
        error: (err) => {
          this.importing.set(false);
          this.importError.set(err.error?.error?.message || 'Import failed.');
        },
      });
  }
}

