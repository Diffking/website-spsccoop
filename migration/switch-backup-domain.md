# ย้ายโดเมนสำรอง coopsmile.org → spsccoop.org แล้วปลด coopsmile.org ออกจากเว็บนี้

ทำเมื่อ 21 ส.ค. 2026 — เหตุผลสองข้อ

1. อยากให้โดเมนสำรองชื่อคล้ายโดเมนจริง `spsccoop.com` คนจะได้ไม่สับสนว่าเป็นเว็บเดียวกัน
2. **`coopsmile.org` จะถูกเอาไปพัฒนางานอื่น** ต้องตัดขาดจากเว็บสหกรณ์ให้หมด ไม่ใช่แค่เลิกใช้

```
สมาชิก      → www.spsccoop.com (PHP บนโฮสต์ เก็บสำเนา) ──ขอหน้าเว็บ──→ spsccoop.org (เครื่องนี้)
เจ้าหน้าที่ → admin.spsccoop.org ─────────────────────────────────────→ เครื่องนี้ (web:3000)
coopsmile.org → ไม่เกี่ยวกับเว็บนี้อีกต่อไป
```

## ⚠️ ลำดับสำคัญ — ห้ามสลับขั้น

ตัวมิเรอร์บนโฮสต์ยังดึงหน้าเว็บจาก `https://coopsmile.org` อยู่ **ถ้าปลด coopsmile.org
ออกจากอุโมงค์ก่อนขั้นที่ 4 หน้าเว็บที่สมาชิกเปิดจะดับทั้งเว็บทันที** (สำเนาที่ค้างอยู่จะหมดอายุ
ใน 120 วินาที แล้วมันจะไปดึงต้นทางที่ไม่มีอยู่แล้ว)

| ขั้น | ทำอะไร | ใครทำ | สถานะ |
|---|---|---|---|
| 1 | แก้โค้ด + `.env` ให้ชี้ spsccoop.org | ผม | ✅ เสร็จ |
| 2 | เพิ่ม `spsccoop.org` + `admin.spsccoop.org` เข้าอุโมงค์ | Cloudflare | ⬜ |
| 3 | `docker compose up -d --build web` | ผม | ⬜ |
| 4 | แก้ `config.php` บนโฮสต์ → `'backend' => 'https://spsccoop.org'` | เจ้าของเว็บ | ⬜ |
| 5 | ปลด public hostname ของ `coopsmile.org` ออกจากอุโมงค์ | Cloudflare | ⬜ |

ขั้นที่ 4 เดิมเป็นงาน "ไม่รีบก็ได้" **ตอนนี้เป็นงานบังคับ** เพราะ coopsmile.org กำลังจะหายไป

## ขั้นที่ 1 — ทำอะไรไปแล้ว

| ที่ไหน | เปลี่ยนเป็น |
|---|---|
| `.env` → `ADMIN_HOST` | `admin.spsccoop.org` |
| `.env` → `ADMIN_ROOT_HOST` | `admin.spsccoop.org` |
| `.env` → `PUBLIC_SITE_URL` | `https://spsccoop.org` (เพิ่มใหม่ เดิมไม่ได้ตั้ง) |
| `.env` → `ANALYTICS_HOST` | `spsccoop.com,spsccoop.org` (เพิ่มใหม่) |
| `src/lib/siteUrl.ts` | ค่าตั้งต้นเมื่อไม่ตั้ง `PUBLIC_SITE_URL` |
| `src/lib/analytics.ts` | ค่าตั้งต้นเมื่อไม่ตั้ง `ANALYTICS_HOST` |
| `src/lib/ai.ts` | หัว `HTTP-Referer` ที่ส่งให้ OpenRouter |
| `php-frontend/config.sample.php` | `backend` ของตัวมิเรอร์ |
| เอกสารทั้งหมด | `AGENTS.md` · `doc/` · `migration/` |

**ไม่มี `coopsmile.org` ค้างใน `.env` แล้ว** — ระหว่างที่ยังไม่ทำขั้นที่ 2 เจ้าหน้าที่เข้าหลังบ้าน
ได้ทาง `localhost:8030/admin` จากเครื่องนี้เท่านั้น (`src/proxy.ts` เปิด localhost ไว้เสมอ
จะได้ไม่ล็อกตัวเองออกตอนตั้งค่าโดเมนพัง) · ยังไม่ deploy จนกว่าจะถึงขั้นที่ 3
ของเดิมจึงยังทำงานอยู่ทุกอย่าง

