import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { fetchVehicleEmbeds } from '../../api/quicksight';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const operatorTabs = [
  { label: 'Anomaly', path: '/operator/anomaly' },
  { label: 'Vehicle', path: '/operator/vehicle' },
  { label: 'Infra Service', path: '/operator/infra-service' }
];

function OperatorVehiclePage() {
  const [dashboardPanel, setDashboardPanel] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const result = await fetchVehicleEmbeds();

        if (cancelled) {
          return;
        }

        setDashboardPanel(result.panels?.dashboard || null);
        setErrorMessage('');
      } catch (error) {
        if (cancelled) {
          return;
        }

        const missingFieldsMessage = error.missingFields?.length
          ? `Missing: ${error.missingFields.join(', ')}`
          : '';

        setErrorMessage(
          [error.message, missingFieldsMessage].filter(Boolean).join(' ')
        );
      }
    }

    loadDashboard();
    const intervalId = window.setInterval(loadDashboard, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <DashboardLayout
      role="OPERATOR"
      title="Operator Vehicle Dashboard"
      description=""
      tabs={operatorTabs}
    >
      {errorMessage ? <div className="auth-message error">{errorMessage}</div> : null}

      <section className="anomaly-full-layout">
        <article className="card anomaly-full-card">
          {dashboardPanel?.embedUrl ? (
            <iframe
              title={dashboardPanel.title}
              src={dashboardPanel.embedUrl}
              className="embed-frame anomaly-full-frame"
              frameBorder="0"
              allowFullScreen
            />
          ) : (
            <div className="iframe-slot-inner anomaly-full-placeholder">
              <span>QuickSight operator vehicle dashboard</span>
              <code>embed URL pending</code>
            </div>
          )}
        </article>
      </section>
    </DashboardLayout>
  );
}

export default OperatorVehiclePage;