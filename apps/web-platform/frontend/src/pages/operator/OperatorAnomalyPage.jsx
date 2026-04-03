import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { fetchAnomalyDashboard } from '../../api/anomalyDashboard';

const REFRESH_INTERVAL_MS = 1 * 1000;
const numberFormatter = new Intl.NumberFormat('ko-KR');

const operatorTabs = [
  { label: '이상 탐지', path: '/operator/anomaly' },
  { label: '차량', path: '/operator/vehicle' },
  { label: '인프라 서비스', path: '/operator/infra-service' }
];

const KPI_ITEMS = [
  {
    key: 'totalAlerts',
    label: '현재 이상탐지 건수'
  },
  {
    key: 'affectedVehicles',
    label: '이상 발생 차량 수'
  },
  {
    key: 'suddenDecelCount',
    label: '급감속 건수'
  },
  {
    key: 'suddenAccelCount',
    label: '급가속 건수'
  },
  {
    key: 'lowFuelCount',
    label: '연료 부족 건수'
  },
  {
    key: 'abnormalGpsCount',
    label: 'GPS 이상 건수'
  },
  {
    key: 'dataBurstCount',
    label: '데이터 폭주 건수'
  },
  {
    key: 'missingDataCount',
    label: '데이터 미수신 건수'
  }
];

const INITIAL_BREAKDOWN_ITEMS = [
  { key: 'SUDDEN_DECEL', label: '급감속', value: 0, ratio: 0, color: '#2f6b8a' },
  { key: 'SUDDEN_ACCEL', label: '급가속', value: 0, ratio: 0, color: '#8fd2ee' },
  { key: 'LOW_FUEL', label: '연료 부족', value: 0, ratio: 0, color: '#f3a145' },
  { key: 'ABNORMAL_GPS', label: 'GPS 이상', value: 0, ratio: 0, color: '#6d95e2' },
  { key: 'DATA_BURST', label: '데이터 폭주', value: 0, ratio: 0, color: '#d054bf' },
  { key: 'MISSING_DATA', label: '데이터 미수신', value: 0, ratio: 0, color: '#b8de39' }
];

const INITIAL_DASHBOARD = {
  generatedAt: '-',
  summary: {
    totalAlerts: 0,
    affectedVehicles: 0,
    suddenDecelCount: 0,
    suddenAccelCount: 0,
    lowFuelCount: 0,
    abnormalGpsCount: 0,
    dataBurstCount: 0,
    missingDataCount: 0
  },
  breakdown: {
    totalTrackedAlerts: 0,
    items: INITIAL_BREAKDOWN_ITEMS
  },
  latestAlert: null,
  recentAlerts: []
};

function formatCount(value) {
  return numberFormatter.format(Number(value || 0));
}

function buildDonutSegments(items, radius) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  if (!total) {
    return [];
  }

  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return items
    .filter((item) => item.value > 0)
    .map((item) => {
      const length = (circumference * item.value) / total;
      const segment = {
        ...item,
        dashArray: `${length} ${circumference}`,
        dashOffset: -offset
      };

      offset += length;
      return segment;
    });
}

