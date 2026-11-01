import { Injectable, inject, signal } from '@angular/core';
import { ProjectService } from './project.service';
import { Project } from '../models/project.model';

@Injectable({
  providedIn: 'root',
})
export class WorkspaceService {
  private readonly projectService = inject(ProjectService);

  readonly projects = signal<Project[]>([]);
  readonly currentProject = signal<Project | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly isSidebarCollapsed = signal<boolean>(false);

  toggleSidebar(): void {
    this.isSidebarCollapsed.update((v) => !v);
  }

  setSidebarCollapsed(collapsed: boolean): void {
    this.isSidebarCollapsed.set(collapsed);
  }

  loadProjects(): void {
    this.isLoading.set(true);
    this.projectService.listProjects().subscribe({
      next: (list) => {
        this.projects.set(list);
        this.isLoading.set(false);
        const savedId =
          window.sessionStorage?.getItem('rag_eval_active_project_id') ||
          window.localStorage?.getItem('rag_eval_active_project_id');
        if (savedId) {
          const match = list.find((p) => p.id === savedId);
          if (match) {
            this.currentProject.set(match);
            window.sessionStorage?.setItem('rag_eval_active_project_id', match.id);
            return;
          }
        }
        if (list.length > 0 && !this.currentProject()) {
          this.currentProject.set(list[0]);
          window.sessionStorage?.setItem('rag_eval_active_project_id', list[0].id);
          window.localStorage?.setItem('rag_eval_active_project_id', list[0].id);
        }
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  setCurrentProject(project: Project): void {
    this.currentProject.set(project);
    window.sessionStorage?.setItem('rag_eval_active_project_id', project.id);
    window.localStorage?.setItem('rag_eval_active_project_id', project.id);
  }
}

