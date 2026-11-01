import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { HealthService } from '../../core/services/health.service';
import { WorkspaceService } from '../../core/services/workspace.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <header class="header">
      <!-- Left: Breadcrumb & Context -->
      <div class="header-left">
        @if (authService.isAuthenticated()) {
          <div class="breadcrumb-container">
            <a routerLink="/projects" class="breadcrumb-root">Projects</a>
            <span class="breadcrumb-separator">/</span>
            <div class="project-pill" [title]="workspace.currentProject()?.id || ''">
              <span class="project-pill-dot"></span>
              <span class="project-name">{{ workspace.currentProject()?.name || 'Active Project' }}</span>
            </div>
            <span class="breadcrumb-separator">/</span>
            <span class="breadcrumb-current">{{ currentSectionTitle() }}</span>
          </div>
        } @else {
          <a routerLink="/" class="brand-link">
            <div class="brand-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                <polyline points="2 17 12 22 22 17"></polyline>
                <polyline points="2 12 12 17 22 12"></polyline>
              </svg>
            </div>
            <span class="brand-name">RAG Evaluation Platform</span>
          </a>
        }
      </div>

      <!-- Right: Search, Actions, System Status, User Avatar -->
      <div class="header-right">
        <!-- Quick Search Bar (Postman / Linear style) -->
        @if (authService.isAuthenticated()) {
          <div class="quick-search-trigger" (click)="focusSearch()">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <span class="search-placeholder">Search runs, datasets, questions...</span>
            <kbd class="shortcut-key">Ctrl K</kbd>
          </div>
        }

        <!-- Live API Status Indicator -->
        <div
          class="status-pill"
          [class.online]="backendStatus() === 'ok'"
          [class.offline]="backendStatus() === 'error'"
          [class.checking]="backendStatus() === 'checking'"
          title="FastAPI Backend Health"
        >
          <span class="status-dot"></span>
          <span class="status-label">
            @if (backendStatus() === 'ok') {
              API Healthy
            } @else if (backendStatus() === 'checking') {
              Checking...
            } @else {
              API Degraded
            }
          </span>
        </div>

        @if (authService.isAuthenticated()) {
          <!-- Notifications Pill -->
          <button type="button" class="icon-tool-btn" title="Evaluation Alerts & Notifications">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            <span class="notify-badge"></span>
          </button>

          <!-- Help / Documentation -->
          <a
            routerLink="/health"
            class="icon-tool-btn"
            title="System Documentation & API Diagnostics"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </a>

          <!-- Environment Badge -->
          <div class="env-pill">{{ appEnv }}</div>

          <!-- User Menu -->
          <div class="user-menu-pill">
            <div class="avatar-circle">
              {{ (authService.currentUser()?.name || 'D').charAt(0).toUpperCase() }}
            </div>
            <span class="user-display-name">{{ authService.currentUser()?.name }}</span>
          </div>
        } @else {
          <div class="auth-links">
            <a routerLink="/login" class="nav-btn-link">Sign In</a>
            <a routerLink="/register" class="nav-btn-primary">Register</a>
          </div>
        }
      </div>
    </header>
  `,
  styles: [`
    .header {
      height: 54px;
      background: #090d16;
      border-bottom: 1px solid #1a2333;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 1.25rem;
      color: #f8fafc;
      position: sticky;
      top: 0;
      z-index: 50;
      user-select: none;
    }

    /* Left Breadcrumb */
    .header-left {
      display: flex;
      align-items: center;
      min-width: 0;
    }

    .breadcrumb-container {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8125rem;
    }

    .breadcrumb-root {
      color: #94a3b8;
      text-decoration: none;
      font-weight: 500;
      transition: color 0.15s ease;
    }

    .breadcrumb-root:hover {
      color: #38bdf8;
    }

    .breadcrumb-separator {
      color: #475569;
      font-size: 0.75rem;
    }

    .project-pill {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      background: #111a2c;
      border: 1px solid #1e2d48;
      padding: 0.2rem 0.55rem;
      border-radius: 4px;
      color: #f1f5f9;
      font-weight: 600;
      max-width: 220px;
    }

    .project-pill-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #38bdf8;
      box-shadow: 0 0 8px rgba(56, 189, 248, 0.6);
    }

    .project-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .breadcrumb-current {
      color: #64748b;
      font-weight: 500;
    }

    /* Fallback Brand Link */
    .brand-link {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      text-decoration: none;
      color: inherit;
    }

    .brand-icon {
      color: #38bdf8;
      display: flex;
      align-items: center;
    }

    .brand-name {
      font-size: 0.875rem;
      font-weight: 700;
      color: #f8fafc;
    }

    /* Right Header Elements */
    .header-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .quick-search-trigger {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: #0f1626;
      border: 1px solid #1a253a;
      border-radius: 5px;
      padding: 0.35rem 0.65rem;
      color: #64748b;
      font-size: 0.775rem;
      cursor: pointer;
      transition: all 0.15s ease;
      min-width: 240px;
    }

    .quick-search-trigger:hover {
      background: #141e33;
      border-color: #2b3d60;
      color: #94a3b8;
    }

    .search-placeholder {
      flex: 1;
      text-align: left;
    }

    .shortcut-key {
      font-size: 0.65rem;
      background: #1a2333;
      border: 1px solid #2d3b55;
      color: #94a3b8;
      padding: 1px 4px;
      border-radius: 3px;
      font-family: monospace;
      line-height: 1;
    }

    /* Status Pill */
    .status-pill {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      background: #111827;
      border: 1px solid #1f2937;
      padding: 0.25rem 0.55rem;
      border-radius: 4px;
      font-size: 0.725rem;
      font-weight: 500;
      color: #94a3b8;
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #64748b;
    }

    .status-pill.online {
      border-color: rgba(16, 185, 129, 0.25);
      background: rgba(16, 185, 129, 0.08);
      color: #34d399;
    }

    .status-pill.online .status-dot {
      background: #10b981;
      box-shadow: 0 0 6px #10b981;
    }

    .status-pill.offline {
      border-color: rgba(239, 68, 68, 0.25);
      background: rgba(239, 68, 68, 0.08);
      color: #f87171;
    }

    .status-pill.offline .status-dot {
      background: #ef4444;
    }

    .status-pill.checking .status-dot {
      background: #eab308;
    }

    .icon-tool-btn {
      background: transparent;
      border: 1px solid transparent;
      color: #94a3b8;
      border-radius: 4px;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      position: relative;
      text-decoration: none;
      transition: all 0.15s ease;
    }

    .icon-tool-btn:hover {
      background: #162032;
      color: #f8fafc;
      border-color: #223049;
    }

    .notify-badge {
      position: absolute;
      top: 6px;
      right: 6px;
      width: 6px;
      height: 6px;
      background: #38bdf8;
      border-radius: 50%;
      box-shadow: 0 0 6px #38bdf8;
    }

    .env-pill {
      font-size: 0.65rem;
      font-weight: 600;
      padding: 2px 6px;
      background: #151f30;
      border: 1px solid #23314a;
      border-radius: 3px;
      color: #94a3b8;
      font-family: monospace;
      text-transform: uppercase;
    }

    /* User Menu Pill */
    .user-menu-pill {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.25rem 0.5rem;
      border-radius: 5px;
      background: #0f1626;
      border: 1px solid #1c273c;
    }

    .avatar-circle {
      width: 22px;
      height: 22px;
      border-radius: 4px;
      background: #0284c7;
      color: #ffffff;
      font-size: 0.7rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .user-display-name {
      font-size: 0.775rem;
      font-weight: 500;
      color: #cbd5e1;
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .auth-links {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .nav-btn-link {
      color: #94a3b8;
      text-decoration: none;
      font-size: 0.8125rem;
      font-weight: 500;
      padding: 0.35rem 0.65rem;
    }

    .nav-btn-primary {
      background: #0284c7;
      color: #ffffff;
      text-decoration: none;
      font-size: 0.8125rem;
      font-weight: 600;
      padding: 0.35rem 0.75rem;
      border-radius: 5px;
    }

    @media (max-width: 768px) {
      .quick-search-trigger {
        display: none;
      }
      .user-display-name {
        display: none;
      }
    }
  `],
})
export class HeaderComponent implements OnInit {
  readonly authService = inject(AuthService);
  readonly workspace = inject(WorkspaceService);
  private readonly healthService = inject(HealthService);
  private readonly router = inject(Router);

  readonly backendStatus = signal<'ok' | 'error' | 'checking'>('checking');
  readonly currentSectionTitle = signal<string>('Overview');
  readonly appEnv = environment.production ? 'PROD' : 'DEV';

  ngOnInit(): void {
    this.checkHealth();
    this.trackRouteSection(this.router.url);

    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.trackRouteSection(event.urlAfterRedirects || event.url);
      });
  }

  private trackRouteSection(url: string): void {
    if (url.includes('/dashboard')) {
      this.currentSectionTitle.set('Overview');
    } else if (url.includes('/evaluations')) {
      this.currentSectionTitle.set('Evaluations');
    } else if (url.includes('/datasets')) {
      this.currentSectionTitle.set('Datasets');
    } else if (url.includes('/configurations')) {
      this.currentSectionTitle.set('RAG Configs');
    } else if (url.includes('/compare')) {
      this.currentSectionTitle.set('Compare');
    } else if (url.includes('/settings')) {
      this.currentSectionTitle.set('Settings');
    } else if (url.includes('/projects')) {
      this.currentSectionTitle.set('Projects');
    } else {
      this.currentSectionTitle.set('Overview');
    }
  }

  private checkHealth(): void {
    this.healthService.getHealth().subscribe({
      next: (res: { status: string }) => {
        this.backendStatus.set(res.status === 'ok' ? 'ok' : 'error');
      },
      error: () => {
        this.backendStatus.set('error');
      },
    });
  }

  focusSearch(): void {
    const searchInput = document.getElementById('dashboard-runs-search') as HTMLInputElement | null;
    if (searchInput) {
      searchInput.focus();
      searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}
