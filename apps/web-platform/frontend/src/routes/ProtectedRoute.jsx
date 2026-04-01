import AppRedirect from '../components/AppRedirect';
import { getDefaultPathForRole, getLoginUrl } from '../config/appTarget';
import { getStoredSession } from '../utils/authStorage';

function ProtectedRoute({ allowedRoles, children }) {
  const session = getStoredSession();

  if (!session) {
    return <AppRedirect to={getLoginUrl()} replace />;
  }

  if (!allowedRoles.includes(session.role)) {
    return <AppRedirect to={getDefaultPathForRole(session.role)} replace />;
  }

  return children;
}

export default ProtectedRoute;
