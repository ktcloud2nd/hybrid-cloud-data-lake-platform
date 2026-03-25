import math
import os
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional, Sequence

import psycopg2
from psycopg2.extras import RealDictCursor, execute_values


RDS_HOST = os.getenv("RDS_HOST")
RDS_PORT = int(os.getenv("RDS_PORT", "5432"))
RDS_DB = os.getenv("RDS_DB", "vehicle_db")
RDS_USER = os.getenv("RDS_USER", "dbadmin")
RDS_PASSWORD = os.getenv("RDS_PASSWORD")

LOW_FUEL_THRESHOLD = float(os.getenv("LOW_FUEL_THRESHOLD", "10"))
MISSING_DATA_SECONDS = int(os.getenv("MISSING_DATA_SECONDS", os.getenv("STALE_DATA_SECONDS", "600")))
DATA_FLOOD_WINDOW_SECONDS = int(os.getenv("DATA_FLOOD_WINDOW_SECONDS", "5"))
DATA_FLOOD_COUNT_THRESHOLD = int(os.getenv("DATA_FLOOD_COUNT_THRESHOLD", "5"))
RAPID_ACCEL_DELTA = float(os.getenv("RAPID_ACCEL_DELTA", "30"))
RAPID_ACCEL_WINDOW_SECONDS = int(os.getenv("RAPID_ACCEL_WINDOW_SECONDS", "10"))
RAPID_BRAKE_DELTA = float(os.getenv("RAPID_BRAKE_DELTA", "30"))
RAPID_BRAKE_WINDOW_SECONDS = int(os.getenv("RAPID_BRAKE_WINDOW_SECONDS", "10"))
TELEPORT_SPEED_THRESHOLD_KMH = float(os.getenv("TELEPORT_SPEED_THRESHOLD_KMH", "500"))


@dataclass
class AnomalyEvent:
    vehicle_id: str
    anomaly_type: str
    severity: str
    message: str
    detected_at: datetime
    source_timestamp: Optional[datetime] = None
    driver_value: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    value_current: Optional[float] = None
    value_previous: Optional[float] = None
    threshold_value: Optional[float] = None


def require_env() -> None:
    required = {
        "RDS_HOST": RDS_HOST,
        "RDS_PASSWORD": RDS_PASSWORD,
    }
    missing = [key for key, value in required.items() if not value]
    if missing:
        raise ValueError(f"Missing required environment variables: {', '.join(missing)}")


def get_db_connection():
    return psycopg2.connect(
        host=RDS_HOST,
        port=RDS_PORT,
        dbname=RDS_DB,
        user=RDS_USER,
        password=RDS_PASSWORD,
    )


def table_exists(conn, table_name: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = %s
            )
            """,
            (table_name,),
        )
        return bool(cur.fetchone()[0])


def get_table_columns(conn, table_name: str) -> Sequence[str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = %s
            ORDER BY ordinal_position
            """,
            (table_name,),
        )
        return [row[0] for row in cur.fetchall()]


def fetch_all(conn, query: str, params: Optional[Sequence[Any]] = None) -> List[Dict[str, Any]]:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(query, params or ())
        return list(cur.fetchall())


def detect_driver_field(row: Dict[str, Any]) -> Optional[str]:
    return row.get("driver_id") or row.get("driver_code")


def pick_timestamp(row: Dict[str, Any]) -> Optional[datetime]:
    value = (
        row.get("server_timestamp")
        or row.get("timestamp")
        or row.get("event_ts")
        or row.get("event_bucket")
        or row.get("latest_alert_at")
    )
    if value is None:
        return None

    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value

    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc)

    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                return parsed.replace(tzinfo=timezone.utc)
            return parsed
        except ValueError:
            return None

    return None


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_km = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return radius_km * c


def detect_low_fuel_events(rows: Iterable[Dict[str, Any]], detected_at: datetime) -> List[AnomalyEvent]:
    events: List[AnomalyEvent] = []
    for row in rows:
        fuel = row.get("fuel")
        if fuel is None or float(fuel) > LOW_FUEL_THRESHOLD:
            continue

        events.append(
            AnomalyEvent(
                vehicle_id=row["vehicle_id"],
                anomaly_type="low_fuel",
                severity="warning",
                message=f"Fuel dropped below threshold: {fuel}",
                detected_at=detected_at,
                source_timestamp=pick_timestamp(row),
                driver_value=detect_driver_field(row),
                lat=row.get("lat"),
                lon=row.get("lon"),
                value_current=float(fuel),
                threshold_value=LOW_FUEL_THRESHOLD,
            )
        )
    return events


def detect_missing_data_events(rows: Iterable[Dict[str, Any]], detected_at: datetime) -> List[AnomalyEvent]:
    events: List[AnomalyEvent] = []
    stale_cutoff = detected_at - timedelta(seconds=MISSING_DATA_SECONDS)

    for row in rows:
        last_seen = pick_timestamp(row)
        if not last_seen or last_seen >= stale_cutoff:
            continue

        age_seconds = int((detected_at - last_seen).total_seconds())
        events.append(
            AnomalyEvent(
                vehicle_id=row["vehicle_id"],
                anomaly_type="missing_data",
                severity="critical",
                message=f"No data received for {age_seconds} seconds",
                detected_at=detected_at,
                source_timestamp=last_seen,
                driver_value=detect_driver_field(row),
                lat=row.get("lat"),
                lon=row.get("lon"),
                value_current=float(age_seconds),
                threshold_value=float(MISSING_DATA_SECONDS),
            )
        )
    return events


