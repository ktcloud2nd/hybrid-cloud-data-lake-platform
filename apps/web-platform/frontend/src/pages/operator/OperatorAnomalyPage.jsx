import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import {
  fetchAnomalyEmbeds,
  fetchLatestAnomalyAlert
} from '../../api/quicksight';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const operatorTabs = [
  { label: '이상 탐지', path: '/operator/anomaly' },
  { label: '차량', path: '/operator/vehicle' },
  { label: '인프라 서비스', path: '/operator/infra-service' }
];

function OperatorAnomalyPage() {
  const [dashboardPanel, setDashboardPanel] = useState(null);
  const [latestAlert, setLatestAlert] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [latestAlertError, setLatestAlertError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const result = await fetchAnomalyEmbeds();

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

    async function loadLatestAlert() {
      try {
        const result = await fetchLatestAnomalyAlert();

        if (cancelled) {
          return;
        }

        setLatestAlert(result.alert || null);
        setLatestAlertError('');
      } catch (error) {
        if (cancelled) {
          return;
        }

        setLatestAlert(null);
        setLatestAlertError(error.message);
      }
    }

    async function loadPageData() {
      await Promise.all([loadDashboard(), loadLatestAlert()]);
    }

    loadPageData();
    const intervalId = window.setInterval(loadPageData, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <DashboardLayout
      role="OPERATOR"
      title="이상 탐지 대시보드"
      description=""
      tabs={operatorTabs}
    >
      {latestAlert ? (
        <section className="latest-alert-banner card">
          <p className="latest-alert-label">실시간 최신 이상 알림</p>
          <p className="latest-alert-text">
            {latestAlert.occurredAtDt} | {latestAlert.vehicleId} |{' '}
            {latestAlert.description || latestAlert.anomalyType} |{' '}
            {latestAlert.evidence || '-'}
          </p>
        </section>
      ) : null}

      {latestAlertError ? (
        <div className="auth-message error">{latestAlertError}</div>
      ) : null}

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
              <span>QuickSight 이상 탐지 대시보드</span>
              <code>embed URL pending</code>
            </div>
          )}
        </article>
      </section>
    </DashboardLayout>
  );
}

export default OperatorAnomalyPage;
