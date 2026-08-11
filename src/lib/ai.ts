import Anthropic from "@anthropic-ai/sdk";

/**
 * ให้ AI อ่านภาพประกาศแล้วถอดข้อมูลออกมาเป็นช่อง ๆ ให้เจ้าหน้าที่ตรวจก่อนบันทึก
 *
 * ระบบ "ไม่" บันทึกเองอัตโนมัติ — คืนค่าที่อ่านได้กลับไปเติมในฟอร์ม
 * คนกดยืนยันอีกทีเสมอ เพราะ AI อ่านผิดได้และนี่คือเนื้อหาบนเว็บของสหกรณ์
 */

export const AI_READY = Boolean(process.env.ANTHROPIC_API_KEY);

export type SlideDraft = {
  title: string;
  caption: string;
  /** "YYYY-MM-DD" หรือ "" ถ้าในภาพไม่ได้บอกไว้ */
  startsAt: string;
  endsAt: string;
};
export type RatesDraft = {
  deposit: { label: string; rate: string }[];
  loan: { label: string; rate: string }[];
};

class AiNotConfigured extends Error {
  constructor() {
    super("ยังไม่ได้ตั้งค่าคีย์ AI (ANTHROPIC_API_KEY) ในไฟล์ .env");
    this.name = "AiNotConfigured";
  }
}

function client(): Anthropic {
  if (!AI_READY) throw new AiNotConfigured();
  return new Anthropic();
}

/** ดึง JSON ออกจากคำตอบ — โครงถูกบังคับด้วย output_config อยู่แล้ว แต่กันเหนียวไว้ */
function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("AI ตอบกลับมาในรูปแบบที่อ่านไม่ได้ ลองใหม่อีกครั้ง");
  }
}

async function readImage<T>(
  base64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif",
  instruction: string,
  schema: Record<string, unknown>,
): Promise<T> {
  const response = await client().messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema },
    },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: instruction },
        ],
      },
    ],
  });

  // คลาสสิฟายเออร์ฝั่ง Anthropic ปฏิเสธคำขอได้ ต้องเช็คก่อนอ่าน content
  if (response.stop_reason === "refusal") {
    throw new Error("AI ไม่สามารถอ่านภาพนี้ได้ กรุณากรอกข้อมูลเอง");
  }

  const text = response.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") {
    throw new Error("AI ไม่ได้ตอบข้อความกลับมา ลองใหม่อีกครั้ง");
  }
  return parseJson<T>(text.text);
}

const SLIDE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "หัวข้อสั้น ๆ ของประกาศ ไม่เกิน 60 ตัวอักษร" },
    caption: { type: "string", description: "สรุปสาระสำคัญ 1-2 ประโยค ไม่เกิน 160 ตัวอักษร" },
    startsAt: {
      type: "string",
      description:
        'วันเริ่มของเรื่องนี้ในรูปแบบ YYYY-MM-DD (ค.ศ.) เช่น 2026-06-08 — ถ้าในภาพไม่ได้ระบุให้ตอบ ""',
    },
    endsAt: {
      type: "string",
      description:
        'วันสุดท้ายที่เรื่องนี้ยังมีผล เช่น วันปิดรับสมัคร วันหมดเขต ในรูปแบบ YYYY-MM-DD (ค.ศ.) — ถ้าในภาพไม่ได้ระบุให้ตอบ ""',
    },
  },
  required: ["title", "caption", "startsAt", "endsAt"],
  additionalProperties: false,
};

export function readSlideFromImage(base64: string, mediaType: Parameters<typeof readImage>[1]) {
  return readImage<SlideDraft>(
    base64,
    mediaType,
    "นี่คือภาพประกาศของสหกรณ์ออมทรัพย์ อ่านข้อความในภาพแล้วสรุปเป็นหัวข้อและคำอธิบายสำหรับใช้เป็นแบนเนอร์บนหน้าเว็บ " +
      "ตอบเป็นภาษาไทย ใช้ถ้อยคำทางการ เอาเฉพาะสาระที่อยู่ในภาพจริง ห้ามแต่งเติมตัวเลขหรือเงื่อนไขที่ไม่ได้เขียนไว้ " +
      "เรื่องวันที่: ประกาศไทยมักเขียนปีเป็น พ.ศ. ให้แปลงเป็น ค.ศ. ก่อนตอบ (ลบ 543 เช่น 2569 = 2026) " +
      "และแปลงชื่อเดือนไทยเป็นตัวเลข เช่น 8 มิถุนายน 2569 = 2026-06-08 " +
      'วันไหนที่ภาพไม่ได้ระบุไว้ให้ตอบเป็นข้อความว่าง "" ห้ามเดาเองเด็ดขาด',
    SLIDE_SCHEMA,
  );
}

const RATES_SCHEMA = {
  type: "object",
  properties: {
    deposit: {
      type: "array",
      description: "รายการอัตราดอกเบี้ยเงินฝาก",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "ชื่อประเภทเงินฝาก" },
          rate: { type: "string", description: "อัตราต่อปี ใส่เฉพาะตัวเลข เช่น 1.75" },
        },
        required: ["label", "rate"],
        additionalProperties: false,
      },
    },
    loan: {
      type: "array",
      description: "รายการอัตราดอกเบี้ยเงินกู้",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "ชื่อประเภทเงินกู้" },
          rate: { type: "string", description: "อัตราต่อปี ใส่เฉพาะตัวเลข เช่น 5.75" },
        },
        required: ["label", "rate"],
        additionalProperties: false,
      },
    },
  },
  required: ["deposit", "loan"],
  additionalProperties: false,
};

export function readRatesFromImage(base64: string, mediaType: Parameters<typeof readImage>[1]) {
  return readImage<RatesDraft>(
    base64,
    mediaType,
    "นี่คือภาพประกาศอัตราดอกเบี้ยของสหกรณ์ออมทรัพย์ อ่านตารางในภาพแล้วแยกเป็นรายการเงินฝากและเงินกู้ " +
      "ช่อง rate ใส่เฉพาะตัวเลขไม่ต้องมีเครื่องหมาย % เอาเฉพาะรายการที่อยู่ในภาพจริง ห้ามเดาตัวเลขที่อ่านไม่ออก",
    RATES_SCHEMA,
  );
}