function DonutChart({ totalAlerts, items }) {
  const radius = 78;
  const segments = buildDonutSegments(items, radius);
  const chartTotal = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <article className="card operator-anomaly-chart-card">
      <div className="operator-anomaly-chart-head">
        <div>
          <h2>이상 유형별 발생 비율</h2>
        </div>
        <span className="operator-anomaly-chart-total">
          추적 유형 {formatCount(chartTotal)}건
        </span>
      </div>

      <div className="operator-anomaly-chart-body">
        <div className="operator-anomaly-chart-visual">
          <svg
            viewBox="0 0 220 220"
            className="operator-anomaly-donut"
            role="img"
            aria-label="이상 유형별 발생 비율 차트"
          >
            <circle
              cx="110"
              cy="110"
              r={radius}
              fill="none"
              stroke="rgba(31, 53, 90, 0.10)"
              strokeWidth="30"
            />
            {segments.map((segment) => (
              <circle
                key={segment.key}
                cx="110"
                cy="110"
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth="30"
                strokeDasharray={segment.dashArray}
                strokeDashoffset={segment.dashOffset}
                transform="rotate(-90 110 110)"
              />
            ))}
          </svg>

          <div className="operator-anomaly-donut-center">
            <strong>{formatCount(totalAlerts)}</strong>
            <span>전체 이상</span>
          </div>
        </div>

        <ul className="operator-anomaly-legend">
          {items.map((item) => (
            <li key={item.key} className="operator-anomaly-legend-item">
              <span
                className="operator-anomaly-legend-swatch"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              <span className="operator-anomaly-legend-label">{item.label}</span>
              <div className="operator-anomaly-legend-values">
                <strong>{formatCount(item.value)}</strong>
                <span>{item.ratio.toFixed(1)}%</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function LatestAlertBanner({ latestAlert }) {
  return (
    <article className="card operator-anomaly-banner-card">
      <div className="operator-anomaly-banner-head">
        <div>
          <p className="operator-anomaly-banner-label">최신 이상 1건</p>
          <h2>운영자 실시간 알림 배너</h2>
        </div>
      </div>

      {latestAlert ? (
        <div className="operator-anomaly-banner-content">
          <div className="operator-anomaly-banner-item">
            <span>발생시각</span>
            <strong>{latestAlert.occurredAtDt}</strong>
          </div>
          <div className="operator-anomaly-banner-item">
            <span>차량 ID</span>
            <strong>{latestAlert.vehicleId}</strong>
          </div>
          <div className="operator-anomaly-banner-item">
            <span>이상 유형</span>
            <strong>{latestAlert.anomalyLabel}</strong>
          </div>
          <div className="operator-anomaly-banner-item">
            <span>설명</span>
            <strong>{latestAlert.description}</strong>
          </div>
          <div className="operator-anomaly-banner-item">
            <span>근거값</span>
            <strong>{latestAlert.evidence}</strong>
          </div>
        </div>
      ) : (
        <p className="operator-anomaly-banner-empty">
          아직 적재된 이상 데이터가 없습니다.
        </p>
      )}
    </article>
  );
}

function RecentAlertsTable({ alerts }) {
  return (
    <article className="card operator-anomaly-recent-card">
      <div className="operator-anomaly-recent-head">
        <div>
          <p className="operator-anomaly-recent-label">운영 우선 확인</p>
          <h2>최근 이상 발생 차량 5건</h2>
        </div>
        <span className="operator-anomaly-recent-badge">
          {formatCount(alerts.length)}건 표시
        </span>
      </div>

      {alerts.length ? (
        <div className="operator-anomaly-recent-table-wrap">
          <table className="operator-anomaly-recent-table">
            <thead>
              <tr>
                <th>발생시각</th>
                <th>차량 ID</th>
                <th>이상 유형</th>
                <th>설명</th>
                <th>근거값</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert, index) => (
                <tr key={alert.alertId || `${alert.vehicleId}-${alert.occurredAtDt}-${index}`}>
                  <td>{alert.occurredAtDt}</td>
                  <td>{alert.vehicleId}</td>
                  <td>{alert.anomalyLabel}</td>
                  <td>{alert.description}</td>
                  <td>{alert.evidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="operator-anomaly-recent-empty">
          아직 표시할 최근 이상 데이터가 없습니다.
        </p>
      )}
    </article>
  );
}

function OperatorAnomalyPage() {
  const [dashboard, setDashboard] = useState(INITIAL_DASHBOARD);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timeoutId;

    async function loadDashboard() {
      try {
        const result = await fetchAnomalyDashboard();

        if (cancelled) {
          return;
        }

        setDashboard({
          ...INITIAL_DASHBOARD,
          ...result,
          summary: {
            ...INITIAL_DASHBOARD.summary,
            ...result.summary
          },
          breakdown: {
            ...INITIAL_DASHBOARD.breakdown,
            ...result.breakdown,
            items: result.breakdown?.items?.length
              ? result.breakdown.items
              : INITIAL_DASHBOARD.breakdown.items
          }
        });
        setErrorMessage('');
      } catch (error) {
        if (cancelled) {
          return;
        }

        setErrorMessage(error.message);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          // Schedule the next poll only after the current request settles.
          timeoutId = window.setTimeout(loadDashboard, REFRESH_INTERVAL_MS);
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  return (
    <DashboardLayout
      role="OPERATOR"
      title="이상 탐지 대시보드"
      tabs={operatorTabs}
    >
      {errorMessage ? <div className="auth-message error">{errorMessage}</div> : null}

      {isLoading ? (
        <article className="card operator-anomaly-loading-card">
          이상 탐지 데이터를 불러오는 중입니다...
        </article>
      ) : null}

      {!isLoading ? (
        <div className="operator-anomaly-shell">
          <LatestAlertBanner latestAlert={dashboard.latestAlert} />

          <section className="operator-anomaly-top-grid">
            <div className="operator-anomaly-main-column">
              <div className="operator-anomaly-kpi-grid">
                {KPI_ITEMS.map((item) => (
                  <article key={item.key} className="card operator-anomaly-kpi-card">
                    <p className="operator-anomaly-kpi-label">{item.label}</p>
                    <strong className="operator-anomaly-kpi-value">
                      {formatCount(dashboard.summary[item.key])}
                    </strong>
                  </article>
                ))}
              </div>

              <RecentAlertsTable alerts={dashboard.recentAlerts || []} />
            </div>

            <DonutChart
              totalAlerts={dashboard.summary.totalAlerts}
              items={dashboard.breakdown.items}
            />
          </section>
        </div>
      ) : null}
    </DashboardLayout>
  );
}

export default OperatorAnomalyPage;
