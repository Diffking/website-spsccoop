# โดเมนสำรองใหม่ spsccoop.org (coopsmile.org ยังค้างไว้)

ทำเมื่อ 21 ส.ค. 2026 — อยากให้โดเมนสำรองชื่อคล้ายโดเมนจริง `spsccoop.com`
คนจะได้ไม่สับสนว่าเป็นเว็บเดียวกัน · ปลายทางคือเอา `coopsmile.org` ไปพัฒนางานอื่น
แต่ **ยังไม่ตัดตอนนี้** เจ้าของเว็บสั่งให้ค้างไว้กันพลาด

```
สมาชิก      → www.spsccoop.com (PHP บนโฮสต์ เก็บสำเนา) ──ขอหน้าเว็บ──→ spsccoop.org (เครื่องนี้)
เจ้าหน้าที่ → admin.spsccoop.org ─────────────────────────────────────→ เครื่องนี้ (web:3000)

coopsmile.org · admin.coopsmile.org ─────────────────────────────────→ ยังใช้ได้เหมือนเดิม (ทางสำรอง)
```

## สถานะตอนนี้

| ขั้น | ทำอะไร | สถานะ |
|---|---|---|
| 1 | แก้โค้ด + `.env` ให้ชี้ spsccoop.org | ✅ เสร็จ |
| 2 | เพิ่ม `spsccoop.org` + `admin.spsccoop.org` เข้าอุโมงค์ `webcoopsmile` | ✅ เสร็จ |
| 3 | `docker compose up -d --build web` | ✅ เสร็จ |
| 4 | แก้ `config.php` บนโฮสต์ → `'backend' => 'https://spsccoop.org'` | ⬜ เจ้าของเว็บทำ |
| 5 | ปลด `coopsmile.org` ออกจากอุโมงค์ | ⛔ **ยังไม่ทำ ตั้งใจ** |

ตรวจแล้วเมื่อ 21 ส.ค. 2026 ทั้งในเครื่องและผ่าน Cloudflare จริง

| โดเมน | `/` | `/admin/` |
|---|---|---|
| `spsccoop.org` | 200 | 404 (ซ่อนหลังบ้าน) |
| `admin.spsccoop.org` | 307 → `/admin` | 307 → `/login` |
| `coopsmile.org` | 200 | 404 |
| `admin.coopsmile.org` | 307 → `/admin` | 307 → `/login` |

## ⚠️ ทำไม coopsmile.org ยังต้องอยู่

สองเหตุผล เหตุผลแรกสำคัญกว่า

1. **ตัวมิเรอร์บนโฮสต์ยังดึงหน้าเว็บจาก `https://coopsmile.org`** (ขั้นที่ 4 ยังไม่ได้ทำ)
   ปลดตอนนี้ = สำเนาหมดอายุใน 120 วินาที แล้ว `www.spsccoop.com` ดับทั้งเว็บ
2. เป็นทางเข้าหลังบ้านสำรอง เผื่อ `admin.spsccoop.org` มีปัญหา

**ลำดับที่ปลอดภัย: ทำขั้นที่ 4 → ยืนยันว่า `www.spsccoop.com` ยังปกติ → ค่อยทำขั้นที่ 5**
และเจ้าของเว็บเป็นคนสั่งว่าจะปลดเมื่อไหร่ ไม่ใช่ปลดเองเพราะเห็นว่าไม่ได้ใช้แล้ว

## ขั้นที่ 1 — เปลี่ยนอะไรไปบ้าง

| ที่ไหน | ค่า |
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

`ANALYTICS_HOST` ยังนับ `coopsmile.org` อยู่ **ตราบใดที่มันยังเป็นเว็บสหกรณ์**
วันที่เอาไปทำงานอื่นจริง ต้องเอาออกจากรายการนี้ ไม่งั้นยอดผู้เข้าชมจะปนกับเว็บอื่น

สำรอง `.env` ก่อนแก้ไว้ที่ `.env.bak-domain` (ไม่อยู่ใน git)

ฐานข้อมูลไม่มี `coopsmile.org` อยู่เลย ทั้ง `Setting` และเนื้อหาหน้าเว็บ — ตรวจแล้ว 0 แถว

## ขั้นที่ 2 — ที่ตั้งค่าไว้ในอุโมงค์

อุโมงค์ชื่อ **`webcoopsmile`** (อีก 4 ตัวในบัญชีเป็นระบบอื่น อย่าไปแตะ)
Cloudflare → Zero Trust → Networks → Tunnels → `webcoopsmile` → Published application routes

```
coopsmile.org              → HTTP  web:3000
admin.coopsmile.org        → HTTP  web:3000
spsccoop.org               → HTTP  web:3000     ← เพิ่ม 21 ส.ค. 2026
admin.spsccoop.org         → HTTP  web:3000     ← เพิ่ม 21 ส.ค. 2026
```

Type ต้องเป็น `HTTP` ไม่ใช่ HTTPS · URL ต้องเป็น `web:3000` ไม่ใช่ `localhost:3000`
เพราะ `cloudflared` อยู่ในเน็ตเวิร์ก Docker ต่อหาแอปด้วยชื่อคอนเทนเนอร์

⚠️ **`HTTP Host Header` ใน Additional application settings ต้องเว้นว่าง** — ใส่แล้วมันเขียนทับ
หัวคำขอ ระบบจะแยกไม่ออกว่าคนเปิดโดเมนไหน ทั้งด่านหลังบ้าน (`src/proxy.ts`) และ
ตัวนับผู้เข้าชม (`src/lib/analytics.ts`) พังพร้อมกัน

- Zone ID (`spsccoop.org`): `3c980213c74ba58cb6a01b2b5c2d08fb`
- Account ID: `c9a83c09091df1a4ba5fcda58b924006`

## ขั้นที่ 4 — สลับตัวมิเรอร์บนโฮสต์ (ยังไม่ได้ทำ)

แก้บรรทัดเดียวใน `config.php` บนโฮสต์ แล้วอัปทับผ่าน File Manager ใน cPanel
(ห้ามอัปทีละไฟล์ผ่าน FTP รัว ๆ — ดูเหตุผลใน `AGENTS.md`)

```php
'backend' => 'https://spsccoop.org',
```

อัปแล้วรอ 2 นาทีให้สำเนาเก่าหมดอายุ แล้วเปิด `https://www.spsccoop.com/` ดูว่ายังปกติ
ชุดไฟล์ที่พร้อมอัปอยู่ใน `_data/spsccoop-frontend/` (ยังไม่ได้แก้ รอเจ้าของเว็บสั่ง)

## ตรวจซ้ำได้ตลอด

```bash
for h in spsccoop.org admin.spsccoop.org coopsmile.org admin.coopsmile.org; do
  for p in / /admin/; do
    printf "%-24s %-9s %s\n" "$h" "$p" \
      "$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $h" "http://localhost:8030$p")"
  done
done
```

ยิงที่ `localhost:8030` แล้วสวมหัว `Host` เอง — ไม่ต้องแตะโฮสต์ ไม่เสี่ยงโดนไฟร์วอลล์แบน

## SEO — ไม่กระทบ

`siteUrl` ยังเป็น `https://www.spsccoop.com` เหมือนเดิม ไม่ได้เปลี่ยน
โดเมนสำรองตั้งห้ามกูเกิลเก็บอยู่แล้ว (`src/lib/seo.ts` → `onCanonicalHost`)
กูเกิลจึงไม่เคยเก็บหน้าจากโดเมนสำรองไว้ตั้งแต่แรก
