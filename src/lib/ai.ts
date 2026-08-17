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

/**
 * ยิงคำถามไป OpenRouter แล้วบังคับให้ตอบเป็น JSON ตามโครงที่กำหนด
 * ใช้ร่วมกันทั้งงานอ่านไฟล์ (มีไฟล์แนบ) และงานข้อความล้วน
 */
async function askJson<T>(
  content: unknown[],
  schemaName: string,
  schema: Record<string, unknown>,
  maxTokens = 4000,
): Promise<T> {
  if (!AI_READY) throw new AiNotConfigured();

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
      max_tokens: maxTokens,
      messages: [{ role: "user", content }],
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

function readImage<T>(
  base64: string,
  mediaType: MediaType,
  instruction: string,
  schemaName: string,
  schema: Record<string, unknown>,
): Promise<T> {
  // PDF ส่งเป็นบล็อก file ส่วนรูปส่งเป็น image_url — รุ่นที่ใช้อ่าน PDF ได้เองไม่ต้องแปลงเป็นภาพก่อน
  const attachment =
    mediaType === "application/pdf"
      ? {
          type: "file",
          file: { filename: "document.pdf", file_data: `data:${mediaType};base64,${base64}` },
        }
      : { type: "image_url", image_url: { url: `data:${mediaType};base64,${base64}` } };

  return askJson<T>([{ type: "text", text: instruction }, attachment], schemaName, schema);
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

/** รายงานกิจการใช้เลขที่แบบ RS-63 (ปี พ.ศ. สองหลักท้าย) ไม่ใช่ "เลขที่/ปี" แบบประกาศ */
const NUMBER_RULE: Record<string, string> = {
  REPORT:
    'เลขที่ของรายงานกิจการให้ตอบในรูปแบบ "RS-xx" โดย xx คือสองหลักท้ายของปี พ.ศ. ที่รายงานนั้นครอบคลุม ' +
    "เช่น รายงานกิจการประจำปี 2563 = RS-63 · ประจำปี 2564 = RS-64 · ประจำปี 2569 = RS-69 " +
    "หาปีได้จากสองทาง ใช้ทางไหนก่อนก็ได้ที่เจอ: (1) ปีที่เขียนในเอกสาร " +
    '(2) ชื่อไฟล์ที่อัปมา — ถ้าชื่อไฟล์เป็นรูปแบบ RS_63 / RS-63 / RS63 ให้ตอบ "RS-63" ได้เลย ' +
    'ตอบ "" เฉพาะตอนที่หาปีไม่ได้จากทั้งสองทางจริง ๆ',
  ANNOUNCEMENT: 'เลขที่ให้คงรูปแบบตามเอกสาร เช่น "19/2569" (เลขที่/ปี พ.ศ.)',
  NEWSLETTER: 'เลขที่ฉบับให้คงรูปแบบตามเอกสาร เช่น "3/2569" (ฉบับที่/ปี พ.ศ.)',
};

const ANNOUNCEMENT_SCHEMA = {
  type: "object",
  properties: {
    number: {
      type: "string",
      description:
        'เลขที่เอกสารตามรูปแบบที่กำหนดไว้ในคำสั่ง — ถ้าหาไม่เจอให้ตอบ ""',
    },
    title: {
      type: "string",
      description:
        'ข้อความที่อยู่หลังคำว่า "เรื่อง" ในหัวประกาศ คัดลอกมาทั้งบรรทัดตามตัวอักษรเป๊ะ ๆ ' +
        'ห้ามย่อ ห้ามตัดคำ ห้ามเรียบเรียงใหม่ · ไม่ต้องเอาคำว่า "เรื่อง" มาด้วย · ' +
        "ถ้าเอกสารไม่มีบรรทัด “เรื่อง” จึงค่อยสรุปสาระสำคัญเป็นประโยคเดียวไม่เกิน 120 ตัวอักษร · ช่องนี้ห้ามว่าง",
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

/**
 * kind = หมวดของเอกสาร ใช้เลือกกติกาเลขที่ (รายงานกิจการใช้ RS-63 คนละแบบกับประกาศ)
 * fileName = ชื่อไฟล์ที่เจ้าหน้าที่อัปมา เช่น RS_63.pdf ใช้เป็นเบาะแสตอนในเอกสารไม่ได้เขียนปีชัด
 */
export function readAnnouncementFromFile(
  base64: string,
  mediaType: MediaType,
  kind: string = "ANNOUNCEMENT",
  fileName = "",
) {
  return readImage<AnnouncementDraft>(
    base64,
    mediaType,
    "นี่คือประกาศ จดหมายข่าว หรือรายงานกิจการของสหกรณ์ออมทรัพย์ " +
      "อ่านเอกสารแล้วบอกเลขที่ ชื่อเรื่อง และวันที่ของเอกสาร ตอบเป็นภาษาไทยตามที่เขียนไว้จริง " +
      (NUMBER_RULE[kind] ?? NUMBER_RULE.ANNOUNCEMENT) +
      " " +
      (fileName ? `ชื่อไฟล์ที่อัปมาคือ "${fileName}" ใช้เป็นเบาะแสได้ถ้าในเอกสารไม่ได้เขียนไว้ชัด ` : "") +
      "ส่วนช่องวันที่ให้แปลงเป็น ค.ศ. (ลบ 543) และแปลงชื่อเดือนไทยเป็นตัวเลข เช่น 30 มิถุนายน 2569 = 2026-06-30 " +
      'ช่องวันที่ ถ้าเอกสารไม่ได้ระบุให้ตอบเป็นข้อความว่าง "" ห้ามเดาเองเด็ดขาด ' +
      "ส่วนชื่อเรื่อง: ประกาศสหกรณ์เขียนหัวไว้ว่า “ประกาศ… / ที่ …/… / เรื่อง …” " +
      "ให้คัดข้อความหลังคำว่า “เรื่อง” มาทั้งบรรทัดแบบคำต่อคำ ห้ามย่อหรือเรียบเรียงใหม่ " +
      "(เอกสารเขียนว่า “เรื่อง ทุนการศึกษาแก่บุตรสมาชิก ประจำปี 2569” " +
      "ต้องตอบว่า “ทุนการศึกษาแก่บุตรสมาชิก ประจำปี 2569” ครบทุกคำ ไม่ใช่ “ทุนการศึกษาบุตรสมาชิก”) " +
      "เอกสารที่ไม่มีบรรทัด “เรื่อง” จึงค่อยสรุปเนื้อหาที่อ่านได้เป็นชื่อเรื่องสั้น ๆ ช่องนี้ห้ามว่าง",
    "announcement_draft",
    ANNOUNCEMENT_SCHEMA,
  );
}

const PAGE_HTML_SCHEMA = {
  type: "object",
  properties: {
    html: { type: "string", description: "เนื้อหาเดิมที่จัดรูปแบบใหม่เป็น HTML" },
  },
  required: ["html"],
  additionalProperties: false,
} as const;

/**
 * จัดรูปแบบเนื้อหาหน้าเว็บให้อ่านง่ายขึ้น — จัดโครงอย่างเดียว ห้ามแก้เนื้อความ
 *
 * งานจริงที่เจอคือเจ้าหน้าที่ก๊อปข้อความจาก Word มาวางเป็นก้อนยาว ๆ ไม่มีย่อหน้า
 * ไม่มีหัวข้อ ปนแท็กขยะจาก Word มาเต็ม อ่านบนเว็บแล้วตาลาย
 *
 * ห้ามให้ AI แต่งเนื้อหาเพิ่มเด็ดขาด — นี่คือประวัติและระเบียบของสหกรณ์
 * ผิดคำเดียวก็เป็นข้อมูลเท็จที่เผยแพร่ในนามองค์กร
 */
export function formatPageHtml(html: string, title: string) {
  return askJson<{ html: string }>(
    [
      {
        type: "text",
        text:
          "จัดรูปแบบเนื้อหาหน้าเว็บของสหกรณ์ออมทรัพย์ต่อไปนี้ให้อ่านง่ายขึ้น " +
          `หัวเรื่องของหน้านี้คือ "${title}" (มีหัวเรื่องอยู่นอกเนื้อหาแล้ว ไม่ต้องใส่ซ้ำ)\n\n` +
          "กฎเหล็ก ห้ามฝ่าฝืน:\n" +
          "1. ห้ามเพิ่ม ลด แก้ไข หรือเรียบเรียงถ้อยคำใด ๆ ตัวเลข ชื่อคน วันที่ ต้องเหมือนเดิมทุกตัวอักษร\n" +
          "2. ห้ามสรุป ห้ามตัดข้อความที่คิดว่าซ้ำซ้อน ข้อความต้องครบเท่าเดิม\n" +
          "3. เปลี่ยนได้แค่โครงสร้าง HTML เท่านั้น\n\n" +
          "สิ่งที่ให้ทำ:\n" +
          "- ตัดข้อความก้อนยาวเป็นย่อหน้า <p> ตามใจความ\n" +
          "- บรรทัดที่เป็นหัวข้อย่อยอยู่แล้ว ทำเป็น <h2> หรือ <h3> ตามระดับ\n" +
          "- รายการที่ขึ้นต้นด้วย - หรือ 1. 2. 3. ทำเป็น <ul><li> หรือ <ol><li>\n" +
          "- ข้อความที่เป็นตาราง ทำเป็น <table><thead><tbody>\n" +
          "- ลบแท็กขยะจาก Word ทิ้ง (<span style>, <font>, class แปลก ๆ)\n" +
          "- <div> ที่ไม่มี class ให้ยุบทิ้งได้ แต่ <div> ที่มี class ห้ามแตะเด็ดขาด\n" +
          "- <img> ที่มีอยู่เดิมให้คงไว้ทั้ง src และ alt ห้ามลบ\n" +
          '- <figure> และ <div class="image-row"> ที่มีอยู่เดิม ให้คงทั้งโครงและค่า class ไว้เป๊ะ ๆ ' +
          "(class พวก left/right/small/image-row คือคำสั่งจัดวางรูป ลบแล้วรูปเพี้ยนทั้งหน้า)\n" +
          '- แท็ปเมนู: <div class="tabs"> ที่ครอบ <div class="tab" data-title="..."> อยู่ ' +
          "ต้องคงไว้ทั้งก้อน ทั้ง class และ data-title ห้ามยุบ ห้ามแปลงเป็นหัวข้อ ห้ามสลับลำดับ " +
          "(นี่คือแท็บที่กดสลับได้บนหน้าเว็บ ยุบทิ้งแล้วหน้าพัง) " +
          "จัดรูปแบบได้เฉพาะ*ข้างใน*แต่ละ tab เท่านั้น\n" +
          '- <div class="ebook"> (การ์ดไฟล์ PDF), <div class="cards"> (การ์ดลิงก์) ' +
          'และ <div class="people"> (ทำเนียบบุคลากร) คงไว้ทั้งก้อนเช่นกัน ห้ามยุบ ห้ามตัด class\n' +
          '- มี <div class="people"> หลายก้อนติดกันถือว่าตั้งใจ — แต่ละก้อนคือหนึ่งแถวที่คนต่อแถว' +
          "ไม่เท่ากัน (เช่นแถวประธาน 3 คน แถวกรรมการ 4 คน) ห้ามรวมเป็นก้อนเดียว " +
          "และห้ามแก้เลขใน class cols-2/3/4/5 เด็ดขาด\n\n" +
          "ใช้ได้เฉพาะแท็ก: p, h2, h3, ul, ol, li, strong, em, a, br, hr, blockquote, " +
          "table, thead, tbody, tr, th, td, img, figure, figcaption\n" +
          "ห้ามใส่ style, script, iframe และห้ามครอบด้วย <html> หรือ <body>\n" +
          "class ใส่ได้เฉพาะที่ติดมากับเนื้อหาเดิมเท่านั้น ห้ามคิดขึ้นเอง\n\n" +
          "เนื้อหาเดิม:\n" +
          html,
      },
    ],
    "page_html",
    PAGE_HTML_SCHEMA as unknown as Record<string, unknown>,
    12000,
  );
}
