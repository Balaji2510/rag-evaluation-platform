import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { HealthComponent } from './features/health/health.component';
import { PlaceholderComponent } from './features/placeholder/placeholder.component';
import { ProjectListComponent } from './features/projects/project-list/project-list.component';
import { ProjectCreateComponent } from './features/projects/project-create/project-create.component';
import { ProjectDetailComponent } from './features/projects/project-detail/project-detail.component';
import { ProjectCompareComponent } from './features/projects/project-compare/project-compare.component';
import { DatasetDetailComponent } from './features/datasets/dataset-detail/dataset-detail.component';
import { RAGConfigurationComponent } from './features/rag-configurations/rag-configuration.component';
import { EvaluationComponent } from './features/evaluations/evaluation.component';
import { EvaluationDetailComponent } from './features/evaluations/evaluation-detail/evaluation-detail.component';
import { ResultDetailComponent } from './features/evaluations/result-detail/result-detail.component';
import { SettingsComponent } from './features/settings/settings.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [guestGuard],
    title: 'Sign In | RAG Evaluation Platform',
  },
  {
    path: 'register',
    component: RegisterComponent,
    canActivate: [guestGuard],
    title: 'Create Account | RAG Evaluation Platform',
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard],
    title: 'Dashboard | RAG Evaluation Platform',
  },
  {
    path: 'projects',
    component: ProjectListComponent,
    canActivate: [authGuard],
    title: 'Projects | RAG Evaluation Platform',
  },
  {
    path: 'projects/new',
    component: ProjectCreateComponent,
    canActivate: [authGuard],
    title: 'New Project | RAG Evaluation Platform',
  },
  {
    path: 'projects/:id',
    component: ProjectDetailComponent,
    canActivate: [authGuard],
    title: 'Project Details | RAG Evaluation Platform',
  },
  {
    path: 'projects/:id/datasets',
    component: ProjectDetailComponent,
    canActivate: [authGuard],
    title: 'Project Datasets | RAG Evaluation Platform',
  },
  {
    path: 'projects/:id/compare',
    component: ProjectCompareComponent,
    canActivate: [authGuard],
    title: 'Evaluation Run Comparison | RAG Evaluation Platform',
  },
  {
    path: 'datasets/:id',
    component: DatasetDetailComponent,
    canActivate: [authGuard],
    title: 'Dataset Editor | RAG Evaluation Platform',
  },
  {
    path: 'configurations',
    component: RAGConfigurationComponent,
    canActivate: [authGuard],
    title: 'RAG Endpoints & Configurations | RAG Evaluation Platform',
  },
  {
    path: 'health',
    component: HealthComponent,
    canActivate: [authGuard],
    title: 'System Health | RAG Evaluation Platform',
  },
  {
    path: 'experiments',
    component: PlaceholderComponent,
    canActivate: [authGuard],
    data: {
      title: 'RAG Experiments',
      description: 'Configure and run retrieval, chunking, and generation experiment runs.',
    },
    title: 'Experiments | RAG Evaluation Platform',
  },
  {
    path: 'evaluations',
    component: EvaluationComponent,
    canActivate: [authGuard],
    title: 'Evaluations & Benchmark Runs | RAG Evaluation Platform',
  },
  {
    path: 'evaluations/:id',
    component: EvaluationDetailComponent,
    canActivate: [authGuard],
    title: 'Evaluation Overview | RAG Evaluation Platform',
  },
  {
    path: 'evaluations/:id/results/:resultId',
    component: ResultDetailComponent,
    canActivate: [authGuard],
    title: 'Question Evaluation Inspection | RAG Evaluation Platform',
  },
  {
    path: 'settings',
    component: SettingsComponent,
    canActivate: [authGuard],
    title: 'Settings & API Keys | RAG Evaluation Platform',
  },
  {
    path: 'api-keys',
    redirectTo: 'settings?tab=api-keys',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
