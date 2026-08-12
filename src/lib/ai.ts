/**
 * ให้ AI อ่านภาพประกาศแล้วถอดข้อมูลออกมาเป็นช่อง ๆ ให้เจ้าหน้าที่ตรวจก่อนบันทึก
 *
 * ระบบ "ไม่" บันทึกเองอัตโนมัติ — คืนค่าที่อ่านได้กลับไปเติมในฟอร์ม
 * คนกดยืนยันอีกทีเสมอ เพราะ AI อ่านผิดได้และนี่คือเนื้อหาบนเว็บของสหกรณ์
 *
 * เรียกผ่าน OpenRouter (https://openrouter.ai) ซึ่งเป็น API แบบเดียวกับ OpenAI
 * เปลี่ยนรุ่นได้ที่ตัวแปร AI_MODEL ใน .env โดยไม่ต้องแก้โค้ด
 * รุ่นที่ใช้ต้องอ่านภาพได้และรองรับ structured outputs ไม่งั้นจะได้ JSON ที่โครงไม่ตรง
 */

const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "anthropic/claude-sonnet-5";

const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
const model = process.env.AI_MODEL || DEFAULT_MODEL;

export const AI_READY = Boolean(apiKey);

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

export type MediaType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif"
  | "application/pdf";

export type AnnouncementDraft = {
  /** เลขที่ประกาศ เช่น "19/2569" — "" ถ้าในเอกสารไม่ได้ระบุ */
  number: string;
  title: string;
  /** "YYYY-MM-DD" หรือ "" */
  publishedAt: string;
};

class AiNotConfigured extends Error {
  constructor() {
    super("ยังไม่ได้ตั้งค่าคีย์ AI (OPENROUTER_API_KEY) ในไฟล์ .env");
    this.name = "AiNotConfigured";
  }
}

/** ดึง JSON ออกจากคำตอบ — โครงถูกบังคับด้วย json_schema อยู่แล้ว แต่กันเหนียวไว้ */
function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("AI ตอบกลับมาในรูปแบบที่อ่านไม่ได้ ลองใหม่อีกครั้ง");
  }
}

type Completion = {
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  error?: { message?: string };
};

async function readImage<T>(
  base64: string,
  mediaType: MediaType,
  instruction: string,
  schemaName: string,
  schema: Record<string, unknown>,
): Promise<T> {
  if (!AI_READY) throw new AiNotConfigured();

  // PDF ส่งเป็นบล็อก file ส่วนรูปส่งเป็น image_url — รุ่นที่ใช้อ่าน PDF ได้เองไม่ต้องแปลงเป็นภาพก่อน
  const attachment =
    mediaType === "application/pdf"
      ? {
          type: "file",
          file: { filename: "document.pdf", file_data: `data:${mediaType};base64,${base64}` },
        }
      : { type: "image_url", image_url: { url: `data:${mediaType};base64,${base64}` } };

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // OpenRouter ใช้สองอันนี้แสดงที่มาของ traffic ในหน้าสถิติของบัญชี
      // ค่าใน header เป็น ASCII เท่านั้น ใส่ภาษาไทยแล้ว fetch จะ throw ByteString ทันที
      "HTTP-Referer": "https://coopsmile.org",
      "X-Title": "coopsmile admin",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: instruction }, attachment],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: schemaName, strict: true, schema },
      },
    }),
  });

  const data = (await response.json().catch(() => ({}))) as Completion;

  if (!response.ok) {
    // ข้อความจาก OpenRouter เป็นภาษาอังกฤษ ใส่ต่อท้ายไว้ให้ผู้ดูแลระบบไล่ปัญหาได้
    const detail = data.error?.message ? ` (${data.error.message})` : "";
    if (response.status === 401) throw new Error(`คีย์ AI ไม่ถูกต้องหรือหมดอายุ${detail}`);
    if (response.status === 402) throw new Error(`เครดิต AI หมด กรุณาเติมเงินที่ OpenRouter${detail}`);
    if (response.status === 429) throw new Error(`เรียก AI ถี่เกินไป รอสักครู่แล้วลองใหม่${detail}`);
    throw new Error(`เรียก AI ไม่สำเร็จ${detail}`);
  }

  const choice = data.choices?.[0];
  if (choice?.finish_reason === "content_filter") {
    throw new Error("AI ไม่สามารถอ่านภาพนี้ได้ กรุณากรอกข้อมูลเอง");
  }

  const text = choice?.message?.content;
  if (!text) {
    throw new Error("AI ไม่ได้ตอบข้อความกลับมา ลองใหม่อีกครั้ง");
  }
  return parseJson<T>(text);
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

