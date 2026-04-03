import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { fetchOperatorVehicleDashboard } from '../../api/operatorVehicleDashboard';

const REFRESH_INTERVAL_MS = 1 * 1000;
const numberFormatter = new Intl.NumberFormat('ko-KR');

const operatorTabs = [
  { label: '이상 탐지', path: '/operator/anomaly' },
  { label: '차량', path: '/operator/vehicle' },
  { label: '인프라 서비스', path: '/operator/infra-service' }
];

const KPI_ITEMS = [
  {
    key: 'totalVehicles',
    label: '전체 차량 수',
    helper: '최근 수집 기준 전체 추적 차량'
  },
  {
    key: 'drivingVehicles',
    label: '운행 중 차량 수',
    helper: '주행 데이터가 확인된 차량'
  },
  {
    key: 'engineOffVehicles',
    label: '시동 꺼짐 차량 수',
    helper: '엔진 OFF 상태 차량'
  },
  {
    key: 'stoppedVehicles',
    label: '정차 차량 수',
    helper: '엔진 ON 상태 정차 차량'
  }
];

const INITIAL_STATUS_ITEMS = [
  { key: 'driving', label: '운행 중', value: 0, ratio: 0, color: '#2f6b8a' },
  { key: 'engine_off', label: '시동 꺼짐', value: 0, ratio: 0, color: '#8fd2ee' },
  { key: 'stopped', label: '정차', value: 0, ratio: 0, color: '#f3a145' },
  { key: 'offline', label: '오프라인', value: 0, ratio: 0, color: '#d054bf' },
  { key: 'no_data', label: '데이터 없음', value: 0, ratio: 0, color: '#c9d3e3' }
];

const INITIAL_FUEL_ITEMS = [
  { key: 'ample', label: '여유', value: 0, ratio: 0, color: '#8fd2ee' },
  { key: 'normal', label: '보통', value: 0, ratio: 0, color: '#7fb069' },
  { key: 'low', label: '주의', value: 0, ratio: 0, color: '#f3c15d' },
  { key: 'critical', label: '위험', value: 0, ratio: 0, color: '#e06b5f' }
];

const INITIAL_DASHBOARD = {
  generatedAt: '-',
  refreshIntervalSeconds: 1,
  thresholds: {
    delayedSeconds: 15,
    offlineSeconds: 60,
    idleSeconds: 60
  },
  summary: {
    totalVehicles: 0,
    drivingVehicles: 0,
    engineOffVehicles: 0,
    stoppedVehicles: 0,
    offlineVehicles: 0,
    noDataVehicles: 0
  },
  statusBreakdown: {
    totalTrackedVehicles: 0,
    items: INITIAL_STATUS_ITEMS
  },
  fuelSummary: {
    totalTrackedVehicles: 0,
    items: INITIAL_FUEL_ITEMS
  },
  vehicleTable: [],
  delayedVehicles: [],
  idleVehicles: []
};

function formatCount(value) {
  return numberFormatter.format(Number(value || 0));
}

