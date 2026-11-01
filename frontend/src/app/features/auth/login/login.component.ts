import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="auth-wrapper">
      <div class="auth-card">
        <div class="auth-header">
          <div class="brand-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h1>Sign In</h1>
          <p class="subtitle">Access your RAG Evaluation Platform workspace</p>
        </div>

        @if (errorMessage()) {
          <div class="alert-error">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{{ errorMessage() }}</span>
          </div>
        }

        <form (ngSubmit)="onSubmit()" #loginForm="ngForm" class="auth-form" novalidate>
          <div class="form-group">
            <label for="email">Work Email</label>
            <input
              id="email"
              name="email"
              type="email"
              [(ngModel)]="email"
              #emailField="ngModel"
              required
              email
              placeholder="developer@company.com"
              [class.input-error]="loginForm.submitted && emailField.invalid"
            />
            @if (loginForm.submitted && emailField.errors?.['required']) {
              <span class="field-error">Email address is required.</span>
            } @else if (loginForm.submitted && emailField.errors?.['email']) {
              <span class="field-error">Please enter a valid email address.</span>
            }
          </div>

          <div class="form-group">
            <div class="label-row">
              <label for="password">Password</label>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              [(ngModel)]="password"
              #passwordField="ngModel"
              required
              placeholder="••••••••"
              [class.input-error]="loginForm.submitted && passwordField.invalid"
            />
            @if (loginForm.submitted && passwordField.errors?.['required']) {
              <span class="field-error">Password is required.</span>
            }
          </div>

          <button type="submit" class="btn-submit" [disabled]="loading()">
            @if (loading()) {
              <span class="spinner"></span> Signing In...
            } @else {
              Sign In to Platform
            }
          </button>
        </form>

        <div class="auth-footer">
          <span>Don't have an account?</span>
          <a routerLink="/register">Create an account</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-wrapper {
      min-height: calc(100vh - 64px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
      background: radial-gradient(circle at top, #1e293b 0%, #020617 70%);
      box-sizing: border-box;
    }

    .auth-card {
      width: 100%;
      max-width: 440px;
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 16px;
      padding: 2.5rem 2rem;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    }

    .auth-header {
      text-align: center;
      margin-bottom: 2rem;
    }

    .brand-icon {
      width: 48px;
      height: 48px;
      margin: 0 auto 1rem auto;
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    }

    h1 {
      margin: 0 0 0.5rem 0;
      font-size: 1.6rem;
      font-weight: 700;
      color: #f8fafc;
      letter-spacing: -0.02em;
    }

    .subtitle {
      margin: 0;
      color: #94a3b8;
      font-size: 0.875rem;
    }

    .alert-error {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-size: 0.85rem;
      margin-bottom: 1.5rem;
    }

    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .label-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    label {
      font-size: 0.8rem;
      font-weight: 600;
      color: #cbd5e1;
    }

    input {
      background: #020617;
      border: 1px solid #334155;
      color: #f8fafc;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-size: 0.9rem;
      outline: none;
      transition: all 0.15s ease;
    }

    input:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
    }

    input.input-error {
      border-color: #ef4444;
    }

    .field-error {
      font-size: 0.75rem;
      color: #f87171;
      margin-top: 0.15rem;
    }

    .btn-submit {
      margin-top: 0.5rem;
      background: #3b82f6;
      color: white;
      border: none;
      padding: 0.8rem;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: background 0.15s ease;
    }

    .btn-submit:hover:not(:disabled) {
      background: #2563eb;
    }

    .btn-submit:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 0.8s linear infinite;
    }

    .auth-footer {
      margin-top: 1.75rem;
      text-align: center;
      font-size: 0.85rem;
      color: #94a3b8;
      display: flex;
      justify-content: center;
      gap: 0.35rem;
    }

    .auth-footer a {
      color: #60a5fa;
      text-decoration: none;
      font-weight: 600;
    }

    .auth-footer a:hover {
      text-decoration: underline;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `],
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  email = '';
  password = '';
  loading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  onSubmit(): void {
    if (!this.email || !this.password) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.authService
      .login({
        email: this.email,
        password: this.password,
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
          const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
          this.router.navigateByUrl(returnUrl);
        },
        error: (err) => {
          this.loading.set(false);
          if (err.status === 401) {
            this.errorMessage.set('Invalid email or password.');
          } else if (err.error?.error?.message) {
            this.errorMessage.set(err.error.error.message);
          } else {
            this.errorMessage.set('Could not sign in. Please verify your connection and try again.');
          }
        },
      });
  }
}
