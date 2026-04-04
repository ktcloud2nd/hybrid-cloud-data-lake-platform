import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { fetchUserDashboard } from '../../api/userDashboard';
import { getStoredSession } from '../../utils/authStorage';

const REFRESH_INTERVAL_MS = 1 * 1000; // 주기 상수
const assetBaseUrl = import.meta.env.BASE_URL || '/';
const DEFAULT_WEATHER_COORDS = {
  latitude: 37.5665,
  longitude: 126.978
};

const MODEL_IMAGE_MAP = {
  1: { name: 'Avante', imageUrl: `${assetBaseUrl}models/avante.png` },
  2: { name: 'Grandeur', imageUrl: `${assetBaseUrl}models/grandeur.png` },
  3: { name: 'Santafe', imageUrl: `${assetBaseUrl}models/santafe.png` },
  4: { name: 'Tucson', imageUrl: `${assetBaseUrl}models/tucson.png` }
};

const WEATHER_LABELS = {
  0: 'Clear',
  1: 'Mostly Clear',
  2: 'Partly Cloudy',
  3: 'Cloudy',
  45: 'Fog',
  48: 'Rime Fog',
  51: 'Light Drizzle',
  53: 'Drizzle',
  55: 'Heavy Drizzle',
  61: 'Light Rain',
  63: 'Rain',
  65: 'Heavy Rain',
  71: 'Light Snow',
  73: 'Snow',
  75: 'Heavy Snow',
  80: 'Rain Showers',
  81: 'Rain Showers',
  82: 'Heavy Showers',
  95: 'Thunderstorm'
};

function getWeatherIcon(code, isDay) {
  if (code === 0) {
    return isDay ? '\u2600\uFE0F' : '\uD83C\uDF19';
  }
  if ([1, 2].includes(code)) {
    return isDay ? '\u26C5' : '\u2601\uFE0F';
  }
  if ([3, 45, 48].includes(code)) {
    return '\u2601\uFE0F';
  }
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) {
    return '\uD83C\uDF27\uFE0F';
  }
  if ([71, 73, 75].includes(code)) {
    return '\u2744\uFE0F';
  }
  if (code === 95) {
    return '\u26C8\uFE0F';
  }
  return '\uD83C\uDF24\uFE0F';
}

async function getLocationLabel(latitude, longitude) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
    );

    if (!response.ok) {
      return 'Seoul';
    }

    const data = await response.json();
    const address = data.address || {};

    return (
      address.suburb ||
      address.city_district ||
      address.neighbourhood ||
      address.town ||
      address.city ||
      'Seoul'
    );
  } catch {
    return 'Seoul';
  }
}

function formatMetric(value, unit = '', digits = 0) {
  if (!Number.isFinite(Number(value))) {
    return '-';
  }

  return `${Number(value).toFixed(digits)}${unit}`;
}

function formatDateTime(timestamp) {
  if (!timestamp) {
    return '-';
  }

  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${month}.${day} ${hours}:${minutes}`;
}

function formatTimeLabel(timestamp) {
  if (!timestamp) {
    return '--:--';
  }

  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
}

function buildTimeAxisLabels(series, count = 4) {
  if (!series.length) {
    return [];
  }

  return Array.from({ length: count }, (_, index) => {
    const position = count === 1 ? 0 : index / (count - 1);
    const seriesIndex = Math.min(
      Math.round(position * Math.max(series.length - 1, 0)),
      series.length - 1
    );

    return formatTimeLabel(series[seriesIndex]?.timestamp);
  });
}

function buildValueAxisLabels(series, formatter) {
  if (!series.length) {
    return ['-', '-', '-'];
  }

  const values = series.map((item) => Number(item.value || 0));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const midpoint = (max + min) / 2;

  return [formatter(max), formatter(midpoint), formatter(min)];
}

function buildLinePath(points, width, height) {
  if (points.length === 0) {
    return '';
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - ((point.value - min) / range) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function buildAreaPath(points, width, height) {
  if (points.length === 0) {
    return '';
  }

  const linePath = buildLinePath(points, width, height);
  return `${linePath} L ${width} ${height} L 0 ${height} Z`;
}


function buildRoutePath(route, width, height) {
  if (route.length === 0) {
    return '';
  }

  const lats = route.map((point) => point.lat);
  const lons = route.map((point) => point.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const latRange = maxLat - minLat || 1;
  const lonRange = maxLon - minLon || 1;

  return route
    .map((point, index) => {
      const x = ((point.lon - minLon) / lonRange) * width;
      const y = height - ((point.lat - minLat) / latRange) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function buildMapEmbedUrl(lat, lon) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
    return '';
  }

  const latitude = Number(lat);
  const longitude = Number(lon);
  return `https://maps.google.com/maps?q=${latitude.toFixed(6)},${longitude.toFixed(6)}&z=15&output=embed`;
}

