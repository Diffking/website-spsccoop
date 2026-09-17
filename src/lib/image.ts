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

/**
 * จัดแสงให้รูปที่ถ่ายมาแล้วออกมาเทา ๆ — เจ้าของเว็บสั่งเปิดใช้ 17 ก.ย. 2569
 *
 * เอกสารที่ถ่ายด้วยมือถือในห้องทำงานมักไม่มีดำสนิทไม่มีขาวสว่าง ทั้งใบเป็นสีเทา
 * อ่านยากบนจอมือถือกลางแดด
 *
 * ⚠️ **ปรับแล้วย้อนไม่ได้ ระบบไม่เก็บไฟล์ต้นฉบับ** (กฎเดียวกับการย่อเหลือ 600px)
 * ได้รูปที่ไม่ถูกใจต้องอัปไฟล์เดิมเข้ามาใหม่อย่างเดียว — จึงกันไว้สามชั้น ดูในโค้ด
 *
 * ⚠️ **ห้ามใช้ `normalise()` เปล่า ๆ** มันดึงสุดทางเสมอ โปสเตอร์ที่ร้านออกแบบมาเป็น
 * โทนสว่างจะถูกดึงจนมืดลงทั้งใบ — สีที่เขาเลือกไว้เพี้ยนโดยไม่มีใครสั่ง
 */

/** ค่าความสว่างที่ตำแหน่ง 1% และ 99% ของภาพ — ตัวบอกว่า "ช่วงแสงที่ใช้จริง" กว้างแค่ไหน */
async function lightRange(
  input: Buffer<ArrayBuffer>,
): Promise<{ p1: number; p99: number } | null> {
  try {
    /*
     * ย่อเหลือ 128px ก่อนนับ — ได้รูปทรงของฮิสโทแกรมเท่ากันแต่เร็วกว่ามาก
     * (ภาพ 4000px มี 16 ล้านจุด ซึ่งไม่ได้ให้ข้อมูลเพิ่มอะไรเลยสำหรับงานนี้)
     */
    const { data } = await sharp(input)
      .greyscale()
      .resize({ width: 128, height: 128, fit: "inside" })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const hist = new Array<number>(256).fill(0);
    for (const v of data) hist[v]++;

    const at = (ratio: number): number => {
      const target = data.length * ratio;
      let acc = 0;
      for (let i = 0; i < 256; i++) {
        acc += hist[i];
        if (acc >= target) return i;
      }
      return 255;
    };
    return { p1: at(0.01), p99: at(0.99) };
  } catch {
    return null; // อ่านไม่ออกก็อย่าไปยุ่งกับภาพเขา
  }
}

/**
 * ชั้นกันพลาด 3 ชั้น — ตั้งใจให้ "ไม่ทำอะไรเลย" เป็นค่าตั้งต้น
 *
 * 1. ภาพที่มีขาวสว่างอยู่แล้ว (p99 ≥ 248) ไม่แตะ — นั่นคือโปสเตอร์ที่ออกแบบมา
 *    ไม่ใช่ภาพถ่ายที่แสงไม่พอ · วัดกับของจริงในเครื่องแล้ว กันใบที่เป็นโทนพาสเทลออกได้ครบ
 * 2. ภาพที่ช่วงแสงกว้างพออยู่แล้ว (p99 − p1 ≥ 200) ไม่แตะ
 * 3. ที่เหลือปรับแบบ **มีเพดาน** — คอนทราสต์เพิ่มได้ไม่เกิน 1.3 เท่า และยกจุดดำ
 *    ได้ไม่เกิน 24 ระดับ · ต่อให้เจอภาพประหลาดแค่ไหน ผลที่ออกมาก็เปลี่ยนไปได้จำกัด
 */
const LIFT_MAX_GAIN = 1.3;
const LIFT_MAX_BLACK = 24;

function liftFactors(p1: number, p99: number): { gain: number; offset: number } | null {
  if (p99 >= 248) return null;
  if (p99 - p1 >= 200) return null;

  const gain = Math.min(255 / Math.max(1, p99 - p1), LIFT_MAX_GAIN);
  const black = Math.min(p1, LIFT_MAX_BLACK);
  // linear(a, b) คือ out = a × in + b — เลื่อนจุดดำก่อนแล้วค่อยขยายคอนทราสต์
  return { gain, offset: -black * gain };
}

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
   * จัดแสงให้เฉพาะใบที่ถ่ายมาแล้วเทา — ดูเงื่อนไขและเพดานที่ liftFactors()
   * วัดจาก 1%/99% ไม่ใช่จุดมืดสุด/สว่างสุด เพราะจุดสะท้อนแสงจุดเดียวบนกระดาษมันวาว
   * (หรือเงาดำจุดเดียวที่มุมภาพ) ทำให้ min/max เป็น 0/255 แทบทุกใบ วัดแล้วไม่ได้ความ
   */
  const range = await lightRange(input);
  const lift = range && liftFactors(range.p1, range.p99);
  if (lift) pipeline.linear(lift.gain, lift.offset);

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