def detect_history_based_events(conn, detected_at: datetime) -> List[AnomalyEvent]:
    if not table_exists(conn, "vehicle_telemetry_history"):
        print("vehicle_telemetry_history table not found. Skipping history-based anomalies.")
        return []

    columns = set(get_table_columns(conn, "vehicle_telemetry_history"))
    required = {"vehicle_id", "speed", "lat", "lon"}
    if not required.issubset(columns) or not ({"timestamp", "server_timestamp"} & columns):
        print("vehicle_telemetry_history schema is missing required columns. Skipping history-based anomalies.")
        return []

    driver_expr = "driver_id" if "driver_id" in columns else "driver_code" if "driver_code" in columns else "NULL"
    ts_expr = "server_timestamp" if "server_timestamp" in columns else "timestamp"

    rows = fetch_all(
        conn,
        f"""
        SELECT *
        FROM (
            SELECT
                vehicle_id,
                {driver_expr} AS driver_value,
                speed,
                lat,
                lon,
                {ts_expr} AS event_ts,
                ROW_NUMBER() OVER (PARTITION BY vehicle_id ORDER BY {ts_expr} DESC) AS rn
            FROM vehicle_telemetry_history
            WHERE {ts_expr} >= %s
        ) ranked
        WHERE rn <= 2
        ORDER BY vehicle_id, rn
        """,
        (detected_at - timedelta(minutes=30),),
    )

    grouped: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for row in rows:
        grouped[row["vehicle_id"]].append(row)

    events: List[AnomalyEvent] = []
    for vehicle_id, pair in grouped.items():
        if len(pair) < 2:
            continue

        latest, previous = pair[0], pair[1]
        latest_ts = pick_timestamp(latest)
        previous_ts = pick_timestamp(previous)
        if not latest_ts or not previous_ts:
            continue

        delta_seconds = max((latest_ts - previous_ts).total_seconds(), 1)
        speed_now = float(latest["speed"])
        speed_before = float(previous["speed"])
        speed_delta = speed_now - speed_before

        if delta_seconds <= RAPID_ACCEL_WINDOW_SECONDS and speed_delta >= RAPID_ACCEL_DELTA:
            events.append(
                AnomalyEvent(
                    vehicle_id=vehicle_id,
                    anomaly_type="rapid_acceleration",
                    severity="warning",
                    message=f"Speed increased by {speed_delta:.1f} within {delta_seconds:.1f}s",
                    detected_at=detected_at,
                    source_timestamp=latest_ts,
                    driver_value=latest.get("driver_value"),
                    lat=latest.get("lat"),
                    lon=latest.get("lon"),
                    value_current=speed_now,
                    value_previous=speed_before,
                    threshold_value=RAPID_ACCEL_DELTA,
                )
            )

        if delta_seconds <= RAPID_BRAKE_WINDOW_SECONDS and (speed_before - speed_now) >= RAPID_BRAKE_DELTA:
            events.append(
                AnomalyEvent(
                    vehicle_id=vehicle_id,
                    anomaly_type="rapid_braking",
                    severity="warning",
                    message=f"Speed dropped by {speed_before - speed_now:.1f} within {delta_seconds:.1f}s",
                    detected_at=detected_at,
                    source_timestamp=latest_ts,
                    driver_value=latest.get("driver_value"),
                    lat=latest.get("lat"),
                    lon=latest.get("lon"),
                    value_current=speed_now,
                    value_previous=speed_before,
                    threshold_value=RAPID_BRAKE_DELTA,
                )
            )

        distance_km = haversine_km(
            float(previous["lat"]),
            float(previous["lon"]),
            float(latest["lat"]),
            float(latest["lon"]),
        )
        speed_kmh = distance_km / (delta_seconds / 3600)
        if speed_kmh >= TELEPORT_SPEED_THRESHOLD_KMH:
            events.append(
                AnomalyEvent(
                    vehicle_id=vehicle_id,
                    anomaly_type="gps_teleport",
                    severity="critical",
                    message=f"Implied speed reached {speed_kmh:.1f} km/h",
                    detected_at=detected_at,
                    source_timestamp=latest_ts,
                    driver_value=latest.get("driver_value"),
                    lat=latest.get("lat"),
                    lon=latest.get("lon"),
                    value_current=speed_kmh,
                    threshold_value=TELEPORT_SPEED_THRESHOLD_KMH,
                )
            )

    return events


