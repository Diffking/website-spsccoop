# survey-edge — หน้าด่านแบบประเมินบน Cloudflare (แทน PHP บนโฮสต์)

ลิงก์และ QR ของแบบประเมินชี้ `https://survey.spsccoop.org/s/<code>/` → Worker ตัวนี้

| เครื่องสำนักงาน | Worker ทำอะไร |
|---|---|
| เปิด | ส่งต่อไป `spsccoop.org` ตามปกติ + เก็บสำเนาหน้า/ไฟล์ประกอบไว้ใน D1 |
| ปิด | เสิร์ฟหน้าจากสำเนา · ยืนยันตัวตนตอบ `offline` · **พักคำตอบแบบเข้ารหัสไว้ใน D1** |
| เปิดอีกครั้ง | เครื่องสำนักงานมาดึงเอง (`survey-verify` ทุก 10 นาที) แล้วสั่งลบ |

- เปิดเฉพาะเส้นทางแบบประเมิน (`/s/` `/r/` `/api/survey/<code>/(identify|submit|queue)` ไฟล์ประกอบ) ที่เหลือ 404
- Cloudflare อ่านคำตอบที่พักไม่ได้ — Worker มีแค่กุญแจสาธารณะ กุญแจไขอยู่ที่เครื่องสำนักงาน
- ไม่แตะโฮสต์ `spsccoop.com` เลย ทั้งตอนรับและตอนดึง

## ขึ้นจริงครั้งแรก (ผู้ดูแลระบบ · ทำครั้งเดียว)

ต้องมีสิทธิ์จัดการโซน `spsccoop.org` ใน Cloudflare · แพ็กเกจฟรีพอ

1. **DNS** — Cloudflare → `spsccoop.org` → DNS → เพิ่มระเบียน
   `AAAA` · ชื่อ `survey` · ค่า `100::` · **Proxied (เมฆส้ม)**
   (ที่อยู่ปลอมตามธรรมเนียมของ Worker — คำขอไม่เคยไปถึงที่อยู่นี้ Worker รับไปก่อน)
2. **ล็อกอิน** — ในโฟลเดอร์นี้ `npm install` แล้ว `npx wrangler login`
   (หรือตั้ง `CLOUDFLARE_API_TOKEN` ที่มีสิทธิ์ Workers Scripts + D1 + Workers Routes ของโซนนี้)
3. **ฐาน D1** — `npx wrangler d1 create survey-edge` เอา `database_id` ที่ได้ไปแทนใน `wrangler.toml`
   แล้ว `npx wrangler d1 execute survey-edge --remote --file schema.sql`
4. **secret** — หลังบ้าน → แบบประเมิน → "ตั้งค่ากล่องพักคำตอบ" (เห็นเฉพาะ ADMIN) มีค่าให้คัดลอก
   `npx wrangler secret put QUEUE_TOKEN` · `npx wrangler secret put PUBLIC_KEY`
   ⚠️ **ต้องขึ้นเว็บหลัก (เฟส 2–6) ก่อน** กุญแจถูกสร้างในฐานจริงตอนเปิดหน้านั้นครั้งแรก
5. **ขึ้น Worker** — `npx wrangler deploy`
6. **ตรวจ** — เปิด `https://survey.spsccoop.org/__health` ต้องได้ `{"ok":true}`
   · `docker compose logs survey-verify` ไม่มี error จากการดึง

## ทดสอบบนเครื่องโดยไม่ต้องมีบัญชี Cloudflare

```bash
npm install
npx wrangler d1 execute survey-edge --local --file schema.sql
# .dev.vars (ไม่ขึ้น git): QUEUE_TOKEN="..."  PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
npx wrangler dev --local --port 8787 --var ORIGIN:http://localhost:3000
# เว็บ: SURVEY_EDGE_URL=http://localhost:8787 npx next start -p 3000
```

ปิดเว็บ (พอร์ต 3000) = จำลองเครื่องสำนักงานปิด · เปิดกลับแล้ว `POST /api/survey/pull/` = ดึงคำตอบ

## บทเรียนตอนทำ (26 ต.ค. 2569)

- **D1 คืนคอลัมน์ BLOB เป็นอาร์เรย์ตัวเลข** ไม่ใช่ ArrayBuffer — ส่งตรง ๆ ได้เนื้อหาว่าง ต้องแปลงเป็น Uint8Array
- **ไฟล์ `/_next/static` ต้องเสิร์ฟจากสำเนาก่อน** ถ้าถามต้นทางก่อนทุกไฟล์ ตอนเครื่องปิดแต่ละไฟล์รอหมดเวลา
  8 วินาที หน้าเลยไม่ทันเริ่มทำงาน (กดปุ่มไม่ได้) · และจำไว้ 60 วินาทีว่าต้นทางล่ม
- โควตาฟรี: Worker 100,000 คำขอ/วัน · D1 เขียน 100,000 แถว/วัน — แบบประเมินสหกรณ์ใช้ไม่ถึง
