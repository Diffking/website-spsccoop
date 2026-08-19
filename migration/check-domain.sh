#!/usr/bin/env bash
# ตรวจว่าโดเมน www.spsccoop.com พร้อมใช้งานกับเครื่องนี้แล้วหรือยัง
set -u
DOMAIN="www.spsccoop.com"

echo "1) เนมเซิร์ฟเวอร์ของ spsccoop.com"
nslookup -type=NS spsccoop.com 8.8.8.8 2>/dev/null | grep -i nameserver | sed 's/^/   /' || echo "   หาไม่เจอ"

echo
echo "2) $DOMAIN ชี้ไปที่ไหน"
nslookup "$DOMAIN" 8.8.8.8 2>/dev/null | tail -4 | grep -i address | sed 's/^/   /' || echo "   หาไม่เจอ"

echo
echo "3) เปิดเว็บได้ไหม"
code=$(curl -s -m 20 -o /dev/null -w "%{http_code}" "https://$DOMAIN/" 2>/dev/null)
echo "   หน้าแรก → ${code:-ไม่ตอบ}"

echo
echo "4) มาจากเครื่องนี้หรือยัง (ดูจากหน้าเนื้อหาที่มีเฉพาะเว็บใหม่)"
if curl -s -m 20 "https://$DOMAIN/about/history/" 2>/dev/null | grep -q "prose-page"; then
  echo "   ใช่ — เว็บใหม่ออนไลน์ที่โดเมนนี้แล้ว"
else
  echo "   ยัง — โดเมนยังไม่ได้ชี้มาที่เครื่องนี้"
fi

echo
echo "5) หลังบ้านต้องเปิดไม่ได้จากโดเมนสาธารณะ"
admin=$(curl -s -m 20 -o /dev/null -w "%{http_code}" "https://$DOMAIN/admin/" 2>/dev/null)
[ "$admin" = "404" ] && echo "   ปลอดภัย (404 ตามที่ตั้งใจ)" || echo "   ได้ ${admin:-ไม่ตอบ} — ตรวจค่า ADMIN_HOST ด้วย"
