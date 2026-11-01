import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HealthService, HealthStatus, DetailedHealthStatus } from '../../core/services/health.service';

@Component({
  selector: 'app-health',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="health-page">
      <div class="page-header">
        <div>
          <h1>System Diagnostics & Health</h1>
          <p class="subtitle">Real-time status of backend services and database connectivity</p>
        </div>
        <button (click)="runCheck()" class="btn refresh-btn" [disabled]="loading()">
          @if (loading()) {
            <span class="spinner"></span> Checking...
          } @else {
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            Run Diagnostic Ping
          }
        </button>
      </div>

      <div class="grid">
        <!-- Basic Health Endpoint Card -->
        <div class="card">
          <div class="card-header">
            <div class="endpoint-meta">
              <span class="badge get">GET</span>
              <span class="path">/api/health</span>
            </div>
            <span class="status-pill" [class.ok]="basicHealth()?.status === 'ok'" [class.err]="basicHealth()?.status !== 'ok'">
              {{ basicHealth()?.status || 'UNKNOWN' }}
            </span>
          </div>

          <p class="card-desc">Standard liveness endpoint required for container orchestration and uptime monitoring.</p>

          <div class="response-box">
            <span class="box-label">Response Payload</span>
            <pre><code>{{ basicHealth() ? (basicHealth() | json) : 'No data yet...' }}</code></pre>
          </div>
        </div>

        <!-- Detailed Database Health Endpoint Card -->
        <div class="card">
          <div class="card-header">
            <div class="endpoint-meta">
              <span class="badge get">GET</span>
              <span class="path">/api/health/details</span>
            </div>
            <span
              class="status-pill"
              [class.ok]="detailedHealth()?.database?.connected"
              [class.warn]="detailedHealth() && !detailedHealth()?.database?.connected"
            >
              {{ detailedHealth()?.database?.connected ? 'CONNECTED' : 'DISCONNECTED' }}
            </span>
          </div>

          <p class="card-desc">Deep inspection endpoint checking MongoDB connection pool and query ping command.</p>

          <div class="response-box">
            <span class="box-label">Response Payload</span>
            <pre><code>{{ detailedHealth() ? (detailedHealth() | json) : 'No data yet...' }}</code></pre>
          </div>
        </div>
      </div>

      @if (lastChecked()) {
        <div class="last-checked">
          Last verified at: {{ lastChecked() | date:'mediumTime' }}
        </div>
      }
    </div>
  `,
  styles: [`
    .health-page {
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
      margin: 0 0 0.35rem 0;
      font-size: 1.6rem;
      font-weight: 700;
      color: #f8fafc;
    }

    .subtitle {
      margin: 0;
      color: #94a3b8;
      font-size: 0.9rem;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: #3b82f6;
      color: white;
      border: none;
      padding: 0.65rem 1.25rem;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
      transition: background 0.15s ease;
    }

    .btn:hover:not(:disabled) {
      background: #2563eb;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 0.8s linear infinite;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: 1.5rem;
    }

    .card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }

    .endpoint-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .badge.get {
      background: #1e3a5f;
      color: #38bdf8;
      font-weight: 700;
      font-size: 0.75rem;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
    }

    .path {
      font-family: monospace;
      font-size: 0.95rem;
      font-weight: 600;
      color: #f1f5f9;
    }

    .card-desc {
      color: #94a3b8;
      font-size: 0.85rem;
      margin: 0 0 1rem 0;
      line-height: 1.4;
    }

    .status-pill {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 9999px;
      letter-spacing: 0.05em;
    }

    .status-pill.ok {
      background: rgba(34, 197, 94, 0.15);
      color: #4ade80;
      border: 1px solid rgba(34, 197, 94, 0.3);
    }

    .status-pill.warn {
      background: rgba(234, 179, 8, 0.15);
      color: #facc15;
      border: 1px solid rgba(234, 179, 8, 0.3);
    }

    .status-pill.err {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .response-box {
      margin-top: auto;
      background: #070d17;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 1rem;
    }

    .box-label {
      display: block;
      font-size: 0.7rem;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }

    pre {
      margin: 0;
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 0.85rem;
      color: #38bdf8;
      overflow-x: auto;
    }

    .last-checked {
      font-size: 0.8rem;
      color: #64748b;
      text-align: right;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `],
})
export class HealthComponent implements OnInit {
  private readonly healthService = inject(HealthService);

  loading = signal<boolean>(false);
  basicHealth = signal<HealthStatus | null>(null);
  detailedHealth = signal<DetailedHealthStatus | null>(null);
  lastChecked = signal<Date | null>(null);

  ngOnInit(): void {
    this.runCheck();
  }

  runCheck(): void {
    this.loading.set(true);

    this.healthService.getHealth().subscribe({
      next: (res) => {
        this.basicHealth.set(res);
      },
      error: (err) => {
        this.basicHealth.set({ status: 'error' });
      },
      complete: () => {
        this.loading.set(false);
        this.lastChecked.set(new Date());
      },
    });

    this.healthService.getDetailedHealth().subscribe({
      next: (res) => {
        this.detailedHealth.set(res);
      },
      error: () => {
        this.detailedHealth.set({
          status: 'error',
          database: {
            status: 'unreachable',
            connected: false,
            error: 'Backend API is currently offline',
          },
        });
      },
    });
  }
}

