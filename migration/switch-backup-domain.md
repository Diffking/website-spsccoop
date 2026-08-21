# เปลี่ยนโดเมนสำรอง coopsmile.org → spsccoop.org

ทำเมื่อ 21 ส.ค. 2026 — เหตุผลคืออยากให้โดเมนสำรองชื่อคล้ายโดเมนจริง `spsccoop.com`
เจ้าหน้าที่กับสมาชิกจะได้ไม่สับสนว่าสองโดเมนนี้เป็นเว็บเดียวกัน

```
สมาชิก      → www.spsccoop.com (PHP บนโฮสต์ เก็บสำเนา) ──ขอหน้าเว็บ──→ spsccoop.org (เครื่องนี้)
เจ้าหน้าที่ → admin.spsccoop.org ─────────────────────────────────────→ เครื่องนี้ (web:3000)
```

## ทำอะไรไปแล้ว (ฝั่งโค้ดเสร็จหมด)

| ที่ไหน | เปลี่ยนเป็น |
|---|---|
| `.env` → `ADMIN_HOST` | `admin.spsccoop.org,admin.coopsmile.org` |
| `.env` → `ADMIN_ROOT_HOST` | `admin.spsccoop.org,admin.coopsmile.org` |
| `.env` → `PUBLIC_SITE_URL` | `https://spsccoop.org` (เพิ่มใหม่ เดิมไม่ได้ตั้ง) |
| `.env` → `ANALYTICS_HOST` | `spsccoop.com,spsccoop.org,coopsmile.org` (เพิ่มใหม่) |
| `src/lib/siteUrl.ts` | ค่าตั้งต้นเมื่อไม่ตั้ง `PUBLIC_SITE_URL` |
| `src/lib/analytics.ts` | ค่าตั้งต้นเมื่อไม่ตั้ง `ANALYTICS_HOST` |
| `src/lib/ai.ts` | หัว `HTTP-Referer` ที่ส่งให้ OpenRouter |
| `php-frontend/config.sample.php` | `backend` ของตัวมิเรอร์ |
| เอกสารทั้งหมด | `AGENTS.md` · `doc/` · `migration/` |

**โดเมนเก่ายังค้างไว้ใน `ADMIN_HOST` / `ANALYTICS_HOST` ตั้งใจ** — ระหว่างเปลี่ยนจะได้ไม่มี
ช่วงที่เข้าหลังบ้านไม่ได้ทั้งสองทาง ค่อยลบ `coopsmile.org` ออกทีหลังเมื่อมั่นใจว่าทางใหม่ใช้ได้จริง

## ที่เหลือต้องทำในบัญชี Cloudflare

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

## แล้วค่อย deploy

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

## ขั้นสุดท้าย — สลับตัวมิเรอร์บนโฮสต์

**ทำเป็นขั้นสุดท้ายเท่านั้น** ถ้าสลับก่อนที่ `spsccoop.org` จะใช้ได้จริง
หน้าเว็บที่สมาชิกเปิด (`www.spsccoop.com`) จะดึงหลังบ้านไม่ได้ทั้งเว็บ

แก้บรรทัดเดียวใน `config.php` บนโฮสต์ แล้วอัปทับผ่าน File Manager ใน cPanel
(ห้ามอัปทีละไฟล์ผ่าน FTP รัว ๆ — ดูเหตุผลใน `AGENTS.md`)

```php
'backend' => 'https://spsccoop.org',
```

ไม่รีบก็ได้ — `coopsmile.org` ยังใช้ได้อยู่ตราบใดที่ยังไม่ลบออกจากอุโมงค์

## เก็บกวาดทีหลัง

1. ลบ `coopsmile.org` ออกจาก `ADMIN_HOST` / `ADMIN_ROOT_HOST` / `ANALYTICS_HOST` ใน `.env`
2. ลบ public hostname ของ `coopsmile.org` ออกจากอุโมงค์
3. โดเมนสำรองตั้งห้ามกูเกิลเก็บอยู่แล้ว (`src/lib/seo.ts` → `onCanonicalHost`)
   เปลี่ยนชื่อโดเมนไม่กระทบ SEO เพราะ `siteUrl` ยังเป็น `https://www.spsccoop.com` เหมือนเดิม
