// ก๊อป worker ของ pdf.js ไปไว้ใน public/ ตอน build
// ต้องเสิร์ฟจากโดเมนเดียวกับเว็บ ไม่งั้นเบราว์เซอร์บล็อกด้วย CORS
// (รันอัตโนมัติผ่าน npm script "prebuild" — ไฟล์ปลายทางอยู่ใน .gitignore ไม่ต้อง commit)
import { cpSync, copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const worker = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
const root = path.dirname(path.dirname(worker)); // .../pdfjs-dist

mkdirSync("public", { recursive: true });
copyFileSync(worker, "public/pdf.worker.min.mjs");

// cmaps + ฟอนต์มาตรฐาน — ไฟล์ที่ไม่ฝังฟอนต์มาด้วยต้องใช้สองอันนี้ ไม่งั้นตัวหนังสือหาย
cpSync(path.join(root, "cmaps"), "public/pdfjs/cmaps", { recursive: true });
cpSync(path.join(root, "standard_fonts"), "public/pdfjs/standard_fonts", { recursive: true });

// wasm — ประกาศที่สแกนมาเป็นภาพขาวดำบีบอัดแบบ JBIG2 ต้องมีตัวถอดรหัสนี้ ไม่งั้นได้หน้าเปล่า
cpSync(path.join(root, "wasm"), "public/pdfjs/wasm", { recursive: true });

console.log("คัดลอก pdf worker + cmaps + standard_fonts + wasm ไป public/ แล้ว");
