import DashboardLayout from '../../components/DashboardLayout';

const operatorTabs = [
  { label: '이상 탐지', path: '/operator/anomaly' },
  { label: '차량', path: '/operator/vehicle' },
  { label: '인프라 서비스', path: '/operator/infra-service' }
];

// Local test:
// http://localhost:3000/grafana/d-solo/...
//
// Deployment examples:
// https://your-domain.example/grafana/d-solo/...
// http://your-server-ip:3000/grafana/d-solo/...
//
// Future production handoff already prepared but intentionally left disconnected:
// - frontend/src/api/grafana.js
// - frontend/src/components/GrafanaEmbedFrame.jsx
// - backend/src/grafana.js
// - backend/src/server.js commented /api/grafana/embed route
//
// Keep the local direct iframe URLs below until deployment Grafana/auth settings are finalized.
const createGrafanaPanelUrl = (panelId) =>
  `http://localhost:3000/grafana/d-solo/k3s-infra-draft/k3s-infra-overview-draft?orgId=1&from=now-1h&to=now&timezone=browser&var-datasource=prometheus&var-namespace=$__all&refresh=30s&panelId=${panelId}&__feature.dashboardScene=true`;

const infraPanels = [
  {
    key: 'readyNodes',
    title: '정상 노드 수',
    spanClass: 'span-3',
    sizeClass: 'stat',
    src: createGrafanaPanelUrl('panel-1')
  },
  {
    key: 'runningPods',
    title: '실행 중인 파드 수',
    spanClass: 'span-3',
    sizeClass: 'stat',
    src: createGrafanaPanelUrl('panel-2')
  },
  {
    key: 'pendingPods',
    title: '대기 중인 파드 수',
    spanClass: 'span-3',
    sizeClass: 'stat',
    src: createGrafanaPanelUrl('panel-3')
  },
  {
    key: 'restarts',
    title: '최근 1시간 재시작 수',
    spanClass: 'span-3',
    sizeClass: 'stat',
    src: createGrafanaPanelUrl('panel-4')
  },
  {
    key: 'nodeCpu',
    title: '노드 CPU 사용률',
    spanClass: 'span-6',
    sizeClass: 'chart',
    src: createGrafanaPanelUrl('panel-5')
  },
  {
    key: 'nodeMemory',
    title: '노드 메모리 사용률',
    spanClass: 'span-6',
    sizeClass: 'chart',
    src: createGrafanaPanelUrl('panel-6')
  },
  {
    key: 'rootFs',
    title: '루트 파일시스템 사용률',
    spanClass: 'span-4',
    sizeClass: 'chart',
    src: createGrafanaPanelUrl('panel-7')
  },
  {
    key: 'networkThroughput',
    title: '노드별 네트워크 처리량',
    spanClass: 'span-4',
    sizeClass: 'chart',
    src: createGrafanaPanelUrl('panel-8')
  },
  {
    key: 'podsByNamespace',
    title: '네임스페이스별 실행 파드 수',
    spanClass: 'span-4',
    sizeClass: 'chart',
    src: createGrafanaPanelUrl('panel-9')
  },
  {
    key: 'topCpuPods',
    title: 'CPU 사용량 상위 파드',
    spanClass: 'span-6',
    sizeClass: 'table',
    src: createGrafanaPanelUrl('panel-11')
  },
  {
    key: 'topMemoryPods',
    title: '메모리 사용량 상위 파드',
    spanClass: 'span-6',
    sizeClass: 'table',
    src: createGrafanaPanelUrl('panel-12')
  },
  {
    key: 'topRestartingPods',
    title: '재시작 상위 파드',
    spanClass: 'span-6',
    sizeClass: 'table',
    src: createGrafanaPanelUrl('panel-13')
  },
  {
    key: 'problemPods',
    title: '문제 파드 목록',
    spanClass: 'span-6',
    sizeClass: 'table',
    src: createGrafanaPanelUrl('panel-14')
  }
];

function PanelSlot({ title, src }) {
  return (
    <iframe
      title={title}
      src={src}
      className="infra-embed-frame"
      frameBorder="0"
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}

export default function OperatorInfraServicePage() {
  return (
    <DashboardLayout
      role="OPERATOR"
      title="인프라 서비스 대시보드"
      description=""
      tabs={operatorTabs}
    >
      <section className="page-section">
        <div className="infra-section-head">
          <h2>인프라</h2>
        </div>

        <div className="infra-dashboard-grid">
          {infraPanels.map((panel) => (
            <article
              key={panel.key}
              className={`infra-panel-card ${panel.spanClass} ${panel.sizeClass}`}
            >
              <header className="infra-panel-header">
                <h3>{panel.title}</h3>
              </header>
              <PanelSlot title={panel.title} src={panel.src} />
            </article>
          ))}
        </div>
      </section>
    </DashboardLayout>
  );
}
