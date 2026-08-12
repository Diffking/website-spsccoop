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
): Promise<{ bytes: Buffer<ArrayBuffer>; width: number; height: number }> {
  // GIF ปล่อยผ่าน — ย่อแล้วภาพเคลื่อนไหวมักเสีย และแทบไม่มีใครอัป GIF เป็นประกาศ
  if (mimeType === "image/gif") {
    const meta = await sharp(input).metadata().catch(() => null);
    return { bytes: input, width: meta?.width ?? 0, height: meta?.height ?? 0 };
  }

  const pipeline = sharp(input)
    // กล้องมือถือฝังทิศทางไว้ใน EXIF ถ้าไม่หมุนตามจะได้ภาพตะแคง
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true });

  const output =
    mimeType === "image/png"
      ? pipeline.png({ compressionLevel: 9 })
      : mimeType === "image/webp"
        ? pipeline.webp({ quality: 82 })
        : pipeline.jpeg({ quality: 82, mozjpeg: true });

  const { data, info } = await output.toBuffer({ resolveWithObject: true });
  return { bytes: data, width: info.width, height: info.height };
}