def detect_data_flood_events(conn, detected_at: datetime) -> List[AnomalyEvent]:
    if not table_exists(conn, "vehicle_telemetry_history"):
        print("vehicle_telemetry_history table not found. Skipping data flood anomalies.")
        return []

    columns = set(get_table_columns(conn, "vehicle_telemetry_history"))
    if "vehicle_id" not in columns or not ({"timestamp", "server_timestamp"} & columns):
        print("vehicle_telemetry_history schema is missing required columns. Skipping data flood anomalies.")
        return []

    driver_expr = "driver_id" if "driver_id" in columns else "driver_code" if "driver_code" in columns else "NULL"
    ts_expr = "server_timestamp" if "server_timestamp" in columns else "timestamp"

    rows = fetch_all(
        conn,
        f"""
        SELECT
            vehicle_id,
            {driver_expr} AS driver_value,
            date_trunc('second', {ts_expr}) AS event_bucket,
            COUNT(*) AS message_count
        FROM vehicle_telemetry_history
        WHERE {ts_expr} >= %s
        GROUP BY vehicle_id, {driver_expr}, date_trunc('second', {ts_expr})
        HAVING COUNT(*) >= %s
        ORDER BY event_bucket DESC
        """,
        (
            detected_at - timedelta(seconds=DATA_FLOOD_WINDOW_SECONDS),
            DATA_FLOOD_COUNT_THRESHOLD,
        ),
    )

    events: List[AnomalyEvent] = []
    for row in rows:
        bucket_ts = pick_timestamp(row)
        events.append(
            AnomalyEvent(
                vehicle_id=row["vehicle_id"],
                anomaly_type="data_flood",
                severity="critical",
                message=(
                    f"{row['message_count']} messages detected within the same second "
                    f"inside the last {DATA_FLOOD_WINDOW_SECONDS} seconds"
                ),
                detected_at=detected_at,
                source_timestamp=bucket_ts,
                driver_value=row.get("driver_value"),
                value_current=float(row["message_count"]),
                threshold_value=float(DATA_FLOOD_COUNT_THRESHOLD),
            )
        )
    return events


def fetch_vehicle_rows(conn) -> List[Dict[str, Any]]:
    if not table_exists(conn, "vehicle_stats"):
        raise RuntimeError("vehicle_stats table was not found.")
    return fetch_all(conn, "SELECT * FROM vehicle_stats")


def ensure_anomaly_table(conn) -> Sequence[str]:
    if not table_exists(conn, "anomaly_events"):
        raise RuntimeError("anomaly_events table was not found.")
    return get_table_columns(conn, "anomaly_events")


def event_to_row(event: AnomalyEvent, columns: Sequence[str]) -> Dict[str, Any]:
    row: Dict[str, Any] = {
        "vehicle_id": event.vehicle_id,
        "anomaly_type": event.anomaly_type,
        "severity": event.severity,
        "message": event.message,
        "detected_at": event.detected_at,
        "source_timestamp": event.source_timestamp,
        "lat": event.lat,
        "lon": event.lon,
        "value_current": event.value_current,
        "value_previous": event.value_previous,
        "threshold_value": event.threshold_value,
    }

    if "driver_id" in columns:
        row["driver_id"] = event.driver_value
    if "driver_code" in columns:
        row["driver_code"] = event.driver_value

    return {key: value for key, value in row.items() if key in columns}


def upsert_anomaly_events(conn, events: Sequence[AnomalyEvent]) -> None:
    if not events:
        print("No anomaly events detected.")
        return

    columns = ensure_anomaly_table(conn)
    insert_columns = [
        col
        for col in (
            "vehicle_id",
            "driver_id",
            "driver_code",
            "anomaly_type",
            "severity",
            "message",
            "detected_at",
            "source_timestamp",
            "lat",
            "lon",
            "value_current",
            "value_previous",
            "threshold_value",
        )
        if col in columns
    ]

    values = [
        tuple(event_to_row(event, insert_columns).get(col) for col in insert_columns)
        for event in events
    ]

    update_columns = [col for col in insert_columns if col not in {"vehicle_id", "anomaly_type", "source_timestamp"}]
    on_conflict = ""
    if {"vehicle_id", "anomaly_type", "source_timestamp"}.issubset(columns):
        assignments = ", ".join(f"{col} = EXCLUDED.{col}" for col in update_columns)
        on_conflict = (
            " ON CONFLICT (vehicle_id, anomaly_type, source_timestamp)"
            + (f" DO UPDATE SET {assignments}" if assignments else " DO NOTHING")
        )

    sql = f"""
        INSERT INTO anomaly_events ({", ".join(insert_columns)})
        VALUES %s
        {on_conflict}
    """

    with conn.cursor() as cur:
        execute_values(cur, sql, values)
    conn.commit()
    print(f"Inserted or updated {len(events)} anomaly events.")


def main() -> None:
    require_env()
    detected_at = datetime.now(timezone.utc)

    conn = get_db_connection()
    try:
        vehicle_rows = fetch_vehicle_rows(conn)

        events: List[AnomalyEvent] = []
        events.extend(detect_low_fuel_events(vehicle_rows, detected_at))
        events.extend(detect_missing_data_events(vehicle_rows, detected_at))
        events.extend(detect_history_based_events(conn, detected_at))
        events.extend(detect_data_flood_events(conn, detected_at))

        upsert_anomaly_events(conn, events)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
