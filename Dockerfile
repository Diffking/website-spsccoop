# Next.js standalone — image เล็ก ไม่ต้องมี node_modules ทั้งก้อนตอนรัน
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runtime
WORKDIR /app

# ghostscript = ตัวบีบไฟล์ PDF ที่หลังบ้านอัปเข้ามา (ดู src/lib/pdf.ts)
# ไม่มีตัวนี้ระบบยังทำงานได้ แค่เก็บไฟล์ต้นฉบับไปเลยโดยไม่บีบ
RUN apk add --no-cache ghostscript

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# standalone มี node_modules ของตัวเองมาด้วย ต้องวางก่อนแล้วค่อยเติม prisma ทับ
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# ไม่ต้องมี prisma CLI ใน image นี้ — การ migrate ทำที่ service "migrate" แยกต่างหาก
# (CLI ต้องการ dependency อีกหลายตัวที่ standalone ไม่ได้ลากมาด้วย)
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3000
CMD ["node", "server.js"]
