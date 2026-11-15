import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { AuthProvider } from './features/auth/AuthContext';
import {
  GuestOnly,
  RequireAuth,
  RequireRole,
} from './features/auth/components/RouteGuards';
import { ChangePasswordPage } from './features/auth/pages/ChangePasswordPage';
import { LoginPage } from './features/auth/pages/LoginPage';
import { CatalogPage } from './features/catalog/pages/CatalogPage';
import { ExamDetailPage } from './features/exams/pages/ExamDetailPage';
import { ExamsPage } from './features/exams/pages/ExamsPage';
import { QuestionBankPage } from './features/questions/pages/QuestionBankPage';
import { QuestionEditorPage } from './features/questions/pages/QuestionEditorPage';
import { StudentExamSessionPage } from './features/student-exams/pages/StudentExamSessionPage';
import { StudentExamsPage } from './features/student-exams/pages/StudentExamsPage';
import { StudentResultDetailPage } from './features/results/pages/StudentResultDetailPage';
import { StudentResultsPage } from './features/results/pages/StudentResultsPage';
import { AuditLogsPage } from './features/audit-logs/pages/AuditLogsPage';
import { QuestionTypesPage } from './features/question-types/pages/QuestionTypesPage';
import { UsersManagementPage } from './features/users/pages/UsersManagementPage';
import { ForbiddenPage } from './pages/ForbiddenPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ThemeProvider } from './features/theme/ThemeContext';

function LegacyBankRedirect() {
  const { search, hash } = useLocation();
  return <Navigate to={`/questions${search}${hash}`} replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        }
      />

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="bank" element={<LegacyBankRedirect />} />
          <Route
            path="catalog"
            element={
              <RequireRole allowedRoles={['ADMIN', 'TEACHER']}>
                <CatalogPage />
              </RequireRole>
            }
          />
          <Route
            path="questions"
            element={
              <RequireRole allowedRoles={['ADMIN', 'TEACHER']}>
                <QuestionBankPage />
              </RequireRole>
            }
          />
          <Route
            path="questions/new"
            element={
              <RequireRole allowedRoles={['ADMIN', 'TEACHER']}>
                <QuestionEditorPage />
              </RequireRole>
            }
          />
          <Route
            path="questions/:questionId/edit"
            element={
              <RequireRole allowedRoles={['ADMIN', 'TEACHER']}>
                <QuestionEditorPage />
              </RequireRole>
            }
          />
          <Route
            path="exams"
            element={
              <RequireRole allowedRoles={['ADMIN', 'TEACHER']}>
                <ExamsPage />
              </RequireRole>
            }
          />
          <Route
            path="exams/:examId"
            element={
              <RequireRole allowedRoles={['ADMIN', 'TEACHER']}>
                <ExamDetailPage />
              </RequireRole>
            }
          />
          <Route
            path="my-exams"
            element={
              <RequireRole allowedRoles={['STUDENT']}>
                <StudentExamsPage />
              </RequireRole>
            }
          />
          <Route
            path="my-exams/:examId/session"
            element={
              <RequireRole allowedRoles={['STUDENT']}>
                <StudentExamSessionPage />
              </RequireRole>
            }
          />
          <Route
            path="my-results"
            element={
              <RequireRole allowedRoles={['STUDENT']}>
                <StudentResultsPage />
              </RequireRole>
            }
          />
          <Route
            path="my-results/:examId"
            element={
              <RequireRole allowedRoles={['STUDENT']}>
                <StudentResultDetailPage />
              </RequireRole>
            }
          />
          <Route
            path="account/password"
            element={
              <RequireRole allowedRoles={['ADMIN', 'TEACHER']}>
                <ChangePasswordPage />
              </RequireRole>
            }
          />
          <Route
            path="admin/users"
            element={
              <RequireRole allowedRoles={['ADMIN']}>
                <UsersManagementPage />
              </RequireRole>
            }
          />
          <Route
            path="admin/question-types"
            element={
              <RequireRole allowedRoles={['ADMIN']}>
                <QuestionTypesPage />
              </RequireRole>
            }
          />
          <Route
            path="admin/audit-logs"
            element={
              <RequireRole allowedRoles={['ADMIN']}>
                <AuditLogsPage />
              </RequireRole>
            }
          />
          <Route path="403" element={<ForbiddenPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
