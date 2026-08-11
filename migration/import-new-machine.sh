#!/usr/bin/env bash
# รันที่ "เครื่องใหม่" (เครื่องนี้) — เอา dump รอบสุดท้ายจากเครื่องเก่ามาทับของเดิม
# ต้องมี backups/coopsmile-final.sql วางไว้ก่อน แล้วเปิด Git Bash รัน:
#   bash migration/import-new-machine.sh
set -euo pipefail

cd "$(dirname "$0")/.."
DUMP=backups/coopsmile-final.sql

[ -f "$DUMP" ] || { echo "!! ไม่เจอ $DUMP — ก๊อปมาจากเครื่องเก่าก่อน" >&2; exit 1; }
grep -q "PostgreSQL database dump complete" "$DUMP" || { echo "!! $DUMP ไม่สมบูรณ์ ก๊อปมาไม่ครบ" >&2; exit 1; }

echo "==> จะลบข้อมูลใน DB เครื่องนี้ทิ้งทั้งหมด แล้วแทนที่ด้วย $DUMP"
read -r -p "    พิมพ์ yes เพื่อไปต่อ: " ans
[ "$ans" = "yes" ] || { echo "ยกเลิก"; exit 1; }

echo "==> [1/5] สตาร์ต db แล้วรอ healthy"
docker compose up -d db
for _ in $(seq 1 60); do
  [ "$(docker inspect -f '{{.State.Health.Status}}' webcoopsmile-db-1 2>/dev/null || true)" = healthy ] && break
  sleep 2
done
[ "$(docker inspect -f '{{.State.Health.Status}}' webcoopsmile-db-1)" = healthy ] || { echo "!! db ไม่ healthy" >&2; exit 1; }

# กันเหนียว เผื่อ dump ใหม่มีปัญหาแล้วอยากถอยกลับ
SAFETY="backups/pre-restore-$(date +%F-%H%M%S).sql"
echo "==> [2/5] สำรองสภาพปัจจุบันไว้ก่อน → $SAFETY"
docker compose exec -T db pg_dump -U coopsmile coopsmile > "$SAFETY"

echo "==> [3/5] ล้าง schema เดิม แล้ว restore ของใหม่"
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U coopsmile -d coopsmile \
  -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U coopsmile coopsmile < "$DUMP"

echo "==> [4/5] แตกไฟล์ uploads (ถ้ามี)"
if [ -f backups/uploads.tar.gz ]; then
  tar -xzf backups/uploads.tar.gz
  echo "    OK $(ls uploads | wc -l) ไฟล์"
else
  echo "    ข้าม — ไม่มี backups/uploads.tar.gz"
fi

echo "==> [5/5] build + สตาร์ต web (migrate deploy จะรันให้เอง) และ db-backup"
docker compose up -d --build web
docker compose up -d db-backup

echo
echo "== ตรวจผล =="
docker compose exec -T db psql -U coopsmile coopsmile \
  -c 'select (select count(*) from "User") as users, (select count(*) from "Announcement") as announcements, (select count(*) from "NewsTicker") as tickers, (select count(*) from "Media") as media;'
docker compose logs migrate --tail 3
curl -s -o /dev/null -w "GET http://localhost:8030/ -> %{http_code}\n" http://localhost:8030/

echo
echo "ถ้าตัวเลขตรงกับเครื่องเก่าและหน้าเว็บขึ้น 200 แล้ว ค่อยเปิดโดเมนเข้าเครื่องนี้:"
echo "   docker compose up -d cloudflared"
echo "(เช็กก่อนว่า cloudflared ที่เครื่องเก่าหยุดแล้วจริง ไม่งั้นทราฟฟิกจะสลับสองเครื่อง)"
