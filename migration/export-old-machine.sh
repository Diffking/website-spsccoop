#!/usr/bin/env bash
# รันที่ "เครื่องเก่า" — dump ฐานข้อมูลรอบสุดท้าย + ห่อ uploads แล้วปิดสแตก
# วางไฟล์นี้ไว้ใน migration/ ของโปรเจกต์ แล้วเปิด Git Bash รัน:
#   bash migration/export-old-machine.sh
set -euo pipefail

cd "$(dirname "$0")/.."
DUMP=backups/coopsmile-final.sql

echo "==> เครื่องนี้: $(hostname)  โฟลเดอร์: $(pwd)"
docker compose ps --format '{{.Service}}\t{{.Status}}'
echo

# db ต้องรันอยู่ถึงจะ dump ได้
if ! docker compose ps --status running --services | grep -qx db; then
  echo "!! service db ไม่ได้รันอยู่ — สั่ง 'docker compose up -d db' ก่อน แล้วรันสคริปต์นี้ใหม่" >&2
  exit 1
fi

echo "==> [1/4] dump ฐานข้อมูลรอบสุดท้าย → $DUMP"
mkdir -p backups
docker compose exec -T db pg_dump -U coopsmile coopsmile > "$DUMP"

# ถ้า dump พังจะได้รู้ตรงนี้ ไม่ใช่ตอนไป restore ที่เครื่องใหม่แล้วข้อมูลหาย
if ! grep -q "PostgreSQL database dump complete" "$DUMP"; then
  echo "!! dump ไม่สมบูรณ์ (ไม่เจอบรรทัดปิดท้าย) — อย่าเพิ่งปิดสแตก" >&2
  exit 1
fi
echo "    OK $(wc -c < "$DUMP") bytes · $(grep -c '^CREATE TABLE' "$DUMP") ตาราง"

echo "==> [2/4] ห่อไฟล์ uploads"
if [ -n "$(ls -A uploads 2>/dev/null || true)" ]; then
  tar -czf backups/uploads.tar.gz uploads
  echo "    OK backups/uploads.tar.gz ($(ls uploads | wc -l) ไฟล์)"
else
  echo "    ข้าม — uploads ว่าง ไม่มีอะไรต้องย้าย"
fi

echo "==> [3/4] ตัดโดเมนออกจากเครื่องนี้ (stop cloudflared)"
docker compose stop cloudflared

echo "==> [4/4] ปิดสแตก (volume pgdata ยังอยู่ครบ — ไม่ได้ใส่ -v)"
docker compose down

echo
echo "เสร็จแล้ว · ก๊อปไฟล์พวกนี้ไปวางที่เครื่องใหม่ใน d:/File_Docker/web-coopsmile/backups/"
echo "   - $DUMP"
[ -f backups/uploads.tar.gz ] && echo "   - backups/uploads.tar.gz"
echo
echo "อย่าเพิ่งลบ volume หรือถอน Docker เครื่องนี้ — เก็บไว้เป็นทางถอยสัก 3-7 วัน"
