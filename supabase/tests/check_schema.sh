#!/usr/bin/env bash
# ============================================================
# schema.sql 이 "마이그레이션을 차례로 실행한 운영 DB"와 같은 구조인지 검사하고,
# 보안·데이터 동작 테스트(db_tests.sql)를 돌립니다.
#
# 필요한 것: 로컬 Postgres (psql로 접속 가능, 데이터베이스를 만들 권한)
#   PGHOST / PGUSER 등 환경변수로 접속 정보를 넘기면 됩니다.
# 실행: bash supabase/tests/check_schema.sh
#
# 실제 Supabase 프로젝트가 아니라 로컬 테스트 DB 두 개(moa_fresh, moa_migrated)를 만들었다가 지웁니다.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

PSQL=(psql -X -q -v ON_ERROR_STOP=1)
FRESH=moa_fresh
MIGRATED=moa_migrated
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"; for db in $FRESH $MIGRATED; do psql -X -q -c "drop database if exists $db" >/dev/null 2>&1 || true; done' EXIT

for db in $FRESH $MIGRATED; do
  psql -X -q -c "drop database if exists $db" >/dev/null
  psql -X -q -c "create database $db" >/dev/null
  "${PSQL[@]}" -d "$db" -f tests/supabase_stub.sql 2>/dev/null
done

# 1) 새 프로젝트: schema.sql 하나만
"${PSQL[@]}" -d $FRESH -f schema.sql 2>"$TMP/fresh.err" || { cat "$TMP/fresh.err"; exit 1; }

# 2) 운영 DB가 거쳐온 길: 008 직전 schema + 마이그레이션 (017 cron은 Supabase 전용 확장이 필요해서 제외)
"${PSQL[@]}" -d $MIGRATED -f tests/legacy_schema.sql 2>/dev/null
for f in migrations/0*.sql; do
  case "$f" in *017_*) continue ;; esac
  "${PSQL[@]}" -d $MIGRATED -f "$f" 2>"$TMP/migrate.err" || { echo "실패: $f"; cat "$TMP/migrate.err"; exit 1; }
done

# 3) 구조 비교 (not valid 표시는 "기존 행은 검사 안 함"이라는 차이일 뿐이라 지움)
for db in $FRESH $MIGRATED; do
  psql -X -d "$db" -f tests/catalog.sql | sed 's/ NOT VALID$//' > "$TMP/$db.txt"
done
if ! diff -u "$TMP/$MIGRATED.txt" "$TMP/$FRESH.txt"; then
  echo "❌ schema.sql 과 마이그레이션 결과가 다릅니다 (위: - 마이그레이션 / + schema.sql)"
  exit 1
fi
echo "✅ schema.sql 과 마이그레이션 결과가 같습니다 ($(wc -l < "$TMP/$FRESH.txt")개 항목)"

# 4) 동작 테스트 (두 DB 모두)
for db in $FRESH $MIGRATED; do
  "${PSQL[@]}" -d "$db" -f tests/db_tests.sql -o /dev/null
done
echo "✅ DB 동작 테스트 통과"
