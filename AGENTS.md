# AGENTS.md

ข้อควรรู้ก่อนแก้อะไรในโปรเจกต์นี้ — เรื่องที่ดูจากโค้ดอย่างเดียวไม่รู้

## ⚠️ เครื่องพัฒนาเครื่องนี้คือเครื่องที่เสิร์ฟเว็บจริง

`docker compose` ในโฟลเดอร์นี้รัน **เว็บจริงของ coopsmile.org** อยู่ (service `cloudflared` ต่อ tunnel
เข้า `web`) ไม่ใช่ของทดลอง คำสั่งที่ห้ามสั่งเล่น:

- `docker compose down -v` — ลบ volume `pgdata` = ข้อมูลจริงหายถาวร ไม่มีเครื่องสำรอง
- `docker image prune` — ลบ image เก่าที่ใช้ถอยกลับตอน deploy พัง
- `docker compose stop cloudflared` — เว็บจริงหลุดจากโดเมนทันที (ใช้ตอนตั้งใจปิดเท่านั้น)

## ฐานข้อมูลมีสองก้อน อย่าสลับกัน

| service | พอร์ตบนเครื่อง | ใครใช้ |
|---|---|---|
| `db` | `127.0.0.1:5435` | เว็บจริงใน Docker (ต่อผ่านชื่อ `db:5432` ในเน็ตเวิร์ก) |
| `db-dev` | `127.0.0.1:5436` | `npm run dev` และ prisma CLI บนเครื่อง |

`DATABASE_URL` ใน `.env` ชี้ **5436** ไว้แล้ว — `npx prisma migrate dev` จึงลงที่ db-dev เท่านั้น
ส่วน container เว็บจริงไม่เคยอ่านค่านี้ เพราะ `docker-compose.yml` ตั้ง `DATABASE_URL` ใน
`environment:` ซึ่งทับ `env_file` อยู่แล้ว

ถ้าจำเป็นต้องต่อฐานจริง (แก้ข้อมูลด่วน) ให้เปลี่ยน `.env` เป็น 5435 ชั่วคราวแล้ว**เปลี่ยนกลับทันที**

## รอบการ deploy

```bash
npm run build                       # ให้ผ่านก่อน แล้วค่อยแตะ container
docker compose up -d --build web    # เว็บจริงสะดุด ~1-2 นาที
```

แก้ schema ต้อง commit โฟลเดอร์ `prisma/migrations/` ไปด้วย — service `migrate` จะรัน
`prisma migrate deploy` ให้เองก่อน `web` สตาร์ต ถ้าลืม commit ตารางจริงจะไม่ตรงกับโค้ด

## ห้ามตั้งชื่อไฟล์รูปเป็นภาษาไทย

`src/data/asset/**` ถูก import เข้า bundle ตรง ๆ Next เอาชื่อไฟล์ไปใส่ header `Link` (early preload)
ซึ่งเก็บได้แค่ Latin-1 พอมีอักษรไทยจะ throw ทุก request:

```
TypeError: Cannot convert argument to a ByteString ... value of 3626
```

ชื่อไฟล์เป็น ASCII เสมอ ส่วนชื่อคน/หัวข้อภาษาไทยเก็บในโค้ด เช่น array `members` ใน
`src/app/about/directory/board/page.tsx` ที่จับคู่ `committee-01.png` → ชื่อกรรมการ

**กฎเดียวกันใช้กับค่าใน HTTP header ทุกที่** — เคยพลาดมาแล้วที่ `X-Title` ตอนเรียก OpenRouter
ใส่ชื่อระบบเป็นภาษาไทย แล้ว `fetch` throw ทุกครั้งที่กดให้ AI อ่านภาพ

## AI อ่านภาพประกาศ — เรียกผ่าน OpenRouter

`src/lib/ai.ts` ยิง HTTP ตรงไปที่ `openrouter.ai/api/v1/chat/completions` (หน้าตาแบบ OpenAI)
ไม่ได้ใช้ SDK ของเจ้าไหน คีย์อ่านจาก `OPENROUTER_API_KEY` · รุ่นเปลี่ยนได้ที่ `AI_MODEL`
ไม่ตั้ง = `anthropic/claude-sonnet-5`

รุ่นที่เลือกต้อง **อ่านภาพได้ + รองรับ structured outputs** เช็คได้ที่
`GET /api/v1/models` ดูว่ามี `image` ใน `architecture.input_modalities` และ
`structured_outputs` ใน `supported_parameters` ไม่งั้นจะได้ JSON โครงไม่ตรงแล้ว parse พัง

ไม่มีคีย์ = `AI_READY` เป็น false ปุ่ม AI ถูกซ่อนไปเอง หลังบ้านยังใช้ได้ปกติแค่ต้องพิมพ์เอง
**AI ไม่เคยบันทึกลงฐานเอง** — คืนค่าไปเติมในฟอร์มให้เจ้าหน้าที่ตรวจแล้วกดยืนยันเสมอ

อ่านโปสเตอร์หนึ่งใบ ≈ 2,000 token ≈ 0.006 ดอลลาร์ ดูยอดคงเหลือได้ที่
`curl -H "Authorization: Bearer $OPENROUTER_API_KEY" https://openrouter.ai/api/v1/key`

## สถิติผู้เข้าชมนับเอง ไม่ได้ใช้บริการภายนอก

`src/lib/analytics.ts` + `POST /api/track` — หน้าเว็บยิงแจ้งด้วย JavaScript หลังโหลดเสร็จ
(ไม่นับฝั่ง server ตอน render เพราะบอทกับตัวไต่เว็บจะถูกนับไปด้วย ตัวเลขจะสูงเกินจริง)

