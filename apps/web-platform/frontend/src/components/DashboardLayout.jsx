import { useLocation, useNavigate } from 'react-router-dom';
import { appTarget, getLoginUrl, isExternalUrl } from '../config/appTarget';
import { clearStoredSession, getStoredSession } from '../utils/authStorage';

function DashboardLayout({
  role,
  userId,
  title,
  metaContent = null,
  description,
  tabs = [],
  hideIntro = false,
  children
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const session = getStoredSession();
  const brandTitle = appTarget === 'operator' ? 'Vehicle Admin Portal' : 'Vehicle Portal';

  const resolvedRole = role || session?.role?.toUpperCase() || 'USER';
  const resolvedUserId =
    userId ||
    session?.user?.userName ||
    session?.user?.userId ||
    'guest';

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
            <span className="brand-title">{brandTitle}</span>
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
        {!hideIntro ? (
          <div className="page-intro">
            <h1>{title}</h1>
            {metaContent}
            {description ? <p className="dashboard-description">{description}</p> : null}
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}

export default DashboardLayout;
