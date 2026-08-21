# โดเมนสำรองใหม่ spsccoop.org

ทำเมื่อ 21 ส.ค. 2026 — อยากให้โดเมนสำรองชื่อคล้ายโดเมนจริง `spsccoop.com`
คนจะได้ไม่สับสนว่าเป็นเว็บเดียวกัน · `coopsmile.org` เจ้าของเว็บจะเอาไปพัฒนางานอื่น

```
สมาชิก      → www.spsccoop.com (PHP บนโฮสต์ เก็บสำเนา) ──ขอหน้าเว็บ──→ spsccoop.org (เครื่องนี้)
เจ้าหน้าที่ → admin.spsccoop.org ─────────────────────────────────────→ เครื่องนี้ (web:3000)
```

## สถานะ

| ขั้น | ทำอะไร | สถานะ |
|---|---|---|
| 1 | แก้โค้ด + `.env` ให้ชี้ spsccoop.org | ✅ |
| 2 | เพิ่ม `spsccoop.org` + `admin.spsccoop.org` เข้าอุโมงค์ `webcoopsmile` | ✅ |
| 3 | `docker compose up -d --build web` | ✅ |
| 4 | `config.php` บนโฮสต์ → `'backend' => 'https://spsccoop.org'` | ✅ |
| 5 | ปลด `coopsmile.org` ออกจากอุโมงค์ | ⬜ ทำได้แล้ว |

ขั้นที่ 5 ทำได้แล้วเพราะไม่มีอะไรพึ่ง `coopsmile.org` อีก **แต่ยืนยันตามขั้นตอนข้างล่างก่อน**

## บทเรียน 21 ส.ค. 2026 — ลำดับสำคัญกว่าที่คิด

ระหว่างทางเกิดสองเรื่อง ทั้งคู่มาจากลำดับ ไม่ใช่จากโค้ดผิด

1. **เอา `admin.coopsmile.org` ออกจาก `ADMIN_HOST` แล้ว deploy ก่อนที่
   `admin.spsccoop.org` จะพร้อม** — เจ้าหน้าที่เข้าหลังบ้านจากนอกเครื่องไม่ได้ ~3 นาที
   · เปิดทางใหม่ให้เสร็จก่อนเสมอ แล้วค่อยปิดทางเก่า
2. **ปลด `coopsmile.org` ออกจากอุโมงค์ตอนที่ `config.php` ยังชี้ไปที่มัน** —
   `www.spsccoop.com` เหลือแต่ของในแคช พอหมดอายุ 120 วิ หน้าที่ไม่มีในแคชจะเปิดไม่ขึ้น
   · แก้ด้วยการสร้าง public hostname คืน ใช้เวลา ~30 วินาที เว็บกลับมาทันที

**เวลาจะปลดอะไรทิ้ง ให้ถามก่อนว่า "ตอนนี้ยังมีอะไรพึ่งมันอยู่ไหม"** — ของที่พึ่ง
`coopsmile.org` อยู่คือ `backend` ใน `config.php` บนโฮสต์ ซึ่งมองจากในโค้ดนี้ไม่เห็น

## ขั้นที่ 5 — ปลด coopsmile.org ให้ถูกวิธี

ทำตามลำดับนี้ ถ้าพลาดก็ถอยกลับได้ใน 30 วินาที

1. Cloudflare → Zero Trust → Networks → Tunnels → **`webcoopsmile`** → Edit →
   Published application routes → ลบ `coopsmile.org` และ `admin.coopsmile.org`
2. ล้างแคชแล้วเปิดหน้าเว็บทดสอบ — ถ้าขึ้นครบแปลว่าตัวมิเรอร์ดึงผ่าน `spsccoop.org` ได้จริง

```bash
T=$(grep -oP "(?<='purge_token' => ')[^']+" _data/spsccoop-frontend/config.php)
curl -s -X POST https://www.spsccoop.com/purge.php -H 'Content-Type: application/json' \
  -d "{\"token\":\"$T\",\"paths\":[\"/\",\"/about/history/\"]}"
curl -s -o /dev/null -w '%{http_code}\n' https://www.spsccoop.com/about/history/
```

ได้ `{"purged":2}` แล้วตามด้วย `200` = เรียบร้อย · **ยิงแค่นี้พอ อย่ายิงซ้ำ** โฮสต์แบนไอพีเราได้

3. ถ้าเปิดไม่ขึ้น — สร้าง public hostname คืนทันที แล้วมาดูว่าทำไม

