import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Cloudflare Worker ของแบบประเมิน — โปรเจกต์ย่อยแยก รันบน Cloudflare ไม่ใช่ Next
    "cloudflare/**",
    // ไฟล์ของ pdf.js ที่ก๊อปมาตอน build — โค้ดคนอื่น ไม่ต้องตรวจ
    "public/pdf.worker.min.mjs",
    "public/pdfjs/**",
  ]),
]);

export default eslintConfig;
