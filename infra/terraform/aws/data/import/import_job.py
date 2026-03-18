import csv
import io
import os
from typing import List, Dict, Optional

import boto3
import psycopg2
from psycopg2.extras import execute_values


AWS_REGION = os.getenv("AWS_REGION", "ap-northeast-2")
S3_BUCKET = os.getenv("S3_BUCKET", "ktcloud2nd-dev-data")

RDS_HOST = os.getenv("RDS_HOST")
RDS_PORT = int(os.getenv("RDS_PORT", "5432"))
RDS_DB = os.getenv("RDS_DB", "vehicle_db")
RDS_USER = os.getenv("RDS_USER", "admin")
RDS_PASSWORD = os.getenv("RDS_PASSWORD")

PREFIX_VEHICLE_STATS = "processed/vehicle_stats/"
PREFIX_RECENT_ALERT = "processed/recent_alert/"
PREFIX_USER_VEHICLE_MAPPING = "processed/user_vehicle_mapping/"


def require_env() -> None:
    required = {
        "RDS_HOST": RDS_HOST,
        "RDS_PASSWORD": RDS_PASSWORD,
    }
    missing = [k for k, v in required.items() if not v]
    if missing:
        raise ValueError(f"필수 환경변수가 없습니다: {', '.join(missing)}")


def get_s3_client():
    return boto3.client("s3", region_name=AWS_REGION)


def get_db_connection():
    return psycopg2.connect(
        host=RDS_HOST,
        port=RDS_PORT,
        dbname=RDS_DB,
        user=RDS_USER,
        password=RDS_PASSWORD,
    )


def get_latest_object_key(s3, prefix: str) -> Optional[str]:
    response = s3.list_objects_v2(Bucket=S3_BUCKET, Prefix=prefix)
    contents = response.get("Contents", [])
    if not contents:
        return None

    latest = max(contents, key=lambda x: x["LastModified"])
    return latest["Key"]


def read_csv_from_s3(s3, key: str) -> List[Dict[str, str]]:
    obj = s3.get_object(Bucket=S3_BUCKET, Key=key)
    content = obj["Body"].read().decode("utf-8")
    reader = csv.DictReader(io.StringIO(content))
    return list(reader)


def import_vehicle_stats(conn, rows: List[Dict[str, str]]) -> None:
    if not rows:
        print("vehicle_stats: 가져올 데이터가 없습니다.")
        return

    values = [
        (
            row["vehicle_id"],
            row["driver_code"],
            row["timestamp"],
            float(row["lat"]),
            float(row["lon"]),
            int(row["speed"]),
            row["engine_on"].lower() == "true",
            float(row["fuel"]),
        )
        for row in rows
    ]

    sql = """
        INSERT INTO vehicle_stats (
            vehicle_id, driver_code, timestamp, lat, lon, speed, engine_on, fuel
        )
        VALUES %s
        ON CONFLICT (vehicle_id)
        DO UPDATE SET
            driver_code = EXCLUDED.driver_code,
            timestamp = EXCLUDED.timestamp,
            lat = EXCLUDED.lat,
            lon = EXCLUDED.lon,
            speed = EXCLUDED.speed,
            engine_on = EXCLUDED.engine_on,
            fuel = EXCLUDED.fuel;
    """

    with conn.cursor() as cur:
        execute_values(cur, sql, values)
    conn.commit()
    print(f"vehicle_stats: {len(values)}건 반영 완료")


def import_recent_alert(conn, rows: List[Dict[str, str]]) -> None:
    if not rows:
        print("recent_alert: 가져올 데이터가 없습니다.")
        return

    values = [
        (
            row["vehicle_id"],
            row["driver_code"],
            row["timestamp"],
            row["alert_type"],
            row["message"],
        )
        for row in rows
    ]

    sql = """
        INSERT INTO recent_alert (
            vehicle_id, driver_code, timestamp, alert_type, message
        )
        VALUES %s;
    """

    with conn.cursor() as cur:
        execute_values(cur, sql, values)
    conn.commit()
    print(f"recent_alert: {len(values)}건 반영 완료")


def import_user_vehicle_mapping(conn, rows: List[Dict[str, str]]) -> None:
    if not rows:
        print("user_vehicle_mapping: 가져올 데이터가 없습니다.")
        return

    values = [
        (
            row["driver_code"],
            row["vehicle_id"],
        )
        for row in rows
    ]

    sql = """
        INSERT INTO user_vehicle_mapping (
            driver_code, vehicle_id
        )
        VALUES %s
        ON CONFLICT (driver_code, vehicle_id)
        DO NOTHING;
    """

    with conn.cursor() as cur:
        execute_values(cur, sql, values)
    conn.commit()
    print(f"user_vehicle_mapping: {len(values)}건 반영 완료")


def main():
    require_env()

    s3 = get_s3_client()

    vehicle_stats_key = get_latest_object_key(s3, PREFIX_VEHICLE_STATS)
    recent_alert_key = get_latest_object_key(s3, PREFIX_RECENT_ALERT)
    user_vehicle_mapping_key = get_latest_object_key(s3, PREFIX_USER_VEHICLE_MAPPING)

    print("가장 최신 파일:")
    print("vehicle_stats:", vehicle_stats_key)
    print("recent_alert:", recent_alert_key)
    print("user_vehicle_mapping:", user_vehicle_mapping_key)

    vehicle_stats_rows = read_csv_from_s3(s3, vehicle_stats_key) if vehicle_stats_key else []
    recent_alert_rows = read_csv_from_s3(s3, recent_alert_key) if recent_alert_key else []
    user_vehicle_mapping_rows = (
        read_csv_from_s3(s3, user_vehicle_mapping_key) if user_vehicle_mapping_key else []
    )

    conn = get_db_connection()
    try:
        import_vehicle_stats(conn, vehicle_stats_rows)
        import_recent_alert(conn, recent_alert_rows)
        import_user_vehicle_mapping(conn, user_vehicle_mapping_rows)
    finally:
        conn.close()


if __name__ == "__main__":
    main()