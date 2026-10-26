-- ฐาน D1 ของ survey-edge — สร้างครั้งเดียว: npx wrangler d1 execute survey-edge --remote --file schema.sql

-- คำตอบที่พักไว้ตอนเครื่องสำนักงานปิด (เข้ารหัส อ่านไม่ได้บน Cloudflare)
CREATE TABLE IF NOT EXISTS queue (
  id         TEXT PRIMARY KEY,
  path       TEXT NOT NULL,
  sealed     TEXT NOT NULL,
  ip_hash    TEXT NOT NULL,
  queued_at  INTEGER NOT NULL,
  dead       INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS queue_due ON queue (dead, queued_at);
CREATE INDEX IF NOT EXISTS queue_ip ON queue (ip_hash, queued_at);

-- สำเนาหน้า /s/ /r/ และไฟล์ประกอบ ไว้เสิร์ฟตอนเครื่องปิด (ไม่มีข้อมูลรายคน)
CREATE TABLE IF NOT EXISTS pages (
  path         TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  body         BLOB NOT NULL,
  updated_at   INTEGER NOT NULL
);
