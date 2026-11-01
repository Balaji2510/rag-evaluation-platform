import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

const TOKEN_KEY = 'rag_eval_token';
const USER_KEY = 'rag_eval_user';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly apiUrl = environment.apiUrl;

  private readonly _currentUser = signal<User | null>(this.getStoredUser());
  private readonly _token = signal<string | null>(this.getStoredToken());

  readonly currentUser = this._currentUser.asReadonly();
  readonly token = this._token.asReadonly();
  readonly isAuthenticated = computed(() => !!this._currentUser() && !!this._token());

  constructor() {
    // If a token exists on startup, refresh user profile in background
    if (this._token()) {
      this.fetchCurrentUser().subscribe({
        error: (err: any) => {
          // Only clear session if token is explicitly invalid or rejected by backend (401)
          if (err?.status === 401) {
            this.clearSession();
          }
        },
      });
    }
  }

  register(payload: RegisterPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/register`, payload).pipe(
      tap((res) => this.handleAuthSuccess(res))
    );
  }

  login(payload: LoginPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/login`, payload).pipe(
      tap((res) => this.handleAuthSuccess(res))
    );
  }

  fetchCurrentUser(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/auth/me`).pipe(
      tap((user) => {
        this._currentUser.set(user);
        this.storeUser(user);
      })
    );
  }

  logout(): void {
    this.clearSession();
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return this._token();
  }

  private handleAuthSuccess(response: AuthResponse): void {
    this._token.set(response.access_token);
    this._currentUser.set(response.user);
    this.storeToken(response.access_token);
    this.storeUser(response.user);
  }

  private clearSession(): void {
    this._token.set(null);
    this._currentUser.set(null);
    if (typeof window !== 'undefined') {
      window.sessionStorage?.removeItem(TOKEN_KEY);
      window.sessionStorage?.removeItem(USER_KEY);
      window.localStorage?.removeItem(TOKEN_KEY);
      window.localStorage?.removeItem(USER_KEY);
    }
  }

  private getStoredToken(): string | null {
    if (typeof window !== 'undefined') {
      // 1. Prioritize session storage
      const sessionToken = window.sessionStorage?.getItem(TOKEN_KEY);
      if (sessionToken) {
        return sessionToken;
      }
      // 2. Fall back to local storage and sync to session storage
      const localToken = window.localStorage?.getItem(TOKEN_KEY);
      if (localToken) {
        window.sessionStorage?.setItem(TOKEN_KEY, localToken);
        return localToken;
      }
    }
    return null;
  }

  private storeToken(token: string): void {
    if (typeof window !== 'undefined') {
      window.sessionStorage?.setItem(TOKEN_KEY, token);
      window.localStorage?.setItem(TOKEN_KEY, token);
    }
  }

  private getStoredUser(): User | null {
    if (typeof window !== 'undefined') {
      // 1. Prioritize session storage
      const rawSession = window.sessionStorage?.getItem(USER_KEY);
      if (rawSession) {
        try {
          return JSON.parse(rawSession);
        } catch {}
      }
      // 2. Fall back to local storage and sync to session storage
      const rawLocal = window.localStorage?.getItem(USER_KEY);
      if (rawLocal) {
        try {
          const user = JSON.parse(rawLocal);
          window.sessionStorage?.setItem(USER_KEY, rawLocal);
          return user;
        } catch {}
      }
    }
    return null;
  }

  private storeUser(user: User): void {
    if (typeof window !== 'undefined') {
      const serialized = JSON.stringify(user);
      window.sessionStorage?.setItem(USER_KEY, serialized);
      window.localStorage?.setItem(USER_KEY, serialized);
    }
  }
}
