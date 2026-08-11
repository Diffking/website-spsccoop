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

## คำสั่งที่ใช้บ่อย

```bash
npm run dev                            # เซิร์ฟเวอร์พัฒนา
npm run build                          # ตรวจว่า build ผ่านก่อน deploy
npm run lint
npx prisma migrate dev --name ชื่อ      # แก้ schema แล้วสร้าง migration (ลง db-dev)
docker compose up -d --build web       # deploy ขึ้นเว็บจริง
```

รายละเอียดการ deploy · พอร์ต · ข้อควรระวัง อยู่ใน [AGENTS.md](AGENTS.md)
