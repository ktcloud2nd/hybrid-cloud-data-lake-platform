# Import Spec

## Purpose

이 문서는 인프라 3이 확정해야 할 `S3 -> RDS import` 흐름의 초안 문서입니다. 현재는 네트워크/저장소 경계가 어긋나지 않도록 최소 기준만 정리합니다.

## Data Flow

1. 상류 처리 구간에서 정제/익명화 파일 생성
2. AWS S3 버킷 업로드
3. Import Job이 S3 파일을 읽어 RDS serving table 갱신
4. Dashboard/API는 RDS만 조회

## Serving Tables

현재 문서 기준으로 대시보드가 읽을 핵심 테이블은 아래 3개입니다.

| Table | Purpose |
| --- | --- |
| `vehicle_stats` | 차량 현재 상태/요약 |
| `recent_alert` | 최근 경고/이상 탐지 이력 |
| `user_vehicle_mapping` | 사용자-차량 매핑 |

## Recommended File Contract

RDS import 단순화를 위해 1차 초안은 CSV 기준으로 잡습니다.

| Item | Draft |
| --- | --- |
| File format | `csv` |
| Encoding | `utf-8` |
| Partition key | 날짜 또는 시간대 |
| Upload path example | `s3://<bucket>/serving/date=YYYY-MM-DD/<table>.csv` |
| Import mode | 주기적 마이크로배치 |

## Items To Finalize

- 버킷명/폴더명 규칙
- CSV vs JSON 최종 선택
- 컬럼 정의와 nullable 여부
- 중복 반영 방지 방식
- 실패 시 재처리 절차
