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

    for (const level of LEVELS) {
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
          { timeout: 120_000, maxBuffer: 8 * 1024 * 1024 },
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
