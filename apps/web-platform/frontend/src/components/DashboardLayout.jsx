import { useLocation, useNavigate } from 'react-router-dom';
import { getLoginUrl, isExternalUrl } from '../config/appTarget';
import { clearStoredSession, getStoredSession } from '../utils/authStorage';

function DashboardLayout({ role, userId, title, description, tabs = [], children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const session = getStoredSession();

  const resolvedRole = role || session?.role?.toUpperCase() || 'USER';
  const resolvedUserId = userId || session?.user?.userId || 'guest';

  const handleTabClick = (path) => {
    if (location.pathname === path) {
      window.location.reload();
      return;
    }

    navigate(path);
  };

  const handleLogout = () => {
    clearStoredSession();
    const loginUrl = getLoginUrl();

    if (isExternalUrl(loginUrl)) {
      window.location.assign(loginUrl);
      return;
    }

    navigate(loginUrl);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <div className="brand-block">
            <span className="brand-title">Web Platform</span>
            <span className="brand-role">{resolvedRole}</span>
          </div>

          {tabs.length > 0 ? (
            <nav className="topbar-nav" aria-label="dashboard navigation">
              {tabs.map((tab) => {
                const isActive = location.pathname === tab.path;

                return (
                  <button
                    key={tab.path}
                    type="button"
                    className={`topbar-tab${isActive ? ' active' : ''}`}
                    onClick={() => handleTabClick(tab.path)}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          ) : null}
        </div>

        <div className="topbar-right">
          <span className="user-chip">{resolvedUserId}</span>
          <button type="button" className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="page dashboard-page app-shell-page operator-page">
        <div className="page-intro">
          <h1>{title}</h1>
          {description ? <p className="dashboard-description">{description}</p> : null}
        </div>
        {children}
      </main>
    </div>
  );
}

export default DashboardLayout;
