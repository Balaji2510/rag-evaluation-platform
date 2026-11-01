import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Project } from '../../../core/models/project.model';
import { ProjectService } from '../../../core/services/project.service';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="projects-page">
      <div class="page-header">
        <div>
          <h1>Projects</h1>
          <p class="subtitle">Organize and manage RAG benchmark suites and evaluation datasets</p>
        </div>
        <a routerLink="/projects/new" class="btn btn-primary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="19" y1="12" x2="5" y2="12"></line>
          </svg>
          New Project
        </a>
      </div>

      <!-- Search & Filters -->
      <div class="toolbar">
        <div class="search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            [(ngModel)]="searchQuery"
            placeholder="Search projects..."
          />
        </div>
        <button (click)="loadProjects()" class="btn btn-secondary" [disabled]="loading()">
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
          <p>Loading projects...</p>
        </div>
      }

      <!-- Error State -->
      @else if (errorMessage()) {
        <div class="error-banner">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <div class="error-content">
            <p>{{ errorMessage() }}</p>
            <button (click)="loadProjects()" class="btn btn-sm btn-retry">Retry</button>
          </div>
        </div>
      }

      <!-- Empty State -->
      @else if (filteredProjects().length === 0) {
        <div class="empty-state">
          <div class="empty-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
            </svg>
          </div>
          @if (searchQuery) {
            <h3>No matching projects</h3>
            <p>No projects match your search query "{{ searchQuery }}".</p>
            <button (click)="searchQuery = ''" class="btn btn-secondary">Clear Search</button>
          } @else {
            <h3>No projects yet</h3>
            <p>Create your first evaluation project to start building datasets and benchmarking RAG pipelines.</p>
            <a routerLink="/projects/new" class="btn btn-primary">Create First Project</a>
          }
        </div>
      }

      <!-- Projects Grid -->
      @else {
        <div class="projects-grid">
          @for (project of filteredProjects(); track project.id) {
            <div class="project-card">
              <div class="card-top">
                <a [routerLink]="['/projects', project.id]" class="project-title-link">
                  <h3>{{ project.name }}</h3>
                </a>
                <span class="dataset-badge">
                  {{ project.datasetCount || 0 }} {{ (project.datasetCount === 1) ? 'dataset' : 'datasets' }}
                </span>
              </div>

              <p class="project-desc">{{ project.description || 'No description provided.' }}</p>

              <div class="card-footer">
                <span class="date">Updated {{ project.updatedAt | date:'mediumDate' }}</span>
                <div class="actions">
                  <a [routerLink]="['/projects', project.id]" class="btn-action">
                    Open
                  </a>
                  <button (click)="deleteProject(project)" class="btn-action delete" title="Delete Project">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .projects-page {
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
    }

    .search-box {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: #0f172a;
      border: 1px solid #1e293b;
      padding: 0.55rem 0.85rem;
      border-radius: 8px;
      width: 100%;
      max-width: 380px;
    }

    .search-box svg {
      color: #64748b;
    }

    .search-box input {
      background: transparent;
      border: none;
      outline: none;
      color: #f8fafc;
      font-size: 0.875rem;
      width: 100%;
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

    .btn-primary:hover {
      background: #2563eb;
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

    .btn-sm {
      padding: 0.35rem 0.75rem;
      font-size: 0.75rem;
    }

    .projects-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.25rem;
    }

    .project-card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      transition: all 0.2s ease;
    }

    .project-card:hover {
      border-color: #3b82f6;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    }

    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.75rem;
    }

    .project-title-link {
      text-decoration: none;
      color: #f8fafc;
    }

    .project-title-link:hover h3 {
      color: #60a5fa;
    }

    .card-top h3 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 600;
      line-height: 1.3;
    }

    .dataset-badge {
      background: #1e293b;
      color: #94a3b8;
      font-size: 0.7rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 9999px;
      white-space: nowrap;
      border: 1px solid #334155;
    }

    .project-desc {
      margin: 0;
      color: #94a3b8;
      font-size: 0.85rem;
      line-height: 1.5;
      flex: 1;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .card-footer {
      border-top: 1px solid #1e293b;
      padding-top: 0.85rem;
      margin-top: 0.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .date {
      font-size: 0.75rem;
      color: #64748b;
    }

    .actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .btn-action {
      background: #1e293b;
      color: #cbd5e1;
      text-decoration: none;
      padding: 0.35rem 0.75rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
      border: 1px solid #334155;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-action:hover {
      background: #3b82f6;
      color: white;
      border-color: #3b82f6;
    }

    .btn-action.delete:hover {
      background: rgba(239, 68, 68, 0.2);
      border-color: #ef4444;
      color: #f87171;
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
      width: 64px;
      height: 64px;
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
      font-size: 1.25rem;
    }

    .empty-state p {
      margin: 0 0 0.75rem 0;
      color: #94a3b8;
      font-size: 0.9rem;
      max-width: 440px;
      line-height: 1.5;
    }

    .spinner {
      width: 28px;
      height: 28px;
      border: 3px solid rgba(255, 255, 255, 0.2);
      border-radius: 50%;
      border-top-color: #3b82f6;
      animation: spin 0.8s linear infinite;
    }

    .error-banner {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 8px;
      padding: 1rem 1.25rem;
      color: #f87171;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .error-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }

    .error-content p {
      margin: 0;
      font-size: 0.85rem;
    }

    .btn-retry {
      background: #ef4444;
      color: white;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `],
})
export class ProjectListComponent implements OnInit {
  private readonly projectService = inject(ProjectService);

  projects = signal<Project[]>([]);
  loading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  searchQuery = '';

  ngOnInit(): void {
    this.loadProjects();
  }

  loadProjects(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.projectService.listProjects().subscribe({
      next: (data) => {
        this.projects.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load projects. Please check your connection.');
        this.loading.set(false);
      },
    });
  }

  filteredProjects(): Project[] {
    const query = this.searchQuery.trim().toLowerCase();
    if (!query) {
      return this.projects();
    }
    return this.projects().filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query))
    );
  }

  deleteProject(project: Project): void {
    if (confirm(`Are you sure you want to delete project "${project.name}"? This will delete all associated datasets.`)) {
      this.projectService.deleteProject(project.id).subscribe({
        next: () => {
          this.projects.update((list) => list.filter((p) => p.id !== project.id));
        },
        error: () => {
          alert('Failed to delete project.');
        },
      });
    }
  }
}