| Subdomain | Domain | Type | URL |
|---|---|---|---|
| *(เว้นว่าง)* | `coopsmile.org` | `HTTP` | `web:3000` |

4. ปลดสำเร็จแล้วเอา `coopsmile.org` ออกจาก `ANALYTICS_HOST` ใน `.env` ด้วย
   (ตอนนี้ยังนับอยู่) ไม่งั้นวันที่โดเมนไปเป็นเว็บอื่น ยอดผู้เข้าชมจะปนกัน แล้ว
   `docker compose up -d --force-recreate web`

## ค่าที่ตั้งไว้ตอนนี้

`.env` — โดเมนเก่ายังค้างอยู่ตั้งใจ เอาออกได้หลังทำขั้นที่ 5

| คีย์ | ค่า |
|---|---|
| `ADMIN_HOST` | `admin.spsccoop.org,admin.coopsmile.org` |
| `ADMIN_ROOT_HOST` | `admin.spsccoop.org,admin.coopsmile.org` |
| `PUBLIC_SITE_URL` | `https://spsccoop.org` |
| `ANALYTICS_HOST` | `spsccoop.com,spsccoop.org,coopsmile.org` |

อุโมงค์ `webcoopsmile` (อีก 4 ตัวในบัญชีเป็นระบบอื่น อย่าไปแตะ)

```
spsccoop.org               → HTTP  web:3000
admin.spsccoop.org         → HTTP  web:3000
coopsmile.org              → HTTP  web:3000     ← รอปลด
admin.coopsmile.org        → HTTP  web:3000     ← รอปลด
```

Type ต้องเป็น `HTTP` ไม่ใช่ HTTPS · URL เป็น `web:3000` ไม่ใช่ `localhost:3000`
เพราะ `cloudflared` อยู่ในเน็ตเวิร์ก Docker ต่อหาแอปด้วยชื่อคอนเทนเนอร์

⚠️ **`HTTP Host Header` ใน Additional application settings ต้องเว้นว่าง** — ใส่แล้วมันเขียนทับ
หัวคำขอ ระบบจะแยกไม่ออกว่าคนเปิดโดเมนไหน ทั้งด่านหลังบ้าน (`src/proxy.ts`) และ
ตัวนับผู้เข้าชม (`src/lib/analytics.ts`) พังพร้อมกัน

- Zone ID (`spsccoop.org`): `3c980213c74ba58cb6a01b2b5c2d08fb`
- Account ID: `c9a83c09091df1a4ba5fcda58b924006`

## แก้อะไรในโค้ดไปบ้าง

| ที่ไหน | เปลี่ยนอะไร |
|---|---|
| `src/lib/siteUrl.ts` | ค่าตั้งต้นเมื่อไม่ตั้ง `PUBLIC_SITE_URL` |
| `src/lib/analytics.ts` | ค่าตั้งต้นเมื่อไม่ตั้ง `ANALYTICS_HOST` |
| `src/lib/ai.ts` | หัว `HTTP-Referer` ที่ส่งให้ OpenRouter |
| `php-frontend/config.sample.php` · `_data/spsccoop-frontend/config.php` | `backend` |
| เอกสาร | `AGENTS.md` · `doc/` · `migration/` |

ฐานข้อมูลไม่มี `coopsmile.org` อยู่เลย ทั้ง `Setting` และเนื้อหาหน้าเว็บ — ตรวจแล้ว 0 แถว
· สำรอง `.env` ก่อนแก้ไว้ที่ `.env.bak-domain` (ไม่อยู่ใน git)

## ตรวจซ้ำได้ตลอด โดยไม่ต้องแตะโฮสต์

```bash
for h in spsccoop.org admin.spsccoop.org coopsmile.org admin.coopsmile.org; do
  for p in / /admin/; do
    printf "%-24s %-9s %s\n" "$h" "$p" \
      "$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $h" "http://localhost:8030$p")"
  done
done
```

ที่ถูกต้อง: หน้าเว็บ `/` = 200 ทุกโดเมน · `/admin/` = 404 บนโดเมนสาธารณะ และ 307 บนโดเมนหลังบ้าน

## SEO — ไม่กระทบ

`siteUrl` ยังเป็น `https://www.spsccoop.com` เหมือนเดิม ไม่ได้เปลี่ยน
โดเมนสำรองตั้งห้ามกูเกิลเก็บอยู่แล้ว (`src/lib/seo.ts` → `onCanonicalHost`)
กูเกิลจึงไม่เคยเก็บหน้าจากโดเมนสำรองไว้ตั้งแต่แรก ปลดทิ้งได้เลยไม่ต้องทำ redirect
