import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { fetchGrafanaEmbed } from '../../api/grafana';

const operatorTabs = [
  { label: 'Anomaly', path: '/operator/anomaly' },
  { label: 'Vehicle', path: '/operator/vehicle' },
  { label: 'Infra Service', path: '/operator/infra-service' }
];

export default function OperatorInfraServicePage() {
  const [embedUrl, setEmbedUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadGrafana() {
      try {
        const result = await fetchGrafanaEmbed();

        if (cancelled) {
          return;
        }

        if (!result.enabled || !result.embedUrl) {
          setEmbedUrl('');
          setErrorMessage('Grafana embed is not enabled for this deployment.');
          return;
        }

        setEmbedUrl(result.embedUrl);
        setErrorMessage('');
      } catch (error) {
        if (cancelled) {
          return;
        }

        setEmbedUrl('');
        setErrorMessage(error.message);
      }
    }

    loadGrafana();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DashboardLayout
      role="OPERATOR"
      title="Operator Infra Service Dashboard"
      description=""
      tabs={operatorTabs}
    >
      {errorMessage ? <div className="auth-message error">{errorMessage}</div> : null}

      <section className="anomaly-full-layout">
        <article className="card anomaly-full-card">
          {embedUrl ? (
            <iframe
              title="Grafana infrastructure dashboard"
              src={embedUrl}
              className="embed-frame anomaly-full-frame"
              frameBorder="0"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <div className="iframe-slot-inner anomaly-full-placeholder">
              <span>Grafana infrastructure dashboard</span>
              <code>embed URL pending</code>
            </div>
          )}
        </article>
      </section>
    </DashboardLayout>
  );
}