function MetricTile({ label, value, accent = 'blue', className = '' }) {
  return (
    <article className={`user-metric-tile accent-${accent} ${className}`.trim()}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function GaugeCard({ title, value, unit, min = 0, max = 100, thresholds = [], digits = 0 }) {
  const numericValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  const clampedValue = Math.min(Math.max(numericValue, min), max);
  const ratio = (clampedValue - min) / Math.max(max - min, 1);
  const circumference = 282.743;
  const progress = circumference * ratio;

  return (
    <article className="card user-gauge-card">
      <h3>{title}</h3>
      <div className="user-gauge-wrap">
        <svg viewBox="0 0 220 140" className="user-gauge-chart" aria-hidden="true">
          <path
            className="user-gauge-track"
            d="M 20 120 A 90 90 0 0 1 200 120"
          />
          {thresholds.map((threshold) => (
            <path
              key={`${title}-${threshold.offset}-${threshold.color}`}
              className="user-gauge-band"
              d="M 20 120 A 90 90 0 0 1 200 120"
              style={{
                stroke: threshold.color,
                strokeDasharray: `${circumference * threshold.span} ${circumference}`,
                strokeDashoffset: circumference * (1 - threshold.offset)
              }}
            />
          ))}
          <path
            className="user-gauge-progress"
            d="M 20 120 A 90 90 0 0 1 200 120"
            style={{ strokeDasharray: `${progress} ${circumference}` }}
          />
        </svg>
        <div className="user-gauge-value">
          <strong>{numericValue.toFixed(digits)}</strong>
          <span>{unit}</span>
        </div>
      </div>
    </article>
  );
}

function EngineStatusCard({ isOn }) {
  return (
    <article className={`card user-gauge-card user-engine-card ${isOn ? 'is-on' : 'is-off'}`}>
      <p className="user-vehicle-eyebrow">엔진 상태</p>
      <div className="user-engine-visual">
        <div className="user-engine-button" aria-hidden="true">
          <span className="user-engine-button-line" />
          <span className="user-engine-button-ring" />
        </div>
      </div>
      <strong>{isOn ? 'ON' : 'OFF'}</strong>
    </article>
  );
}

function SpeedTrendCard({ title, value, series }) {
  const xLabels = useMemo(() => buildTimeAxisLabels(series), [series]);
  const yLabels = useMemo(
    () => buildValueAxisLabels(series, (axisValue) => `${Math.round(axisValue)}`),
    [series]
  );
  const bars = useMemo(() => {
    if (!series.length) {
      return [];
    }

    const source = series.slice(-60).map((item) => Number(item.value || 0));
    const targetCount = 66;
    const interpolated = Array.from({ length: targetCount }, (_, index) => {
      const position = (index / Math.max(targetCount - 1, 1)) * Math.max(source.length - 1, 0);
      const leftIndex = Math.floor(position);
      const rightIndex = Math.min(leftIndex + 1, source.length - 1);
      const mix = position - leftIndex;
      const leftValue = source[leftIndex] ?? 0;
      const rightValue = source[rightIndex] ?? leftValue;

      return leftValue + (rightValue - leftValue) * mix;
    });

    const values = interpolated;
    const max = Math.max(...values, 1);
    const average = values.reduce((sum, current) => sum + current, 0) / values.length;

    return interpolated.map((numericValue, index) => {
      const height = Math.max((numericValue / max) * 132, 12);
      const tone = numericValue >= average ? 'is-strong' : index % 3 === 0 ? 'is-mid' : '';

      return {
        key: `speed-bar-${index}`,
        height,
        tone
      };
    });
  }, [series]);

  return (
    <article className="card user-analytics-card user-speed-chart-card">
      <div className="user-analytics-head">
        <h3>{title}</h3>
        <strong>{value}</strong>
      </div>
      {bars.length ? (
        <div className="user-chart-shell">
          <div className="user-chart-y-axis">
            {yLabels.map((label) => (
              <span key={`${title}-${label}`}>{label}</span>
            ))}
          </div>
          <div className="user-chart-main">
            <div className="user-speed-bars">
              {bars.map((bar) => (
                <span
                  key={bar.key}
                  className={`user-speed-bar ${bar.tone}`.trim()}
                  style={{ height: `${bar.height}px` }}
                />
              ))}
            </div>
            <div className="user-chart-x-axis">
              {xLabels.map((label, index) => (
                <span key={`${title}-x-${index}`}>{label}</span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="user-chart-placeholder">No telemetry yet.</div>
      )}
    </article>
  );
}

function FuelTrendCard({ title, value, series }) {
  const xLabels = useMemo(() => buildTimeAxisLabels(series), [series]);
  const yLabels = useMemo(
    () => buildValueAxisLabels(series, (axisValue) => `${Math.round(axisValue)}`),
    [series]
  );
  const points = useMemo(() => {
    if (!series.length) {
      return [];
    }

    const source = series.slice(-60).map((item) => Number(item.value || 0));
    const targetCount = 72;
    const interpolated = Array.from({ length: targetCount }, (_, index) => {
      const position = (index / Math.max(targetCount - 1, 1)) * Math.max(source.length - 1, 0);
      const leftIndex = Math.floor(position);
      const rightIndex = Math.min(leftIndex + 1, source.length - 1);
      const mix = position - leftIndex;
      const leftValue = source[leftIndex] ?? 0;
      const rightValue = source[rightIndex] ?? leftValue;

      return leftValue + (rightValue - leftValue) * mix;
    });

    return interpolated.map((numericValue) => ({ value: numericValue }));
  }, [series]);
  const linePath = useMemo(() => buildLinePath(points, 420, 188), [points]);
  const areaPath = useMemo(() => buildAreaPath(points, 420, 188), [points]);
  const highlightPoints = useMemo(() => {
    if (points.length === 0) {
      return [];
    }
    const values = points.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    return points
      .filter((_, index) => index % 8 === 0 || index === points.length - 1)
      .map((point, index) => {
        const sourceIndex = points.findIndex((candidate) => candidate === point);
        const x = (sourceIndex / Math.max(points.length - 1, 1)) * 420;
        const y = 188 - ((point.value - min) / range) * 188;

        return { key: `fuel-point-${index}`, x, y };
      });
  }, [points]);

  return (
    <article className="card user-analytics-card user-fuel-chart-card">
      <div className="user-analytics-head">
        <h3>{title}</h3>
        <strong>{value}</strong>
      </div>
      {linePath ? (
        <div className="user-chart-shell">
          <div className="user-chart-y-axis">
            {yLabels.map((label, index) => (
              <span key={`${title}-${label}-${index}`}>{label}</span>
            ))}
          </div>
          <div className="user-chart-main">
            <svg viewBox="0 0 420 216" className="user-line-chart user-line-chart-fuel user-line-chart-fuel-soft" preserveAspectRatio="none">
              <defs>
                <linearGradient id="fuelAreaFill" x1="0%" x2="0%" y1="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(95, 126, 171, 0.32)" />
                  <stop offset="100%" stopColor="#f3f7fe" />
                </linearGradient>
              </defs>
              <path className="user-fuel-area" d={areaPath} fill="url(#fuelAreaFill)" stroke="none" />
              <path className="user-fuel-line" d={linePath} />
              {highlightPoints.map((point) => (
                <circle key={point.key} className="user-fuel-dot" cx={point.x} cy={point.y} r="4.5" />
              ))}
            </svg>
            <div className="user-chart-x-axis">
              {xLabels.map((label, index) => (
                <span key={`${title}-x-${index}`}>{label}</span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="user-chart-placeholder">No telemetry yet.</div>
      )}
    </article>
  );
}

function RouteCard({ route, latest }) {
  const path = useMemo(() => buildRoutePath(route, 240, 160), [route]);
  const mapEmbedUrl = useMemo(
    () => buildMapEmbedUrl(latest?.lat, latest?.lon),
    [latest?.lat, latest?.lon]
  );

  return (
    <article className="card user-gauge-card user-map-card">
      <h3>현재 위치</h3>
      {mapEmbedUrl ? (
        <div className="user-map-frame-wrap">
          <iframe
            title="Current vehicle location"
            src={mapEmbedUrl}
            className="user-map-frame"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      ) : path ? (
        <svg viewBox="0 0 240 160" className="user-route-chart compact" preserveAspectRatio="none">
          <defs>
            <linearGradient id="routeFill" x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#dce9ff" />
              <stop offset="100%" stopColor="#f4f8ff" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="240" height="160" fill="url(#routeFill)" rx="16" />
          <path d={path} />
        </svg>
      ) : (
        <div className="user-chart-placeholder">Location history is not available.</div>
      )}
    </article>
  );
}

function UserDashboardPage() {
  const session = getStoredSession();
  const user = session?.user;
  const vehicleModel = MODEL_IMAGE_MAP[Number(user?.modelCode)] || null;
  const greetingName = user?.userName || 'User';
  const [weather, setWeather] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [dashboardError, setDashboardError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadWeather(latitude, longitude) {
      try {
        const [weatherResponse, locationLabel] = await Promise.all([
          fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,is_day&timezone=auto`
          ),
          getLocationLabel(latitude, longitude)
        ]);

        if (!weatherResponse.ok) {
          return;
        }

        const data = await weatherResponse.json();
        const current = data.current;

        if (!current || cancelled) {
          return;
        }

        setWeather({
          temperature: current.temperature_2m.toFixed(1),
          label: WEATHER_LABELS[current.weather_code] || 'Weather',
          icon: getWeatherIcon(current.weather_code, current.is_day === 1),
          locationLabel
        });
      } catch {
        if (!cancelled) {
          setWeather(null);
        }
      }
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          loadWeather(position.coords.latitude, position.coords.longitude);
        },
        () => {
          loadWeather(DEFAULT_WEATHER_COORDS.latitude, DEFAULT_WEATHER_COORDS.longitude);
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
      );
    } else {
      loadWeather(DEFAULT_WEATHER_COORDS.latitude, DEFAULT_WEATHER_COORDS.longitude);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      if (!user?.vehicleId) {
        setDashboard(null);
        return;
      }

      try {
        const result = await fetchUserDashboard(user.vehicleId);

        if (cancelled) {
         return;
        }

        setDashboard(result.dashboard);
        setDashboardError('');
      } catch (error) {
        if (cancelled) {
         return;
        }

        setDashboard(null);
        setDashboardError(error.message);
      }
    }

    loadDashboard();
    const intervalId = window.setInterval(loadDashboard, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [user?.vehicleId]);


  const metrics = dashboard?.metrics;

  return (
    <DashboardLayout
      role="USER"
      metaContent={
        weather ? (
          <div className="dashboard-meta-line">
            {`${weather.icon} ${weather.temperature}°C · ${weather.locationLabel}`}
          </div>
        ) : null
      }
      title={'내 차량 대시보드'}
      description={`${greetingName}님, 좋은 하루 되세요!`}
    >
      <section className="user-hero-grid">
        {vehicleModel ? (
          <section className="user-vehicle-hero">
            <div className="user-vehicle-card-meta">
              <div>
                <p className="user-vehicle-eyebrow">차량 정보</p>
                <h2>{vehicleModel.name}</h2>
              </div>
            </div>
            <img
              src={vehicleModel.imageUrl}
              alt={vehicleModel.name}
              className="user-vehicle-image"
            />
          </section>
        ) : null}

        <div className="user-top-stats-grid">
          <EngineStatusCard isOn={dashboard?.latest?.engineOn} />
          <GaugeCard
            title="연료 잔량"
            value={metrics?.fuelLevel}
            unit="%"
            thresholds={[
              { offset: 0.65, span: 0.25, color: '#f4c430' },
              { offset: 0.9, span: 0.1, color: '#e63946' }
            ]}
            digits={1}
          />
          <GaugeCard
            title="속도"
            value={metrics?.latestSpeed}
            unit="km/h"
            max={180}
            thresholds={[
              { offset: 0.55, span: 0.25, color: '#f4c430' },
              { offset: 0.8, span: 0.2, color: '#e63946' }
            ]}
            digits={0}
          />
          <MetricTile
            label="업데이트"
            value={formatDateTime(dashboard?.latest?.timestamp)}
            accent="slate"
            className="updated-tile"
          />
          <MetricTile
            label="평균 속도"
            value={formatMetric(metrics?.averageSpeed, ' km/h', 1)}
            accent="blue"
          />
          <MetricTile
            label="주행 거리"
            value={formatMetric(metrics?.distanceKm, ' km', 2)}
            accent="indigo"
          />
        </div>

        <RouteCard route={dashboard?.route || []} latest={dashboard?.latest} />
      </section>

      {dashboardError ? <div className="auth-message error">{dashboardError}</div> : null}

      <section className="user-telemetry-layout">
        <div className="user-analytics-grid user-analytics-grid-wide">
          <SpeedTrendCard
            title="속도 추이"
            value={`최고 속도 ${formatMetric(metrics?.maxSpeed, ' km/h')}`}
            series={dashboard?.series?.speed || []}
          />
          <FuelTrendCard
            title="연료 추이"
            value={formatMetric(metrics?.fuelLevel, '%', 1)}
            series={dashboard?.series?.fuelLevel || []}
          />
          <article className="card user-records-card">
            <div className="user-analytics-head">
              <h3>최근 차량 데이터</h3>
              <strong>{formatMetric(metrics?.sampleCount, '')}</strong>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Speed</th>
                    <th>Fuel</th>
                    <th>Engine</th>
                    <th>Event</th>
                    <th>Mode</th>
                  </tr>
                </thead>
                <tbody>
                  {(dashboard?.recentRecords || []).length > 0 ? (
                    dashboard.recentRecords.slice(0, 5).map((record) => (
                      <tr key={`${record.timestamp}-${record.eventType}-${record.mode}`}>
                        <td>{formatDateTime(record.timestamp)}</td>
                        <td>{formatMetric(record.speed, ' km/h')}</td>
                        <td>{formatMetric(record.fuelLevel, '%', 1)}</td>
                        <td>{record.engineOn ? 'ON' : 'OFF'}</td>
                        <td>{record.eventType ?? '-'}</td>
                        <td>{record.mode ?? '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6">No telemetry data found for this vehicle.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      </section>
    </DashboardLayout>
  );
}

export default UserDashboardPage;
