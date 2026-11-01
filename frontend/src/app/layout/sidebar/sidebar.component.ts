import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { WorkspaceService } from '../../core/services/workspace.service';
import { Project } from '../../core/models/project.model';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <aside class="sidebar" [class.collapsed]="workspace.isSidebarCollapsed()">
      <!-- Header: Logo & Product Name -->
      <div class="sidebar-header">
        <a routerLink="/dashboard" class="brand-container">
          <div class="brand-logo" title="RAG Evaluation Platform">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
              <polyline points="2 17 12 22 22 17"></polyline>
              <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
          </div>
          @if (!workspace.isSidebarCollapsed()) {
            <div class="brand-meta">
              <span class="brand-name">RAG Eval</span>
              <span class="brand-tagline">Postman for RAG</span>
            </div>
          }
        </a>

        <button
          type="button"
          class="btn-collapse"
          (click)="workspace.toggleSidebar()"
          [title]="workspace.isSidebarCollapsed() ? 'Expand sidebar (Ctrl+[)' : 'Collapse sidebar'"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            @if (workspace.isSidebarCollapsed()) {
              <polyline points="9 18 15 12 9 6"></polyline>
            } @else {
              <polyline points="15 18 9 12 15 6"></polyline>
            }
          </svg>
        </button>
      </div>

      <!-- Workspace: Project Selector -->
      @if (!workspace.isSidebarCollapsed()) {
        <div class="workspace-section">
          <div class="workspace-label-row">
            <span class="workspace-label">WORKSPACE / PROJECT</span>
            <a routerLink="/projects/new" class="btn-new-proj" title="Create new project">+</a>
          </div>
          
          <div class="project-selector-dropdown">
            <button
              type="button"
              class="project-select-btn"
              (click)="toggleProjectDropdown()"
              [attr.aria-expanded]="isProjectMenuOpen()"
            >
              <div class="project-pill-icon">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
              </div>
              <span class="project-select-title">
                {{ workspace.currentProject()?.name || 'Select Project...' }}
              </span>
              <svg class="chevron-icon" [class.rotated]="isProjectMenuOpen()" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>

            @if (isProjectMenuOpen()) {
              <div class="project-menu-popup">
                <div class="menu-header">Switch Project</div>
                <div class="project-menu-list">
                  @for (p of workspace.projects(); track p.id) {
                    <button
                      type="button"
                      class="project-menu-item"
                      [class.active]="workspace.currentProject()?.id === p.id"
                      (click)="selectProject(p)"
                    >
                      <span class="item-name">{{ p.name }}</span>
                      @if (workspace.currentProject()?.id === p.id) {
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      }
                    </button>
                  }
                  @if (workspace.projects().length === 0) {
                    <div class="no-projects">No projects found</div>
                  }
                </div>
                <div class="menu-footer">
                  <a routerLink="/projects/new" (click)="isProjectMenuOpen.set(false)" class="menu-action-link">
                    + New Project
                  </a>
                  <a routerLink="/projects" (click)="isProjectMenuOpen.set(false)" class="menu-action-link">
                    View All
                  </a>
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- Main Navigation Menu -->
      <div class="nav-container">
        <!-- Navigation Section -->
        <div class="nav-group">
          @if (!workspace.isSidebarCollapsed()) {
            <span class="nav-group-title">NAVIGATION</span>
          }
          <nav class="nav-list">
            <a
              routerLink="/dashboard"
              routerLinkActive="active"
              class="nav-link"
              [routerLinkActiveOptions]="{ exact: true }"
              [title]="workspace.isSidebarCollapsed() ? 'Overview' : ''"
            >
              <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
              @if (!workspace.isSidebarCollapsed()) {
                <span class="nav-label">Overview</span>
              }
            </a>

            <a
              routerLink="/projects"
              routerLinkActive="active"
              class="nav-link"
              [routerLinkActiveOptions]="{ exact: true }"
              [title]="workspace.isSidebarCollapsed() ? 'Projects' : ''"
            >
              <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
              @if (!workspace.isSidebarCollapsed()) {
                <span class="nav-label">Projects</span>
              }
            </a>

            <a
              [routerLink]="getDatasetsRoute()"
              routerLinkActive="active"
              class="nav-link"
              [title]="workspace.isSidebarCollapsed() ? 'Datasets' : ''"
            >
              <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
              </svg>
              @if (!workspace.isSidebarCollapsed()) {
                <span class="nav-label">Datasets</span>
              }
            </a>

            <a
              routerLink="/evaluations"
              routerLinkActive="active"
              class="nav-link"
              [routerLinkActiveOptions]="{ exact: true }"
              [title]="workspace.isSidebarCollapsed() ? 'Evaluations' : ''"
            >
              <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
              @if (!workspace.isSidebarCollapsed()) {
                <span class="nav-label">Evaluations</span>
                <span class="nav-badge pulse">Live</span>
              }
            </a>

            <a
              routerLink="/configurations"
              routerLinkActive="active"
              class="nav-link"
              [routerLinkActiveOptions]="{ exact: true }"
              [title]="workspace.isSidebarCollapsed() ? 'RAG Configurations' : ''"
            >
              <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
              @if (!workspace.isSidebarCollapsed()) {
                <span class="nav-label">RAG Configs</span>
              }
            </a>

            <a
              routerLink="/evaluations"
              routerLinkActive="active"
              class="nav-link"
              [title]="workspace.isSidebarCollapsed() ? 'Runs' : ''"
            >
              <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              @if (!workspace.isSidebarCollapsed()) {
                <span class="nav-label">Runs</span>
              }
            </a>

            <a
              [routerLink]="getCompareRoute()"
              routerLinkActive="active"
              class="nav-link"
              [title]="workspace.isSidebarCollapsed() ? 'Compare Runs' : ''"
            >
              <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
              @if (!workspace.isSidebarCollapsed()) {
                <span class="nav-label">Compare</span>
              }
            </a>
          </nav>
        </div>

        <!-- Advanced / Internal RAG -->
        <div class="nav-group">
          @if (!workspace.isSidebarCollapsed()) {
            <span class="nav-group-title">INTERNAL RAG & VECTORS</span>
          }
          <nav class="nav-list">
            <a
              [routerLink]="getInternalRAGRoute()"
              routerLinkActive="active"
              class="nav-link"
              [title]="workspace.isSidebarCollapsed() ? 'Internal RAG' : ''"
            >
              <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              </svg>
              @if (!workspace.isSidebarCollapsed()) {
                <span class="nav-label">Internal RAG</span>
                <span class="nav-badge subtle">Atlas</span>
              }
            </a>

            <a
              [routerLink]="getDocumentsRoute()"
              routerLinkActive="active"
              class="nav-link"
              [title]="workspace.isSidebarCollapsed() ? 'Documents' : ''"
            >
              <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
              @if (!workspace.isSidebarCollapsed()) {
                <span class="nav-label">Documents</span>
              }
            </a>

            <a
              [routerLink]="getVectorSearchRoute()"
              routerLinkActive="active"
              class="nav-link"
              [title]="workspace.isSidebarCollapsed() ? 'Vector Search' : ''"
            >
              <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              @if (!workspace.isSidebarCollapsed()) {
                <span class="nav-label">Vector Search</span>
              }
            </a>
          </nav>
        </div>
      </div>

      <!-- Bottom: Settings, API Keys, User Profile -->
      <div class="sidebar-footer">
        <nav class="footer-nav">
          <a
            routerLink="/settings"
            routerLinkActive="active"
            class="nav-link"
            [title]="workspace.isSidebarCollapsed() ? 'Settings' : ''"
          >
            <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            @if (!workspace.isSidebarCollapsed()) {
              <span class="nav-label">Settings</span>
            }
          </a>

          <a
            routerLink="/settings"
            [queryParams]="{ tab: 'api-keys' }"
            routerLinkActive="active"
            class="nav-link"
            [title]="workspace.isSidebarCollapsed() ? 'API Keys' : ''"
          >
            <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 2l-2 2m-1-1l-3 3m-1-1l-2 2m-1-1l-3 3"></path>
              <circle cx="7.5" cy="16.5" r="4.5"></circle>
            </svg>
            @if (!workspace.isSidebarCollapsed()) {
              <span class="nav-label">API Keys</span>
            }
          </a>
        </nav>

        @if (authService.currentUser(); as user) {
          <div class="user-profile-widget" [class.compact]="workspace.isSidebarCollapsed()">
            <div class="user-avatar" [title]="user.email">
              {{ (user.name || user.email || 'U').charAt(0).toUpperCase() }}
            </div>
            @if (!workspace.isSidebarCollapsed()) {
              <div class="user-text">
                <span class="user-name">{{ user.name }}</span>
                <span class="user-email">{{ user.email }}</span>
              </div>
              <button
                type="button"
                (click)="authService.logout()"
                class="btn-logout-icon"
                title="Sign out"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </button>
            }
          </div>
        }
      </div>
    </aside>
  `,
  styles: [`
    .sidebar {
      width: 250px;
      background: #090d16;
      border-right: 1px solid #1a2333;
      height: calc(100vh - 56px);
      display: flex;
      flex-direction: column;
      padding: 0.85rem 0.65rem;
      box-sizing: border-box;
      flex-shrink: 0;
      transition: width 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
      user-select: none;
    }

    .sidebar.collapsed {
      width: 64px;
      padding: 0.85rem 0.4rem;
    }

    /* Header */
    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.25rem 0.4rem 0.85rem;
      border-bottom: 1px solid #141c2c;
      margin-bottom: 0.75rem;
    }

    .brand-container {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      text-decoration: none;
      color: #f1f5f9;
      min-width: 0;
    }

    .brand-logo {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      background: #182234;
      border: 1px solid #28374f;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #38bdf8;
      flex-shrink: 0;
    }

    .brand-meta {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .brand-name {
      font-size: 0.875rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #f8fafc;
      line-height: 1.15;
    }

    .brand-tagline {
      font-size: 0.65rem;
      font-weight: 500;
      color: #38bdf8;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .btn-collapse {
      background: transparent;
      border: 1px solid transparent;
      color: #64748b;
      border-radius: 5px;
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-collapse:hover {
      background: #162032;
      color: #94a3b8;
      border-color: #223049;
    }

    /* Workspace Section */
    .workspace-section {
      margin-bottom: 0.85rem;
      padding: 0 0.35rem;
      position: relative;
    }

    .workspace-label-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.35rem;
    }

    .workspace-label {
      font-size: 0.65rem;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.06em;
    }

    .btn-new-proj {
      font-size: 0.85rem;
      line-height: 1;
      color: #94a3b8;
      text-decoration: none;
      padding: 1px 5px;
      border-radius: 3px;
      background: #141c2c;
    }

    .btn-new-proj:hover {
      color: #38bdf8;
      background: #1e293b;
    }

    .project-selector-dropdown {
      position: relative;
    }

    .project-select-btn {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: #111827;
      border: 1px solid #1f293d;
      border-radius: 6px;
      padding: 0.45rem 0.55rem;
      color: #f1f5f9;
      font-size: 0.8125rem;
      font-weight: 500;
      cursor: pointer;
      text-align: left;
      transition: all 0.15s ease;
    }

    .project-select-btn:hover {
      background: #172236;
      border-color: #2b3b55;
    }

    .project-pill-icon {
      color: #38bdf8;
      display: flex;
      align-items: center;
    }

    .project-select-title {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .chevron-icon {
      color: #64748b;
      transition: transform 0.2s ease;
    }

    .chevron-icon.rotated {
      transform: rotate(180deg);
    }

    .project-menu-popup {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 6px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6);
      z-index: 100;
      overflow: hidden;
    }

    .menu-header {
      font-size: 0.7rem;
      font-weight: 600;
      color: #64748b;
      padding: 0.5rem 0.65rem 0.35rem;
      border-bottom: 1px solid #1e293b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .project-menu-list {
      max-height: 180px;
      overflow-y: auto;
      padding: 0.25rem 0;
    }

    .project-menu-item {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: transparent;
      border: none;
      padding: 0.45rem 0.65rem;
      color: #cbd5e1;
      font-size: 0.8125rem;
      cursor: pointer;
      text-align: left;
    }

    .project-menu-item:hover {
      background: #1e293b;
      color: #f8fafc;
    }

    .project-menu-item.active {
      color: #38bdf8;
      font-weight: 600;
      background: rgba(56, 189, 248, 0.08);
    }

    .no-projects {
      padding: 0.75rem 0.65rem;
      font-size: 0.8rem;
      color: #64748b;
      text-align: center;
    }

    .menu-footer {
      display: flex;
      justify-content: space-between;
      padding: 0.4rem 0.65rem;
      background: #0a101f;
      border-top: 1px solid #1e293b;
      font-size: 0.75rem;
    }

    .menu-action-link {
      color: #38bdf8;
      text-decoration: none;
    }

    .menu-action-link:hover {
      text-decoration: underline;
    }

    /* Navigation Container */
    .nav-container {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 1.15rem;
    }

    .nav-group-title {
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.07em;
      color: #556987;
      padding: 0 0.55rem;
      margin-bottom: 0.35rem;
      display: block;
    }

    .nav-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      padding: 0.48rem 0.6rem;
      border-radius: 5px;
      color: #94a3b8;
      text-decoration: none;
      font-size: 0.8125rem;
      font-weight: 500;
      transition: all 0.12s ease;
      position: relative;
    }

    .sidebar.collapsed .nav-link {
      justify-content: center;
      padding: 0.55rem 0;
    }

    .nav-link:hover {
      background: #141c2c;
      color: #f1f5f9;
    }

    .nav-link.active {
      background: #132238;
      color: #38bdf8;
      font-weight: 600;
    }

    .nav-link.active::before {
      content: '';
      position: absolute;
      left: 0;
      top: 20%;
      height: 60%;
      width: 2.5px;
      background: #38bdf8;
      border-radius: 0 2px 2px 0;
    }

    .nav-icon {
      color: currentColor;
      flex-shrink: 0;
    }

    .nav-label {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .nav-badge {
      font-size: 0.625rem;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 4px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .nav-badge.pulse {
      background: rgba(16, 185, 129, 0.15);
      color: #10b981;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .nav-badge.subtle {
      background: rgba(148, 163, 184, 0.12);
      color: #94a3b8;
    }

    /* Footer */
    .sidebar-footer {
      border-top: 1px solid #141c2c;
      padding-top: 0.65rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .footer-nav {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .user-profile-widget {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.4rem 0.5rem;
      border-radius: 6px;
      background: #0f1626;
      border: 1px solid #182236;
      margin-top: 0.25rem;
    }

    .user-profile-widget.compact {
      justify-content: center;
      padding: 0.35rem 0;
    }

    .user-avatar {
      width: 26px;
      height: 26px;
      border-radius: 5px;
      background: linear-gradient(135deg, #0284c7, #2563eb);
      color: #ffffff;
      font-size: 0.75rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .user-text {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .user-name {
      font-size: 0.75rem;
      font-weight: 600;
      color: #e2e8f0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.2;
    }

    .user-email {
      font-size: 0.65rem;
      color: #64748b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-family: monospace;
    }

    .btn-logout-icon {
      background: transparent;
      border: none;
      color: #64748b;
      padding: 3px;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.15s ease;
    }

    .btn-logout-icon:hover {
      color: #ef4444;
    }
  `],
})
export class SidebarComponent implements OnInit {
  readonly authService = inject(AuthService);
  readonly workspace = inject(WorkspaceService);
  private readonly router = inject(Router);

  readonly isProjectMenuOpen = signal<boolean>(false);

  ngOnInit(): void {
    this.workspace.loadProjects();
  }

  toggleProjectDropdown(): void {
    this.isProjectMenuOpen.update((v) => !v);
  }

  selectProject(project: Project): void {
    this.workspace.setCurrentProject(project);
    this.isProjectMenuOpen.set(false);
  }

  getDatasetsRoute(): string {
    const proj = this.workspace.currentProject();
    return proj ? `/projects/${proj.id}/datasets` : '/projects';
  }

  getCompareRoute(): string {
    const proj = this.workspace.currentProject();
    return proj ? `/projects/${proj.id}/compare` : '/projects';
  }

  getInternalRAGRoute(): string {
    const proj = this.workspace.currentProject();
    return proj ? `/projects/${proj.id}` : '/projects';
  }

  getDocumentsRoute(): string {
    const proj = this.workspace.currentProject();
    return proj ? `/projects/${proj.id}` : '/projects';
  }

  getVectorSearchRoute(): string {
    const proj = this.workspace.currentProject();
    return proj ? `/projects/${proj.id}` : '/projects';
  }

  getApiKeysRoute(): string {
    const proj = this.workspace.currentProject();
    return proj ? `/projects/${proj.id}` : '/settings';
  }
}