เก็บสองตาราง: `PageView` = จำนวนครั้งต่อหน้าต่อวัน · `VisitorDay` = จำนวนคนต่อวัน
**ไม่เก็บ IP ไม่เก็บ cookie** — ลายนิ้วมือถูกแฮชรวมกับวันที่ คนเดิมจึงกลายเป็นค่าใหม่ทุกวัน
ตั้ง `ANALYTICS_SALT` ใน `.env` เพื่อกันคนเดารหัสย้อนกลับ

วันที่เก็บเป็น "เที่ยงคืนเวลาไทย" ซึ่งใน Postgres คือ 17:00Z ของวันก่อนหน้า —
`day::date` ใน psql จะโชว์วันที่ก่อนหน้า 1 วัน **นั่นถูกแล้ว** อย่าไปแก้

กราฟวาดด้วย HTML/CSS ล้วนใน `src/components/admin/StatsCharts.tsx` ไม่มี chart library
ซีรีส์เดียว = สีเดียว (`#1c7fca`) ผ่านเกณฑ์ contrast บนพื้นขาวแล้ว

## รูปที่อัปจากหลังบ้านเก็บที่ไหน

เก็บลง `uploads/` ของเครื่องนี้เสมอ (mount เข้า container ที่ `/app/public/uploads`)
ถ้าตั้งค่า `FTP_*` + `ASSETS_BASE_URL` ครบใน `.env` จะส่งสำเนาขึ้น FTP ด้วย แล้วบันทึก URL
ของโดเมนนั้นลงฐานแทน — ส่งไม่สำเร็จก็ถอยมาใช้ไฟล์ในเครื่อง **การอัปในหลังบ้านไม่พังตาม FTP**

`next.config.ts` ตั้ง `images.unoptimized: true` ไว้ ภาพจากโดเมนภายนอกจึงใช้ได้เลย
ไม่ต้องประกาศ `images.remotePatterns` — ถ้าวันไหนเปิด image optimization ต้องมาเพิ่มโดเมนตรงนั้นด้วย

`uploads/` ถูกสำรองรายวันแล้วโดย service `db-backup` (ดูหัวข้อสำรองข้อมูลด้านล่าง)

**รูปถูกย่อก่อนเก็บเสมอ** — `src/lib/image.ts` (sharp) ย่อให้ด้านยาวสุดไม่เกิน `MAX_EDGE` = 600px
คงสัดส่วนเดิม ไม่ตัดขอบ (ประกาศมีทั้งแนวตั้งแนวนอน ตัดเป็นจัตุรัสแล้วเนื้อหาหาย)
**เก็บเฉพาะไฟล์ที่ย่อแล้ว ไม่ได้เก็บต้นฉบับ** ย้อนกลับไม่ได้ · GIF ปล่อยผ่านไม่ย่อ (ภาพเคลื่อนไหวเสีย)
`.rotate()` ไว้ก่อน resize เพราะรูปจากมือถือฝังทิศทางไว้ใน EXIF ไม่งั้นได้ภาพตะแคง

ส่วน AI ยังอ่าน **ไฟล์ต้นฉบับ** ที่เบราว์เซอร์ส่งไปอีกทาง ไม่ได้อ่านตัวที่ย่อแล้ว — ตัวอักษรในประกาศ
ที่ย่อเหลือ 600px จะอ่านไม่ออก

sharp เป็น native module — image เป็น alpine (musl) `npm ci` ในคอนเทนเนอร์จะหยิบ
`@img/sharp-linuxmusl-x64` ให้เอง อย่าก๊อป `node_modules` จากเครื่อง Windows เข้าไป

## ไฟล์ที่ไม่อยู่ใน git — ต้องก๊อปมือเวลาย้ายเครื่อง

`.env` (มี `TUNNEL_TOKEN` ตัวจริง) · `backups/*.sql` · `uploads/` · `_data/`
`.env.example` ติด repo ไว้ให้รู้ว่าต้องตั้งตัวแปรอะไรบ้าง

## สำรองข้อมูล

service `db-backup` ทำงานทุก 24 ชม. เก็บย้อนหลัง 14 วัน ลง `backups/`

| ไฟล์ | คืออะไร |
|---|---|
| `coopsmile-YYYY-MM-DD.sql` | ฐานข้อมูล |
| `uploads-YYYY-MM-DD.tar.gz` | รูปที่อัปจากหลังบ้าน |

ต้องกู้ทั้งสองอย่างคู่กัน — กู้แต่ฐานจะเหลือ path ที่ชี้ไปไฟล์ที่ไม่มีอยู่ หน้าเว็บรูปแตก

```bash
# กู้คืน
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U coopsmile coopsmile < backups/ไฟล์.sql
tar -xzf backups/uploads-ไฟล์.tar.gz -C uploads/
```

`migration/import-new-machine.sh` ทำขั้นตอนกู้ทั้งชุดให้ (สำรองของเดิมไว้ก่อนแล้วค่อยทับ)

## เรื่องจุกจิกของ shell บนเครื่องนี้

รันสคริปต์ด้วย **Git Bash** — PowerShell 5.1 ไม่รองรับ `<` (input redirection) คำสั่ง restore
ฐานข้อมูลจะฟ้อง `The '<' operator is reserved` ถ้าเลี่ยงไม่ได้ให้ห่อด้วย `cmd /c "... < file.sql"`
(อย่าใช้ `Get-Content | ...` ภาษาไทยใน dump จะเพี้ยน)

## พอร์ตที่ระบบนี้จอง

`8030` เว็บจริง · `5435` db · `5436` db-dev · `3000` `npm run dev`