function formatFuelLevel(value) {
  if (value === null || value === undefined) {
    return '-';
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${numeric.toFixed(1)}%` : '-';
}

function formatSpeed(value) {
  if (value === null || value === undefined) {
    return '-';
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${Math.round(numeric)} km/h` : '-';
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

function VehicleStatusDonut({ totalVehicles, items }) {
  const radius = 78;
  const segments = buildDonutSegments(items, radius);
  const trackedTotal = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <article className="card operator-vehicle-chart-card">
      <div className="operator-vehicle-chart-head">
        <div>
          <p className="operator-vehicle-section-label">차량 상태 분포</p>
          <h2>차량 상태 비율</h2>
          <p>실시간 상태가 확인된 차량만 기준으로 운영 비율을 집계합니다.</p>
        </div>
        <span className="operator-vehicle-chart-total">
          상태 집계 {formatCount(trackedTotal)}대
        </span>
      </div>

      <div className="operator-vehicle-chart-body">
        <div className="operator-vehicle-chart-visual">
          <svg
            viewBox="0 0 220 220"
            className="operator-vehicle-donut"
            role="img"
            aria-label="차량 상태 분포 도넛 차트"
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

          <div className="operator-vehicle-donut-center">
            <strong>{formatCount(trackedTotal)}</strong>
            <span>상태 집계</span>
          </div>
        </div>

        <ul className="operator-vehicle-legend">
          {items.map((item) => (
            <li key={item.key} className="operator-vehicle-legend-item">
              <span
                className="operator-vehicle-legend-swatch"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              <span className="operator-vehicle-legend-label">{item.label}</span>
              <div className="operator-vehicle-legend-values">
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

function FuelSummaryCard({ fuelSummary }) {
  return (
    <article className="card operator-vehicle-fuel-card">
      <div className="operator-vehicle-panel-head">
        <div>
          <p className="operator-vehicle-section-label">연료 상태 요약</p>
          <h2>연료 상태 분포</h2>
        </div>
        <span className="operator-vehicle-panel-badge">
          {formatCount(fuelSummary.totalTrackedVehicles)}대 기준
        </span>
      </div>

      <div className="operator-vehicle-fuel-stack">
        {fuelSummary.items.map((item) => (
          <div key={item.key} className="operator-vehicle-fuel-row">
            <div className="operator-vehicle-fuel-meta">
              <span
                className="operator-vehicle-legend-swatch"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              <strong>{item.label}</strong>
            </div>
            <div className="operator-vehicle-fuel-bar-track">
              <div
                className="operator-vehicle-fuel-bar-fill"
                style={{
                  width: `${item.ratio}%`,
                  backgroundColor: item.color
                }}
              />
            </div>
            <div className="operator-vehicle-fuel-values">
              <strong>{formatCount(item.value)}</strong>
              <span>{item.ratio.toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function VehicleTable({ rows }) {
  return (
    <article className="card operator-vehicle-table-card">
      <div className="operator-vehicle-panel-head">
        <div>
          <p className="operator-vehicle-section-label">운영 현황</p>
          <h2>전체 차량 목록</h2>
        </div>
        <span className="operator-vehicle-panel-badge">
          {formatCount(rows.length)}대 표시
        </span>
      </div>

      <div className="table-wrap operator-vehicle-table-wrap">
        <table className="operator-vehicle-table">
          <thead>
            <tr>
              <th>차량 ID</th>
              <th>상태</th>
              <th>속도</th>
              <th>연료</th>
              <th>최근 수신</th>
              <th>위치</th>
              <th>지연</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.vehicleId}>
                  <td>{row.vehicleId}</td>
                  <td>
                    <span
                      className={`operator-vehicle-status-badge is-${row.status}`}
                      style={{ '--badge-color': row.statusColor }}
                    >
                      {row.statusLabel}
                    </span>
                  </td>
                  <td>{formatSpeed(row.speed)}</td>
                  <td>{formatFuelLevel(row.fuelLevel)}</td>
                  <td>{row.lastUpdatedAt}</td>
                  <td>{row.locationLabel}</td>
                  <td>{row.delaySeconds === null ? '-' : `${row.delaySeconds}s`}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="operator-vehicle-empty-cell">
                  아직 표시할 차량 데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function DelayedVehiclesTable({ rows, delayedSeconds }) {
  return (
    <article className="card operator-vehicle-side-card">
      <div className="operator-vehicle-panel-head">
        <div>
          <p className="operator-vehicle-section-label">갱신 지연</p>
          <h2>업데이트 지연 차량</h2>
        </div>
        <span className="operator-vehicle-panel-badge">{delayedSeconds}s 이상</span>
      </div>

      <div className="table-wrap operator-vehicle-side-table-wrap">
        <table className="operator-vehicle-side-table">
          <thead>
            <tr>
              <th>차량 ID</th>
              <th>상태</th>
              <th>지연</th>
              <th>최근 수신</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={`${row.vehicleId}-${row.delaySeconds}`}>
                  <td>{row.vehicleId}</td>
                  <td>{row.statusLabel}</td>
                  <td>{row.delayLabel}</td>
                  <td>{row.lastUpdatedAt}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="operator-vehicle-empty-cell">
                  현재 지연 상태 차량이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function IdleVehiclesTable({ rows, idleSeconds }) {
  return (
    <article className="card operator-vehicle-side-card">
      <div className="operator-vehicle-panel-head">
        <div>
          <p className="operator-vehicle-section-label">운영 체크</p>
          <h2>공회전 의심 차량</h2>
        </div>
        <span className="operator-vehicle-panel-badge">{idleSeconds}s 이상</span>
      </div>

      <div className="table-wrap operator-vehicle-side-table-wrap">
        <table className="operator-vehicle-side-table">
          <thead>
            <tr>
              <th>차량 ID</th>
              <th>공회전 시간</th>
              <th>연료</th>
              <th>최근 수신</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={`${row.vehicleId}-${row.idleSeconds}`}>
                  <td>{row.vehicleId}</td>
                  <td>{row.idleMinutes.toFixed(1)}분</td>
                  <td>{formatFuelLevel(row.fuelLevel)}</td>
                  <td>{row.lastUpdatedAt}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="operator-vehicle-empty-cell">
                  현재 공회전 의심 차량이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function OperatorVehiclePage() {
  const [dashboard, setDashboard] = useState(INITIAL_DASHBOARD);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const chartItems = dashboard.statusBreakdown.items.filter(
    (item) => item.key !== 'offline' && item.key !== 'no_data'
  );

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const result = await fetchOperatorVehicleDashboard();

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
          statusBreakdown: {
            ...INITIAL_DASHBOARD.statusBreakdown,
            ...result.statusBreakdown,
            items: result.statusBreakdown?.items?.length
              ? result.statusBreakdown.items
              : INITIAL_DASHBOARD.statusBreakdown.items
          },
          fuelSummary: {
            ...INITIAL_DASHBOARD.fuelSummary,
            ...result.fuelSummary,
            items: result.fuelSummary?.items?.length
              ? result.fuelSummary.items
              : INITIAL_DASHBOARD.fuelSummary.items
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
        }
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
      title="차량 운영 현황 대시보드"
      description=""
      metaContent={
        <p className="dashboard-meta-line">
          최근 갱신 {dashboard.generatedAt} | 갱신 주기 {dashboard.refreshIntervalSeconds}초
        </p>
      }
      tabs={operatorTabs}
    >
      {errorMessage ? <div className="auth-message error">{errorMessage}</div> : null}

      {isLoading ? (
        <article className="card operator-vehicle-loading-card">
          차량 운영 현황 데이터를 불러오는 중입니다...
        </article>
      ) : null}

      {!isLoading ? (
        <div className="operator-vehicle-shell">
          <section className="operator-vehicle-top-grid">
            <div className="operator-vehicle-kpi-column">
              <div className="operator-vehicle-kpi-grid">
                {KPI_ITEMS.map((item) => (
                  <article key={item.key} className="card operator-vehicle-kpi-card">
                    <p className="operator-vehicle-kpi-label">{item.label}</p>
                    <strong className="operator-vehicle-kpi-value">
                      {formatCount(dashboard.summary[item.key])}
                    </strong>
                    <span className="operator-vehicle-kpi-helper">{item.helper}</span>
                  </article>
                ))}
              </div>

              <section className="operator-vehicle-table-section">
                <VehicleTable rows={dashboard.vehicleTable} />
              </section>
            </div>

            <div className="operator-vehicle-chart-column">
              <VehicleStatusDonut
                totalVehicles={dashboard.summary.totalVehicles}
                items={chartItems}
              />
            </div>
          </section>

          <section className="operator-vehicle-bottom-grid">
            <DelayedVehiclesTable
              rows={dashboard.delayedVehicles}
              delayedSeconds={dashboard.thresholds.delayedSeconds}
            />
            <FuelSummaryCard fuelSummary={dashboard.fuelSummary} />
            <IdleVehiclesTable
              rows={dashboard.idleVehicles}
              idleSeconds={dashboard.thresholds.idleSeconds}
            />
          </section>
        </div>
      ) : null}
    </DashboardLayout>
  );
}

export default OperatorVehiclePage;
