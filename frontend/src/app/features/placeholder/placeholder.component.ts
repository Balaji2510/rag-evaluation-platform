import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-placeholder',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="placeholder-container">
      <div class="placeholder-card">
        <div class="icon-bubble">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
          </svg>
        </div>
        <h2>{{ title }}</h2>
        <p class="desc">{{ description }}</p>
        <div class="phase-badge">Scheduled for Phase 2</div>
        <div class="actions">
          <a routerLink="/dashboard" class="btn secondary">Back to Dashboard</a>
          <a routerLink="/health" class="btn primary">View System Health</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .placeholder-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 60vh;
    }

    .placeholder-card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 16px;
      padding: 3rem 2rem;
      text-align: center;
      max-width: 500px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    .icon-bubble {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.2);
      color: #60a5fa;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 0.5rem;
    }

    h2 {
      margin: 0;
      color: #f8fafc;
      font-size: 1.5rem;
    }

    .desc {
      margin: 0;
      color: #94a3b8;
      font-size: 0.95rem;
      line-height: 1.5;
    }

    .phase-badge {
      background: #1e293b;
      border: 1px solid #334155;
      color: #cbd5e1;
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
    }

    .actions {
      display: flex;
      gap: 1rem;
      margin-top: 1rem;
    }

    .btn {
      padding: 0.6rem 1.2rem;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.15s ease;
    }

    .btn.primary {
      background: #3b82f6;
      color: white;
    }

    .btn.primary:hover {
      background: #2563eb;
    }

    .btn.secondary {
      background: #1e293b;
      color: #cbd5e1;
      border: 1px solid #334155;
    }

    .btn.secondary:hover {
      background: #334155;
      color: white;
    }
  `],
})
export class PlaceholderComponent {
  @Input() title = 'Feature';
  @Input() description = 'This module will be implemented in subsequent phases.';
}

