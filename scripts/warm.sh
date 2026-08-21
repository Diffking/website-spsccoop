#!/bin/sh
# อุ่นสำเนาหน้าเว็บบนโฮสต์ www.spsccoop.com
#
# ถูกเรียกจาก crond ตามเวลาใน WARM_CRON (ค่าตั้งต้น 09:30 กับ 15:30 เวลาไทย)
# หรือสั่งเองเมื่อไหร่ก็ได้ด้วย
#     docker compose exec mirror-warm sh /warm.sh
#
# ยิงหาโฮสต์ "คำขอเดียว" ต่อรอบ — warm.php รันอยู่บนโฮสต์ แล้วโฮสต์เป็นฝ่ายไล่ดึง
# หน้าเว็บ 27 หน้ากับไฟล์อีก ~470 รายการจากเครื่องนี้เอง (ทิศทาง โฮสต์ → เรา
# วิ่งผ่าน Cloudflare คนละทางกับที่โดนแบน)

[ -f /tmp/warm.env ] && . /tmp/warm.env

FAILS=/tmp/warm.fails
SKIPS=/tmp/warm.skips

log() { echo "$(date '+%F %H:%M') อุ่นแคช: $*"; }

# อ่านตัวเลขจากไฟล์ ไฟล์หายหรือเนื้อในเพี้ยนก็นับเป็นศูนย์
num() {
  n=$(cat "$1" 2>/dev/null)
  case "$n" in
    '' | *[!0-9]*) echo 0 ;;
    *) echo "$n" ;;
  esac
}

if [ -z "${MIRROR_PURGE_TOKEN:-}" ]; then
  log "ข้าม — ยังไม่ได้เปิด MIRROR_PURGE_TOKEN ใน .env"
  exit 0
fi

fails=$(num "$FAILS")
skips=$(num "$SKIPS")

# ── ตัวตัดวงจร ────────────────────────────────────────────────────────────
# ไฟร์วอลล์โฮสต์นับคำขอที่ล้มเหลวแล้วเลื่อนจากแบนชั่วคราวเป็นถาวร · โดนแบนแล้ว
# ยิงต่อไม่ได้อะไรกลับมาเลยแต่ยังเติมตัวนับให้มันอยู่ดี — 21 ส.ค. 2026 โดนแบน
# ทั้งที่แตะโฮสต์ไม่ถึงสิบครั้งทั้งวัน
#
#   พลาดครั้งที่ 1  → ข้ามรอบถัดไปหนึ่งรอบ (6–18 ชม.)
#   พลาดครั้งที่ 2  → หยุดทั้งหมด จนกว่าคนจะมาแก้แล้ว restart
#
# รวมแล้วยิงพลาดได้มากสุด 2 ครั้งก็หยุดเอง
if [ "$skips" -gt 0 ]; then
  echo $((skips - 1)) > "$SKIPS"
  log "ข้ามรอบนี้ตามตัวตัดวงจร (พลาดมาแล้ว $fails ครั้ง)"
  exit 0
fi

if [ "$fails" -ge 2 ]; then
  log "หยุดยิงหาโฮสต์แล้ว — พลาดติดกัน $fails ครั้ง"
  log "แก้ต้นเหตุแล้วสั่ง docker compose restart mirror-warm เพื่อเริ่มนับใหม่"
  exit 0
fi

url="${MIRROR_WARM_URL:-https://www.spsccoop.com/warm.php}?token=${MIRROR_PURGE_TOKEN}&by=cron"

if out=$(curl -sS -f -m 900 "$url" 2>&1); then
  : > "$FAILS"
  : > "$SKIPS"
  log "สำเร็จ"
  echo "$out" | tail -2
else
  fails=$((fails + 1))
  echo "$fails" > "$FAILS"
  if [ "$fails" -eq 1 ]; then
    echo 1 > "$SKIPS"
    log "ไม่สำเร็จ ครั้งที่ 1 — ข้ามรอบถัดไปหนึ่งรอบ กันไฟร์วอลล์โฮสต์แบนไอพี"
  else
    log "ไม่สำเร็จ ครั้งที่ $fails — หยุดยิงหาโฮสต์ทั้งหมด จนกว่าจะ restart"
  fi
  echo "$out" | tail -1
fi
