# website-spsccoop

เว็บไซต์สหกรณ์ออมทรัพย์สาธารณสุขสงขลา จำกัด — Next.js ตัวเดียวจบ (หน้าบ้าน + หลังบ้าน + API)
ข้อมูลอยู่ใน PostgreSQL · ออกอินเทอร์เน็ตผ่าน Cloudflare Tunnel · รันด้วย Docker Compose

## เริ่มพัฒนา

```bash
cp .env.example .env      # แล้วเติม TUNNEL_TOKEN ถ้าต้องใช้ (ไม่ใส่ก็ dev ได้)
npm install
docker compose up -d db-dev
npx prisma migrate deploy # สร้างตารางใน db-dev
npx prisma db seed        # สร้างผู้ใช้หลังบ้านคนแรก (รหัส 07337)
npm run dev               # http://localhost:3000
```

`npm run dev` ต่อฐานข้อมูล **db-dev** (พอร์ต 5436) ไม่ใช่ฐานของเว็บจริง — ดู [AGENTS.md](AGENTS.md)

## โครงสร้าง

| ที่อยู่ | คำอธิบาย |
|---|---|
| `src/app/` | หน้าเว็บ (App Router) + API ที่ `src/app/api/` |
| `src/components/` | `site/` = โครงเว็บ · `home/` = หน้าแรก · `admin/` = หลังบ้าน · `ui/` = ตัวเล็ก ๆ |
| `src/data/home.ts` | เนื้อหาหน้าแรกที่ยังไม่ได้ย้ายเข้าฐานข้อมูล (แก้ในไฟล์) |
| `src/data/asset/` | รูปที่ import เข้า bundle — **ตั้งชื่อไฟล์เป็น ASCII เท่านั้น** |
| `src/lib/` | `db.ts` (Prisma client) · `auth.ts` (session) · `settings.ts` (ค่าหน้าแรกในฐานข้อมูล) |
| `src/proxy.ts` | กัน `/admin` ไม่ให้เปิดจากโดเมนสาธารณะ |
| `prisma/` | schema + migrations + seed |

## หน้าเว็บตอนนี้

หน้าบ้าน `/` · `/splash` (หน้าวันสำคัญ) · `/about/directory/board` (คณะกรรมการ)
หลังบ้าน `/admin` · `/admin/home` · `/admin/pages` · `/admin/users`

หลังบ้านเข้าได้เฉพาะโดเมนที่ตั้งใน `ADMIN_HOST` กับ localhost — โดเมนอื่นตอบ 404

## ทำงานจากอีกเครื่อง (เช่นเครื่องที่บ้าน)

```bash
git clone https://github.com/Diffking/website-spsccoop.git
cd website-spsccoop
cp .env.example .env      # อย่าใส่ TUNNEL_TOKEN ที่เครื่องบ้าน (ดูคำเตือนข้างล่าง)
npm install
docker compose up -d db-dev
npx prisma migrate deploy
npx prisma db seed
npm run dev               # http://localhost:3000
```

### ⚠️ ที่เครื่องบ้าน ห้ามสั่ง `docker compose up -d` เปล่า ๆ

คำสั่งนั้นจะสตาร์ต `cloudflared` ด้วย ถ้าใส่ `TUNNEL_TOKEN` ตัวจริงไว้ จะมีอุโมงค์
**สองตัวใช้โทเคนเดียวกัน** Cloudflare จะสลับส่งคนเข้าเว็บไปเครื่องบ้านบ้าง
สมาชิกจะเจอเว็บที่ข้อมูลว่างเปล่าสลับกับเว็บจริง หาสาเหตุยากมาก

ที่เครื่องบ้านสั่งเฉพาะบริการที่ต้องใช้: `docker compose up -d db-dev`

### ข้อมูลกับรูปไม่ได้อยู่ใน git

ต้องก๊อปมาเองจากเครื่องที่เสิร์ฟเว็บจริง (ใส่ USB หรือส่งไฟล์) — เอาไปแค่พอทดสอบก็พอ

| ต้องการ | เอามาจาก |
|---|---|
| เนื้อหาในเว็บ | `backups/coopsmile-YYYY-MM-DD.sql` |
| รูปที่อัปจากหลังบ้าน | `backups/uploads-YYYY-MM-DD.tar.gz` |
| ค่าตั้งลับ (คีย์ AI, FTP) | `.env` — **ห้าม commit** |

```bash
# ลงข้อมูลจริงใน db-dev ที่เครื่องบ้าน (ใช้ Git Bash)
docker compose exec -T db-dev psql -U coopsmile coopsmile < backups/ไฟล์.sql
tar -xzf backups/uploads-ไฟล์.tar.gz -C uploads/
```

ไม่มีไฟล์สำรองก็ทำงานได้ แค่เว็บจะว่าง ๆ — `prisma db seed` สร้างผู้ใช้หลังบ้านให้แล้ว
(รหัส 07337) พอเข้าไปกรอกเนื้อหาทดสอบเองได้

### ส่งงานกลับ

```bash
git switch -c ชื่อกิ่ง
git push -u origin ชื่อกิ่ง     # แล้วเปิด PR หรือ merge เข้า main
```

แล้วที่เครื่องเสิร์ฟเว็บจริง `git pull` + `docker compose up -d --build web`
ถ้าแก้ schema ต้องมี `prisma/migrations/` ติดไปด้วย บริการ `migrate` จะลงตารางให้เอง

## คำสั่งที่ใช้บ่อย

```bash
npm run dev                            # เซิร์ฟเวอร์พัฒนา
npm run build                          # ตรวจว่า build ผ่านก่อน deploy
npm run lint
npx prisma migrate dev --name ชื่อ      # แก้ schema แล้วสร้าง migration (ลง db-dev)
docker compose up -d --build web       # deploy ขึ้นเว็บจริง
```

รายละเอียดการ deploy · พอร์ต · ข้อควรระวัง อยู่ใน [AGENTS.md](AGENTS.md)