สำรอง `.env` ก่อนแก้ไว้ที่ `.env.bak-domain` (ไม่อยู่ใน git)

ฐานข้อมูลไม่มี `coopsmile.org` อยู่เลย ทั้ง `Setting` และเนื้อหาหน้าเว็บ — ตรวจแล้ว 0 แถว

## ขั้นที่ 2 — เพิ่มชื่อโดเมนเข้าอุโมงค์

โดเมน `spsccoop.org` ย้ายเนมเซิร์ฟเวอร์มา Cloudflare แล้ว (`piers` / `deborah`)
แต่ยังไม่มีระเบียนชี้เข้าอุโมงค์ — ตรวจได้ด้วย `nslookup admin.spsccoop.org 8.8.8.8`

Cloudflare → Zero Trust → Networks → Tunnels → อุโมงค์ที่ใช้อยู่ → Public hostname → Add
เพิ่ม **สองรายการ** ทั้งคู่ Service เป็น `HTTP` → `web:3000`

| Subdomain | Domain | ใครใช้ |
|---|---|---|
| (เว้นว่าง) | `spsccoop.org` | ตัวมิเรอร์บนโฮสต์มาดึงหน้าเว็บ |
| `admin` | `spsccoop.org` | เจ้าหน้าที่เข้าหลังบ้าน |

เพิ่มเสร็จ Cloudflare สร้างระเบียน CNAME ให้เอง ไม่ต้องไปเพิ่มในหน้า DNS ซ้ำ

- Zone ID (`spsccoop.org`): `3c980213c74ba58cb6a01b2b5c2d08fb`
- Account ID: `c9a83c09091df1a4ba5fcda58b924006`

## ขั้นที่ 3 — deploy

```bash
npm run build
docker compose up -d --build web    # เว็บสะดุด ~1-2 นาที
```

ตรวจว่าใช้ได้จริง (ยิงที่เครื่องเราเอง ไม่ต้องแตะโฮสต์)

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://spsccoop.org/
curl -s -o /dev/null -w "%{http_code}\n" https://spsccoop.org/admin/        # ต้องได้ 404
curl -s -o /dev/null -w "%{http_code}\n" https://admin.spsccoop.org/admin/  # ต้องได้ 200/307
```

## ขั้นที่ 4 — สลับตัวมิเรอร์บนโฮสต์ (บังคับ)

แก้บรรทัดเดียวใน `config.php` บนโฮสต์ แล้วอัปทับผ่าน File Manager ใน cPanel
(ห้ามอัปทีละไฟล์ผ่าน FTP รัว ๆ — ดูเหตุผลใน `AGENTS.md`)

```php
'backend' => 'https://spsccoop.org',
```

อัปแล้วรอ 2 นาทีให้สำเนาเก่าหมดอายุ แล้วเปิด `https://www.spsccoop.com/` ดูว่ายังปกติ
ถ้าหน้าเว็บยังขึ้นครบ = ตัวมิเรอร์ดึงจาก spsccoop.org ได้แล้ว ไปขั้นที่ 5 ได้

**ห้ามไปขั้นที่ 5 ก่อนที่ขั้นนี้จะยืนยันว่าใช้ได้**

## ขั้นที่ 5 — ปลด coopsmile.org ออกจากอุโมงค์

Cloudflare → Zero Trust → Networks → Tunnels → อุโมงค์ที่ใช้อยู่ → Public hostname
ลบทุกรายการที่เป็น `coopsmile.org` และ `admin.coopsmile.org`

จากนั้น `coopsmile.org` ไม่เชื่อมกับเว็บนี้อีกต่อไป เอาไปทำอย่างอื่นได้เต็มที่
· ถ้าจะเอาไปใช้กับโปรเจกต์อื่นบนเครื่องเดียวกัน ให้ทำอุโมงค์แยกของโปรเจกต์นั้น
อย่าเอามาแขวนกับอุโมงค์ตัวนี้ ไม่งั้นเวลาแก้อะไรจะกระทบเว็บสหกรณ์ไปด้วย

## SEO — ไม่กระทบ

`siteUrl` ยังเป็น `https://www.spsccoop.com` เหมือนเดิม ไม่ได้เปลี่ยน
โดเมนสำรองตั้งห้ามกูเกิลเก็บอยู่แล้ว (`src/lib/seo.ts` → `onCanonicalHost`)
กูเกิลจึงไม่เคยเก็บหน้าจาก coopsmile.org ไว้ตั้งแต่แรก ปลดทิ้งได้เลยไม่ต้องทำ redirect
