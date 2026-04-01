import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { isExternalUrl } from '../config/appTarget';

function AppRedirect({ to, replace = true }) {
  const external = isExternalUrl(to);

  useEffect(() => {
    if (external) {
      window.location.replace(to);
    }
  }, [external, to]);

  if (external) {
    return null;
  }

  return <Navigate to={to} replace={replace} />;
}

export default AppRedirect;
