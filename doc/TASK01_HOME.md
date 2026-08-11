# Task 01 — หน้า Home (เว็บใหม่แทน WordPress)

## สรุป
ทำหน้าแรก (Home) ของเว็บสหกรณ์ออมทรัพย์สาธารณสุขสงขลาใหม่ ตาม mockup ใน `design-preview/`
ด้วย **Next.js 16 (static export) + Tailwind CSS v4 + Framer Motion** รองรับทั้ง Desktop และ Mobile

- URL ทดสอบ: **https://beta.spsccoop.com**
- Deploy อัตโนมัติ: push ขึ้น `main` → GitHub Actions build → FTP อัปทับขึ้น beta

## Tech stack
| ส่วน | เลือกใช้ | เหตุผล |
|------|---------|--------|
| Framework | Next.js 16 (App Router) `output: 'export'` | ได้ static ล้วน อัป DirectAdmin ผ่าน FTP ได้ + SEO ดี |
| CSS | Tailwind CSS v4 | ตรงกับ mockup ปรับแต่งเร็ว |
| Animation | Framer Motion (`motion`) | fade/scroll-reveal/สไลด์ลื่น |
| ไอคอน | lucide-react | ชุดเดียวกับ mockup |
| ฟอนต์ | Sarabun (next/font, self-host) | ฟอนต์ไทยราชการอ่านง่าย |

## โครงสร้างไฟล์สำคัญ
- `src/data/home.ts` — **เนื้อหาหน้า Home ทั้งหมดอยู่ที่นี่** (แก้คำ/ตัวเลขที่ไฟล์เดียว)
- `src/app/layout.tsx` — ฟอนต์ + metadata/SEO
- `src/app/page.tsx` — ประกอบ section + JSON-LD
- `src/app/sitemap.ts`, `src/app/robots.ts` — SEO
- `src/components/site/` — Header (เมนู+นาฬิกาไทย+ปรับขนาดฟอนต์), Footer
- `src/components/home/` — Hero, NewsTicker, NewsSection, Services, Recommend, MemberCorner, CoopCalendar, OfficerService

## SEO หน้า Home
- `<title>` / meta description ภาษาไทย + keywords
- Open Graph + Twitter card (locale th_TH)
- **JSON-LD** `Organization` (ชื่อ/ที่อยู่/โทร/อีเมล)
- `sitemap.xml` + `robots.txt`

## สถานะ
- ✅ Layout ครบทุก section, responsive, deploy ขึ้น beta แล้ว (HTTP 200)
- ⏳ เนื้อหาตอนนี้เป็น **placeholder ถอดจาก mockup** — ขั้นต่อไปถอดของจริงจาก `_data/spsccoop_wp.sql` (WordPress dump) มาเสียบ

## คำสั่ง dev
```bash
npm run dev      # เปิด http://localhost:3000
npm run build    # สร้าง out/ (static export)
```
