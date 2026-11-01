import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ProjectService } from '../../../core/services/project.service';

@Component({
  selector: 'app-project-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="create-project-page">
      <div class="breadcrumbs">
        <a routerLink="/projects">Projects</a>
        <span class="sep">/</span>
        <span class="current">New Project</span>
      </div>

      <div class="form-card">
        <div class="card-header">
          <h1>Create Project</h1>
          <p class="subtitle">Set up a new workspace for your RAG pipeline evaluation datasets and benchmark runs.</p>
        </div>

        @if (errorMessage()) {
          <div class="alert-error">
            <span>{{ errorMessage() }}</span>
          </div>
        }

        <form (ngSubmit)="onSubmit()" #projectForm="ngForm" class="project-form" novalidate>
          <div class="form-group">
            <label for="name">Project Name <span class="required">*</span></label>
            <input
              id="name"
              name="name"
              type="text"
              [(ngModel)]="name"
              #nameField="ngModel"
              required
              maxlength="120"
              placeholder="e.g. Finance QA Assistant"
              [class.input-error]="projectForm.submitted && nameField.invalid"
            />
            @if (projectForm.submitted && nameField.invalid) {
              <span class="field-error">Project name is required.</span>
            }
          </div>

          <div class="form-group">
            <label for="description">Description (optional)</label>
            <textarea
              id="description"
              name="description"
              rows="4"
              [(ngModel)]="description"
              maxlength="1000"
              placeholder="Describe the application context, chunking strategy, or evaluation goals..."
            ></textarea>
          </div>

          <div class="form-actions">
            <a routerLink="/projects" class="btn btn-secondary">Cancel</a>
            <button type="submit" class="btn btn-primary" [disabled]="loading()">
              @if (loading()) {
                <span class="spinner"></span> Creating...
              } @else {
                Create Project
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .create-project-page {
      max-width: 680px;
      margin: 0 auto;
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

    .form-card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 2rem;
    }

    .card-header h1 {
      margin: 0 0 0.35rem 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: #f8fafc;
    }

    .subtitle {
      margin: 0 0 1.5rem 0;
      color: #94a3b8;
      font-size: 0.875rem;
      line-height: 1.4;
    }

    .alert-error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-size: 0.85rem;
      margin-bottom: 1.25rem;
    }

    .project-form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    label {
      font-size: 0.85rem;
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
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-size: 0.9rem;
      outline: none;
      font-family: inherit;
      transition: all 0.15s ease;
    }

    input:focus, textarea:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
    }

    input.input-error {
      border-color: #ef4444;
    }

    .field-error {
      font-size: 0.75rem;
      color: #f87171;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 1rem;
    }

    .btn {
      padding: 0.65rem 1.25rem;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.15s ease;
      border: none;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
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

    .btn-secondary:hover {
      background: #334155;
      color: white;
    }

    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `],
})
export class ProjectCreateComponent {
  private readonly projectService = inject(ProjectService);
  private readonly router = inject(Router);

  name = '';
  description = '';
  loading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  onSubmit(): void {
    if (!this.name.trim()) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.projectService
      .createProject({
        name: this.name.trim(),
        description: this.description.trim(),
      })
      .subscribe({
        next: (project) => {
          this.loading.set(false);
          this.router.navigate(['/projects', project.id]);
        },
        error: (err) => {
          this.loading.set(false);
          this.errorMessage.set(err.error?.error?.message || 'Could not create project.');
        },
      });
  }
}

