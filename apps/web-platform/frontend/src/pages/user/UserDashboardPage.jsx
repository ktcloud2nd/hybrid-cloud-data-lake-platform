import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { fetchUserDashboard } from '../../api/userDashboard';
import { getStoredSession } from '../../utils/authStorage';

const initialState = {
  header: {
    imageUrl: '',
    model: '-',
    vehicleId: '-',
    userName: '-',
    connectionStatus: '-',
    lastUpdated: '-'
  },
  mainStatus: {
    ignition: '-',
    speed: '-',
    fuel: '-',
    driveMode: '-'
  },
  summaryCards: [],
  map: {
    title: 'Vehicle location',
    status: '',
    coordinates: '',
    address: ''
  },
  tripSummary: {
    distance: '-',
    duration: '-',
    averageSpeed: '-',
    destination: '-'
  },
  alerts: []
};

function extractNumber(value) {
  const match = String(value).match(/(\d+(\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

function gaugeStyle(percent, start, end) {
  return {
    background: `conic-gradient(from 180deg at 50% 100%, ${start} 0deg, ${end} ${percent * 1.8}deg, #dbe5f1 ${percent * 1.8}deg, #dbe5f1 180deg, transparent 180deg)`
  };
}

function GaugeCard({ title, percent, value, subtitle, start, end }) {
  return (
    <article className="rounded-[22px] border border-slate-200/90 bg-white/95 p-4 shadow-[0_18px_36px_rgba(64,88,124,0.10)]">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[1rem] font-semibold text-slate-600">{title}</h3>
        <span className="text-[0.86rem] font-bold text-slate-500">{percent}%</span>
      </div>

      <div className="rounded-[16px] border border-slate-100 bg-slate-50/70 px-3 pb-3 pt-1">
        <div className="flex justify-center">
          <div
            className="relative h-[128px] w-[256px] overflow-hidden rounded-t-[256px]"
            style={gaugeStyle(percent, start, end)}
          >
            <div className="absolute inset-x-4 bottom-0 top-4 rounded-t-[220px] bg-gradient-to-b from-white to-slate-50">
              <div className="flex h-full flex-col items-center justify-center pt-7 text-center">
                <strong className="text-[1.9rem] font-extrabold tracking-[-0.04em] text-slate-800">
                  {value}
                </strong>
                <p className="mt-1.5 text-[0.9rem] font-medium text-slate-500">{subtitle}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="-mt-1 flex items-center justify-between px-4 text-[0.8rem] font-semibold text-slate-400">
          <span>0</span>
          <span>100</span>
        </div>

        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full"
            style={{
              width: `${percent}%`,
              background: `linear-gradient(90deg, ${start} 0%, ${end} 100%)`
            }}
          />
        </div>

        <div className="mt-2 flex items-center justify-between text-[0.78rem] font-semibold text-slate-400">
          <span>Low</span>
          <span>High</span>
        </div>
      </div>
    </article>
  );
}

function GeomapPanel({ status, coordinates, address, className = '' }) {
  const [lat, lng] = String(coordinates)
    .split(',')
    .map((value) => Number.parseFloat(value.trim()));
  const hasValidCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const query = hasValidCoords ? `${lat},${lng}` : encodeURIComponent(address);
  const mapSrc = `https://www.google.com/maps?q=${query}&z=13&output=embed`;

  return (
    <div
      className={`flex h-full min-h-[360px] flex-col overflow-hidden rounded-[22px] border border-slate-700/90 bg-[#0e1420] shadow-[0_16px_32px_rgba(8,15,31,0.28)] ${className}`}
    >
      <div className="flex items-center justify-between border-b border-slate-700/90 px-4 py-2.5">
        <h3 className="text-[0.98rem] font-semibold text-slate-100">Geomap</h3>
        <span className="text-[0.82rem] font-bold text-sky-300">{status}</span>
      </div>

      <div className="relative flex-1 bg-slate-200">
        <iframe
          title="Google Maps Vehicle Location"
          src={mapSrc}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>

      <div className="border-t border-slate-700/90 bg-[#0e1420] px-4 py-3">
        <strong className="block text-[1rem] font-bold text-slate-100">
          {coordinates}
        </strong>
        <p className="mt-1 text-[0.92rem] font-medium text-slate-300">{address}</p>
      </div>
    </div>
  );
}

function InfoCard({ title, children }) {
  return (
    <article className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_24px_48px_rgba(64,88,124,0.10)]">
      <h3 className="mb-4 text-[1.18rem] font-bold text-slate-800">{title}</h3>
      {children}
    </article>
  );
}

function UserDashboardPage() {
  const session = getStoredSession();
  const userId = session?.user?.userId || '';
  const [dashboard, setDashboard] = useState(initialState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      if (!userId) {
        setError('User session is missing.');
        setLoading(false);
        return;
      }

      try {
        const response = await fetchUserDashboard();

        if (cancelled) {
          return;
        }

        setDashboard(response);
        setError('');
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setError(loadError.message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDashboard();
    const intervalId = window.setInterval(loadDashboard, 30 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [userId]);

  const speedPercent = useMemo(
    () =>
      Math.min(
        Math.round((extractNumber(dashboard.mainStatus.speed) / 180) * 100),
        100
      ),
    [dashboard.mainStatus.speed]
  );
  const fuelPercent = useMemo(
    () => Math.min(Math.round(extractNumber(dashboard.mainStatus.fuel)), 100),
    [dashboard.mainStatus.fuel]
  );
  const latestAlert = dashboard.alerts[0] ?? null;

  return (
    <DashboardLayout
      role="USER"
      userId={dashboard.header.userName || session?.user?.userName}
      title="User Dashboard"
      hideIntro
    >
      {loading ? (
        <div className="grid min-h-[60vh] place-items-center text-[1.05rem] text-slate-600">
          Loading vehicle dashboard...
        </div>
      ) : null}

      {error && !loading ? (
        <div className="grid min-h-[60vh] place-items-center text-[1.05rem] text-rose-500">
          {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="min-h-full bg-[radial-gradient(circle_at_15%_20%,rgba(215,226,244,0.95),transparent_35%),linear-gradient(180deg,#eef3fb_0%,#f6f8fc_46%,#edf2f8_100%)] text-slate-900 -mx-10 -mt-7 px-[18px] py-7 md:px-[22px] md:pb-10">
          <section>
            <h1 className="text-[clamp(2rem,4vw,3rem)] font-extrabold tracking-[-0.04em] text-slate-900">
              Vehicle Dashboard
            </h1>
            <p className="mt-2 text-[1rem] font-semibold text-slate-500">
              Last updated {dashboard.header.lastUpdated}
            </p>
            <p className="mt-1 text-[1.42rem] font-bold text-slate-600">
              {dashboard.header.userName}, here is your latest vehicle status.
            </p>
          </section>

          <section className="mb-7 mt-7 grid grid-cols-1 gap-[14px] xl:grid-cols-[minmax(0,1.7fr)_minmax(360px,0.9fr)]">
            <article className="rounded-[28px] border border-slate-200/80 bg-white/90 p-4 shadow-[0_24px_48px_rgba(64,88,124,0.10)]">
              <div className="grid grid-cols-1 gap-1 lg:grid-cols-[620px_1fr]">
                <div className="flex h-full flex-col justify-between overflow-visible rounded-[22px] bg-white">
                  <div>
                    <h2 className="text-[clamp(2.2rem,4vw,3.6rem)] font-extrabold tracking-[-0.04em] text-slate-900">
                      {dashboard.header.model}
                    </h2>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[1.02rem] font-semibold text-slate-500">
                      <span>Vehicle ID {dashboard.header.vehicleId}</span>
                    </div>
                  </div>
                  <div className="mt-2 flex min-h-[470px] items-end justify-start">
                    <img
                      src={dashboard.header.imageUrl}
                      alt={dashboard.header.model}
                      className="relative left-[-18px] block w-[720px] max-w-none object-contain drop-shadow-[0_38px_56px_rgba(19,31,50,0.24)]"
                    />
                  </div>
                </div>

                <GeomapPanel
                  status={dashboard.map.status}
                  coordinates={dashboard.map.coordinates}
                  address={dashboard.map.address}
                  className="justify-self-end lg:ml-[-36px] lg:w-[78%]"
                />
              </div>
            </article>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-2">
              <GaugeCard
                title="Speed"
                percent={speedPercent}
                value={dashboard.mainStatus.speed}
                subtitle="Current vehicle speed"
                start="#f8d06f"
                end="#ef7d32"
              />

              <GaugeCard
                title="Fuel"
                percent={fuelPercent}
                value={dashboard.mainStatus.fuel}
                subtitle="Remaining fuel level"
                start="#7ddf8f"
                end="#2dad54"
              />

              <article className="rounded-[22px] border border-slate-200/90 bg-white/95 p-4 shadow-[0_18px_36px_rgba(64,88,124,0.10)]">
                <h3 className="text-[1rem] font-semibold text-slate-600">
                  Drive mode
                </h3>
                <strong className="mt-8 block text-[2rem] font-extrabold tracking-[-0.04em] text-slate-800">
                  {dashboard.mainStatus.driveMode}
                </strong>
                <p className="mt-3 text-[0.96rem] font-medium text-slate-500">
                  Current vehicle operation mode
                </p>
              </article>

              <article className="rounded-[22px] border border-slate-200/90 bg-white/95 p-4 shadow-[0_18px_36px_rgba(64,88,124,0.10)]">
                <h3 className="text-[1rem] font-semibold text-slate-600">
                  Ignition
                </h3>
                <strong className="mt-8 block text-[2rem] font-extrabold tracking-[-0.04em] text-slate-800">
                  {dashboard.mainStatus.ignition}
                </strong>
                <p className="mt-3 text-[0.96rem] font-medium text-slate-500">
                  Current engine power state
                </p>
              </article>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <InfoCard title="Trip Summary">
              <dl className="grid gap-3">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[1rem] font-semibold text-slate-500">
                    Distance
                  </dt>
                  <dd className="text-[1rem] font-bold text-slate-800">
                    {dashboard.tripSummary.distance}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[1rem] font-semibold text-slate-500">
                    Duration
                  </dt>
                  <dd className="text-[1rem] font-bold text-slate-800">
                    {dashboard.tripSummary.duration}
                  </dd>
                </div>
              </dl>
            </InfoCard>

            <InfoCard title="Average Speed">
              <strong className="block text-[1.5rem] font-extrabold text-slate-800">
                {dashboard.tripSummary.averageSpeed}
              </strong>
              <p className="mt-2 text-[1rem] text-slate-500">
                Average speed for recent trips
              </p>
            </InfoCard>

            <InfoCard title="Location Status">
              <strong className="block text-[1.5rem] font-extrabold text-slate-800">
                {dashboard.summaryCards[2]?.value ?? '-'}
              </strong>
              <p className="mt-2 text-[1rem] text-slate-500">
                {dashboard.map.address}
              </p>
            </InfoCard>

            <InfoCard title="Recent Signal">
              <strong className="block text-[1.5rem] font-extrabold text-slate-800">
                {dashboard.summaryCards[3]?.value ?? '-'}
              </strong>
              <p className="mt-2 text-[1rem] text-slate-500">
                {dashboard.map.coordinates}
              </p>
            </InfoCard>

            <InfoCard title="Alert Center">
              <ul className="grid gap-3">
                {dashboard.alerts.slice(0, 2).map((alert) => (
                  <li
                    key={alert.id}
                    className="flex items-center justify-between gap-4 text-[1rem] text-slate-600"
                  >
                    <strong className="text-[1rem] font-semibold text-slate-800">
                      {alert.title}
                    </strong>
                    <span>{alert.time}</span>
                  </li>
                ))}
              </ul>
            </InfoCard>

            <InfoCard title="Destination">
              <strong className="block text-[1.5rem] font-extrabold text-slate-800">
                {dashboard.tripSummary.destination}
              </strong>
              <p className="mt-2 text-[1rem] text-slate-500">
                Latest recorded destination
              </p>
            </InfoCard>

            <InfoCard title="User & Vehicle">
              <dl className="grid gap-3">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[1rem] font-semibold text-slate-500">
                    User
                  </dt>
                  <dd className="text-[1rem] font-bold text-slate-800">
                    {dashboard.header.userName}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[1rem] font-semibold text-slate-500">
                    Vehicle ID
                  </dt>
                  <dd className="text-[1rem] font-bold text-slate-800">
                    {dashboard.header.vehicleId}
                  </dd>
                </div>
              </dl>
            </InfoCard>

            <InfoCard title="Latest Alert">
              <strong className="block text-[1.5rem] font-extrabold text-slate-800">
                {latestAlert?.title ?? '-'}
              </strong>
              <p className="mt-2 text-[1rem] text-slate-500">
                {latestAlert?.message ?? '-'}
              </p>
            </InfoCard>
          </section>
        </div>
      ) : null}
    </DashboardLayout>
  );
}

export default UserDashboardPage;
