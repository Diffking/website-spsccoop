import sharp from "sharp";

/**
 * ย่อรูปที่อัปจากหลังบ้านก่อนเก็บ
 *
 * ประกาศที่สแกนมามักเป็นไฟล์ 3-8 MB ขนาด 2000-4000px ซึ่งใหญ่เกินความจำเป็นมาก
 * หน้าเว็บโหลดช้าและกินพื้นที่ FTP เปล่า ๆ ย่อให้ด้านที่ยาวที่สุดไม่เกิน 600px
 *
 * คงสัดส่วนเดิมเสมอ ไม่ตัดขอบ — ประกาศเป็นแนวตั้งบ้างแนวนอนบ้าง ถ้าบังคับเป็นจัตุรัส
 * หัวประกาศหรือวันที่ท้ายกระดาษจะหายไป
 */

export const MAX_EDGE = 600;

/** รูปที่เล็กกว่านี้อยู่แล้วจะไม่ถูกขยาย และไม่ถูกบีบซ้ำ */
export async function shrink(
  input: Buffer<ArrayBuffer>,
  mimeType: string,
  /** ด้านยาวสุดที่ยอมให้เหลือ — รูปในหน้าเนื้อหาใช้ค่ามากกว่านี้เพราะกินพื้นที่อ่านเต็มคอลัมน์ */
  maxEdge: number = MAX_EDGE,
): Promise<{ bytes: Buffer<ArrayBuffer>; width: number; height: number; ext: string }> {
  // GIF ปล่อยผ่าน — ย่อแล้วภาพเคลื่อนไหวมักเสีย และแทบไม่มีใครอัป GIF เป็นประกาศ
  if (mimeType === "image/gif") {
    const meta = await sharp(input).metadata().catch(() => null);
    return { bytes: input, width: meta?.width ?? 0, height: meta?.height ?? 0, ext: "gif" };
  }

  const pipeline = sharp(input)
    // กล้องมือถือฝังทิศทางไว้ใน EXIF ถ้าไม่หมุนตามจะได้ภาพตะแคง
    .rotate()
    .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true });

  /*
   * เก็บเป็น WebP เสมอ ไม่ว่าต้นทางจะเป็นอะไร
   *
   * ⚠️ 22 ส.ค. 2026 พบว่ารูปสไลด์ที่อัปเป็น PNG หนักใบละ 300-700 KB ทั้งที่ย่อเหลือ
   * 600px แล้ว เพราะ PNG ไม่ได้ออกแบบมาสำหรับภาพถ่าย — หน้าแรกเลยหนักหลายเมกะไบต์
   * และคะแนนมือถือตก · WebP ที่คุณภาพเท่ากันเล็กกว่า 5-10 เท่า และรองรับทุกเบราว์เซอร์
   * ที่เว็บนี้รองรับอยู่แล้ว (Tailwind v4 ต้องการเบราว์เซอร์ใหม่กว่า WebP มาก)
   */
  const { data, info } = await pipeline
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  return { bytes: data, width: info.width, height: info.height, ext: "webp" };
}
