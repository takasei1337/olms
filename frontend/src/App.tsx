import { BrowserRouter, Route, Routes } from 'react-router-dom';
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
import { QuestionBankPage } from './features/questions/pages/QuestionBankPage';
import { QuestionEditorPage } from './features/questions/pages/QuestionEditorPage';
import { UsersManagementPage } from './features/users/pages/UsersManagementPage';
import { ForbiddenPage } from './pages/ForbiddenPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { OlmsUiShowcasePage } from './features/showcase/OlmsUiShowcasePage';
import { ThemeProvider } from './features/theme/ThemeContext';

export function AppRoutes() {
  return (
    <Routes>
      {import.meta.env.DEV && (
        <Route path="/ui-showcase" element={<OlmsUiShowcasePage />} />
      )}
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
