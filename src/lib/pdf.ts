import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * บีบไฟล์ PDF ให้เล็กลงด้วย Ghostscript ก่อนเก็บ
 *
 * ประกาศที่สแกนมามักตั้งความละเอียดสูงเกินจำเป็น ไฟล์เลยหนักหลายสิบ MB
 * ทั้งที่เป็นกระดาษขาวดำ — สมาชิกโหลดช้าและกินพื้นที่ FTP เปล่า ๆ
 *
 * เราไม่ทิ้งไฟล์ของผู้ใช้: ลองบีบไล่จากคุณภาพสูงไปต่ำจนกว่าจะเข้าเป้า
 * บีบไม่ได้ (ไม่มี Ghostscript / ไฟล์แปลก) ก็เก็บต้นฉบับไปตามเดิม
 */

/** ไล่จากคุณภาพดีสุดไปหยาบสุด — หยุดทันทีที่ได้ไฟล์เข้าเป้า */
const LEVELS = [
  { preset: "/ebook", dpi: 150, label: "150 dpi" },
  { preset: "/ebook", dpi: 110, label: "110 dpi" },
  { preset: "/screen", dpi: 90, label: "90 dpi" },
  { preset: "/screen", dpi: 72, label: "72 dpi" },
] as const;

/**
 * ไฟล์ยิ่งใหญ่ยิ่งต้องเริ่มที่ระดับหยาบ ไม่งั้นต้องบีบหลายรอบจนหมดเวลา
 * (Cloudflare ตัดสายที่ 100 วินาที รายงานกิจการเป็นร้อยหน้าบีบสี่รอบไม่ทันแน่)
 */
function startLevel(bytes: number): number {
  const mb = bytes / 1024 / 1024;
  if (mb > 40) return 3;
  if (mb > 25) return 2;
  if (mb > 12) return 1;
  return 0;
}

/** เวลามากสุดที่ยอมใช้บีบทั้งหมด — หมดเวลาแล้วเอาผลดีที่สุดที่ได้ */
const BUDGET_MS = 45_000;

export type CompressResult = {
  bytes: Buffer<ArrayBuffer>;
  /** บีบแล้วจริงไหม */
  compressed: boolean;
  /** ระดับที่ใช้ เช่น "110 dpi" — ว่างถ้าไม่ได้บีบ */
  level: string;
};

/** Ghostscript มีให้ใช้ไหม — เครื่องพัฒนาบน Windows มักไม่มี ต้องข้ามไปเฉย ๆ */
async function hasGhostscript(): Promise<boolean> {
  try {
    await run("gs", ["--version"], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

export async function compressPdf(
  input: Buffer<ArrayBuffer>,
  targetBytes: number,
): Promise<CompressResult> {
  const untouched: CompressResult = { bytes: input, compressed: false, level: "" };

  if (input.byteLength <= targetBytes) return untouched;
  if (!(await hasGhostscript())) {
    console.warn("ไม่มี Ghostscript ในเครื่องนี้ เก็บ PDF ต้นฉบับแทน");
    return untouched;
  }

  const dir = await mkdtemp(path.join(tmpdir(), "coop-pdf-"));
  const source = path.join(dir, "in.pdf");

  try {
    await writeFile(source, input);
    let best = untouched;
    const deadline = Date.now() + BUDGET_MS;

    for (const level of LEVELS.slice(startLevel(input.byteLength))) {
      if (Date.now() > deadline) {
        console.warn("บีบ PDF ใช้เวลานานเกินงบ หยุดแล้วใช้ผลที่ดีที่สุดเท่าที่ได้");
        break;
      }
      const out = path.join(dir, `out-${level.dpi}.pdf`);
      try {
        await run(
          "gs",
          [
            "-sDEVICE=pdfwrite",
            "-dCompatibilityLevel=1.5",
            `-dPDFSETTINGS=${level.preset}`,
            "-dNOPAUSE",
            "-dQUIET",
            "-dBATCH",
            "-dDetectDuplicateImages=true",
            // บังคับความละเอียดของภาพในไฟล์ — ตัวแปรหลักที่ทำให้ประกาศสแกนหนัก
            "-dDownsampleColorImages=true",
            `-dColorImageResolution=${level.dpi}`,
            "-dDownsampleGrayImages=true",
            `-dGrayImageResolution=${level.dpi}`,
            "-dDownsampleMonoImages=true",
            `-dMonoImageResolution=${Math.max(level.dpi, 200)}`,
            `-sOutputFile=${out}`,
            source,
          ],
          { timeout: Math.max(5_000, deadline - Date.now()), maxBuffer: 8 * 1024 * 1024 },
        );

        const result = await readFile(out);
        // ไฟล์บางแบบบีบแล้วใหญ่ขึ้น เก็บเฉพาะตอนที่เล็กลงจริง
        if (result.byteLength < best.bytes.byteLength) {
          best = { bytes: result as Buffer<ArrayBuffer>, compressed: true, level: level.label };
        }
        if (best.bytes.byteLength <= targetBytes) break;
      } catch (error) {
        console.error(`บีบ PDF ที่ ${level.label} ไม่สำเร็จ:`, error);
      }
    }

    return best;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * ตัดเอาเฉพาะ n หน้าแรกของ PDF
 *
 * ใช้ก่อนส่งให้ AI อ่าน — หัวเรื่องอยู่หน้าแรกเสมอ ส่งรายงานกิจการทั้งเล่มไปให้อ่าน
 * ทั้งช้าและเปลืองค่าเรียกใช้เปล่า ๆ · ตัดไม่ได้ก็คืนไฟล์เดิมไป
 */
export async function firstPages(input: Buffer<ArrayBuffer>, n: number): Promise<Buffer<ArrayBuffer>> {
  if (!(await hasGhostscript())) return input;

  const dir = await mkdtemp(path.join(tmpdir(), "coop-pdf-head-"));
  const source = path.join(dir, "in.pdf");
  const out = path.join(dir, "head.pdf");

  try {
    await writeFile(source, input);
    await run(
      "gs",
      [
        "-sDEVICE=pdfwrite",
        "-dNOPAUSE",
        "-dQUIET",
        "-dBATCH",
        "-dFirstPage=1",
        `-dLastPage=${n}`,
        `-sOutputFile=${out}`,
        source,
      ],
      { timeout: 30_000, maxBuffer: 8 * 1024 * 1024 },
    );
    const head = await readFile(out);
    return head.byteLength > 0 ? (head as Buffer<ArrayBuffer>) : input;
  } catch (error) {
    console.error("ตัดหน้าแรกของ PDF ไม่สำเร็จ ส่งทั้งไฟล์ให้ AI แทน:", error);
    return input;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
