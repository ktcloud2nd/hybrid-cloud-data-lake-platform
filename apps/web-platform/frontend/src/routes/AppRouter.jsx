import { Navigate, Route, Routes } from 'react-router-dom';
import AppRedirect from '../components/AppRedirect';
import { appTarget, getDefaultPathForRole, getLoginUrl } from '../config/appTarget';
import LoginPage from '../pages/auth/LoginPage';
import UserDashboardPage from '../pages/user/UserDashboardPage';
import OperatorDashboardPage from '../pages/operator/OperatorDashboardPage';
import OperatorAnomalyPage from '../pages/operator/OperatorAnomalyPage';
import OperatorVehiclePage from '../pages/operator/OperatorVehiclePage';
import OperatorInfraServicePage from '../pages/operator/OperatorInfraServicePage';
import ProtectedRoute from './ProtectedRoute';
import { getStoredSession } from '../utils/authStorage';

function LoginRoute() {
  const session = getStoredSession();

  if (!session) {
    return <LoginPage />;
  }

  return <AppRedirect to={getDefaultPathForRole(session.role)} replace />;
}

function UserRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/user/dashboard" replace />} />
      <Route path="/login" element={<AppRedirect to={getLoginUrl()} replace />} />
      <Route
        path="/user/dashboard"
        element={
          <ProtectedRoute allowedRoles={['user']}>
            <UserDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/user/dashboard" replace />} />
    </Routes>
  );
}

function OperatorRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/operator/infra-service" replace />} />
      <Route path="/login" element={<AppRedirect to={getLoginUrl()} replace />} />
      <Route
        path="/operator/dashboard"
        element={
          <ProtectedRoute allowedRoles={['operator']}>
            <OperatorDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/operator/anomaly"
        element={
          <ProtectedRoute allowedRoles={['operator']}>
            <OperatorAnomalyPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/operator/vehicle"
        element={
          <ProtectedRoute allowedRoles={['operator']}>
            <OperatorVehiclePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/operator/infra-service"
        element={
          <ProtectedRoute allowedRoles={['operator']}>
            <OperatorInfraServicePage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/operator/infra-service" replace />} />
    </Routes>
  );
}

function FullRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginRoute />} />
      <Route
        path="/user/dashboard"
        element={
          <ProtectedRoute allowedRoles={['user']}>
            <UserDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/operator/dashboard"
        element={
          <ProtectedRoute allowedRoles={['operator']}>
            <OperatorDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/operator/anomaly"
        element={
          <ProtectedRoute allowedRoles={['operator']}>
            <OperatorAnomalyPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/operator/vehicle"
        element={
          <ProtectedRoute allowedRoles={['operator']}>
            <OperatorVehiclePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/operator/infra-service"
        element={
          <ProtectedRoute allowedRoles={['operator']}>
            <OperatorInfraServicePage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<div>404 Not Found</div>} />
    </Routes>
  );
}

function AppRouter() {
  if (appTarget === 'login') {
    return (
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="*" element={<AppRedirect to={getLoginUrl()} replace />} />
      </Routes>
    );
  }

  if (appTarget === 'user') {
    return <UserRoutes />;
  }

  if (appTarget === 'operator') {
    return <OperatorRoutes />;
  }

  return <FullRoutes />;
}

export default AppRouter;