export function readSlideFromImage(base64: string, mediaType: MediaType) {
  return readImage<SlideDraft>(
    base64,
    mediaType,
    "นี่คือภาพประกาศของสหกรณ์ออมทรัพย์ อ่านข้อความในภาพแล้วสรุปเป็นหัวข้อและคำอธิบายสำหรับใช้เป็นแบนเนอร์บนหน้าเว็บ " +
      "ตอบเป็นภาษาไทย ใช้ถ้อยคำทางการ เอาเฉพาะสาระที่อยู่ในภาพจริง ห้ามแต่งเติมตัวเลขหรือเงื่อนไขที่ไม่ได้เขียนไว้ " +
      "เรื่องวันที่: ประกาศไทยมักเขียนปีเป็น พ.ศ. ให้แปลงเป็น ค.ศ. ก่อนตอบ (ลบ 543 เช่น 2569 = 2026) " +
      "และแปลงชื่อเดือนไทยเป็นตัวเลข เช่น 8 มิถุนายน 2569 = 2026-06-08 " +
      'วันไหนที่ภาพไม่ได้ระบุไว้ให้ตอบเป็นข้อความว่าง "" ห้ามเดาเองเด็ดขาด',
    "slide_draft",
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

export function readRatesFromImage(base64: string, mediaType: MediaType) {
  return readImage<RatesDraft>(
    base64,
    mediaType,
    "นี่คือภาพประกาศอัตราดอกเบี้ยของสหกรณ์ออมทรัพย์ อ่านตารางในภาพแล้วแยกเป็นรายการเงินฝากและเงินกู้ " +
      "ช่อง rate ใส่เฉพาะตัวเลขไม่ต้องมีเครื่องหมาย % เอาเฉพาะรายการที่อยู่ในภาพจริง ห้ามเดาตัวเลขที่อ่านไม่ออก",
    "rates_draft",
    RATES_SCHEMA,
  );
}

const ANNOUNCEMENT_SCHEMA = {
  type: "object",
  properties: {
    number: {
      type: "string",
      description:
        'เลขที่เอกสารพร้อมปี พ.ศ. ตามที่เขียนในเอกสาร เช่น "19/2569" — ถ้าไม่ได้ระบุให้ตอบ ""',
    },
    title: {
      type: "string",
      description:
        'ชื่อเรื่องของเอกสาร ไม่ต้องมีคำว่า "เรื่อง" นำหน้า — ถ้าเอกสารไม่ได้เขียนหัวเรื่องไว้ตรง ๆ ' +
        "ให้สรุปสาระสำคัญเป็นประโยคเดียวไม่เกิน 120 ตัวอักษร ช่องนี้ห้ามว่าง",
    },
    publishedAt: {
      type: "string",
      description:
        'วันที่ของเอกสารในรูปแบบ YYYY-MM-DD (ค.ศ.) เช่น 2026-06-30 — ถ้าไม่ได้ระบุให้ตอบ ""',
    },
  },
  required: ["number", "title", "publishedAt"],
  additionalProperties: false,
};

export function readAnnouncementFromFile(base64: string, mediaType: MediaType) {
  return readImage<AnnouncementDraft>(
    base64,
    mediaType,
    "นี่คือประกาศ จดหมายข่าว หรือรายงานกิจการของสหกรณ์ออมทรัพย์ " +
      "อ่านเอกสารแล้วบอกเลขที่ ชื่อเรื่อง และวันที่ของเอกสาร ตอบเป็นภาษาไทยตามที่เขียนไว้จริง " +
      "เลขที่ให้คงปี พ.ศ. ไว้ตามเอกสาร เช่น 19/2569 " +
      "ส่วนช่องวันที่ให้แปลงเป็น ค.ศ. (ลบ 543) และแปลงชื่อเดือนไทยเป็นตัวเลข เช่น 30 มิถุนายน 2569 = 2026-06-30 " +
      'เลขที่กับวันที่ ถ้าเอกสารไม่ได้ระบุให้ตอบเป็นข้อความว่าง "" ห้ามเดาเองเด็ดขาด ' +
      "ส่วนชื่อเรื่องต้องมีเสมอ ถ้าเอกสารไม่ได้เขียนหัวเรื่องไว้ ให้สรุปเนื้อหาที่อ่านได้เป็นชื่อเรื่องสั้น ๆ",
    "announcement_draft",
    ANNOUNCEMENT_SCHEMA,
  );
}
