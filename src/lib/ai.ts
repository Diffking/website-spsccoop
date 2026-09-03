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

/**
 * สิ่งที่อ่านได้จากโปสเตอร์หนึ่งใบ — เจ้าของเว็บกำหนดไว้ 2 ก.ย. 2026 ว่าต้องได้ครบ 3 อย่าง
 *   1. **เรื่องอะไร** — กิจกรรม / โครงการ / อบรม / เชิญประชุม / รับสมัคร  → `title`
 *   2. **วันที่เท่าไร** — วันจัดงานจริง → `eventDate` · ช่วงที่ยังมีผล → `startsAt` `endsAt`
 *   3. **เงื่อนไขอะไร ทำอย่างไร** — ใครร่วมได้ รับกี่คน สมัครที่ไหน ปิดรับเมื่อไร → `caption`
 */
export type SlideDraft = {
  title: string;
  caption: string;
  /** "YYYY-MM-DD" หรือ "" ถ้าในภาพไม่ได้บอกไว้ */
  startsAt: string;
  endsAt: string;
  /**
   * วันที่จัดงานจริง — คนละเรื่องกับ `endsAt` (วันหมดเขต/ปิดรับสมัคร)
   * มีค่าเมื่อไหร่ สไลด์ใบนี้จะไปปักบนปฏิทินหน้าแรกให้เอง ไม่ต้องพิมพ์ซ้ำในเมนูปฏิทิน
   */
  eventDate: string;
  /** mobile = รถโมบายออกหน่วย · seminar = อบรม/สัมมนา/ประชุม · project = โครงการอื่น · "" = ไม่ใช่กิจกรรม */
  eventType: string;
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
/**
 * ความผิดพลาดที่ "ลองใหม่แล้วมักหาย" — ฝั่งผู้ให้บริการล้ม ไม่ใช่คำขอของเราผิด
 *
 * ⚠️ **ต้องลองใหม่ให้ ห้ามโยน error ออกไปตั้งแต่ครั้งแรก** — 3 ก.ย. 2026 เจ้าหน้าที่กด
 * "ให้ AI อ่านรูปนี้ใหม่" แล้วคำอธิบายไม่ขึ้นเลย ไล่ log เจอ "Provider returned error"
 * 6 ครั้ง ทั้งที่ยิงรูปใบเดียวกันจากเครื่องอีกทีกลับอ่านได้ปกติ
 * · ตอนไล่อ่านสไลด์ทั้งชุด 11 ใบ ก็พลาดแบบนี้ไป 3 ใบ พอลองใหม่ก็ได้ครบ
 * ความผิดพลาดพวกนี้เป็นของชั่วคราวล้วน ๆ คนกดปุ่มไม่ควรต้องมานั่งกดเอง
 */
class Retryable extends Error {}

/** หน่วงก่อนลองใหม่ — เผื่อฝั่งโน้นกำลังตั้งตัว ไม่ยิงซ้ำทันที */
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function askJson<T>(
  content: unknown[],
  schemaName: string,
  schema: Record<string, unknown>,
  maxTokens = 4000,
): Promise<T> {
  if (!AI_READY) throw new AiNotConfigured();

  let last: unknown = null;
  // ลองรวม 3 ครั้ง หน่วง 0.8 กับ 2.4 วินาที — คนกดปุ่มรอไหว และไม่กระหน่ำฝั่งโน้น
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) await wait(attempt === 1 ? 800 : 2400);
    try {
      return await askOnce<T>(content, schemaName, schema, maxTokens);
    } catch (error) {
      if (!(error instanceof Retryable)) throw error;
      last = error;
    }
  }
  throw last instanceof Error ? last : new Error("เรียก AI ไม่สำเร็จ");
}

async function askOnce<T>(
  content: unknown[],
  schemaName: string,
  schema: Record<string, unknown>,
  maxTokens: number,
): Promise<T> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // OpenRouter ใช้สองอันนี้แสดงที่มาของ traffic ในหน้าสถิติของบัญชี
      // ค่าใน header เป็น ASCII เท่านั้น ใส่ภาษาไทยแล้ว fetch จะ throw ByteString ทันที
      "HTTP-Referer": "https://spsccoop.org",
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
    // คีย์ผิดหรือเครดิตหมด ลองกี่ครั้งก็ไม่หาย ต้องมีคนไปแก้ — หยุดตรงนี้เลย
    if (response.status === 401) throw new Error(`คีย์ AI ไม่ถูกต้องหรือหมดอายุ${detail}`);
    if (response.status === 402) throw new Error(`เครดิต AI หมด กรุณาเติมเงินที่ OpenRouter${detail}`);
    // ที่เหลือเป็นของชั่วคราว (ยิงถี่ไป · ผู้ให้บริการล้ม) ลองใหม่ให้เอง
    if (response.status === 429) throw new Retryable(`เรียก AI ถี่เกินไป รอสักครู่แล้วลองใหม่${detail}`);
    throw new Retryable(`เรียก AI ไม่สำเร็จ${detail}`);
  }

  const choice = data.choices?.[0];
  if (choice?.finish_reason === "content_filter") {
    throw new Error("AI ไม่สามารถอ่านภาพนี้ได้ กรุณากรอกข้อมูลเอง");
  }

  const text = choice?.message?.content;
  if (!text) {
    throw new Retryable("AI ไม่ได้ตอบข้อความกลับมา ลองใหม่อีกครั้ง");
  }
  try {
    return parseJson<T>(text);
  } catch (error) {
    // ตอบมาเป็น JSON ที่ไม่ครบรูปก็เกิดได้เป็นครั้งคราว ลองใหม่แล้วมักได้
    throw new Retryable(error instanceof Error ? error.message : "อ่านคำตอบของ AI ไม่ได้");
  }
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
    title: {
      type: "string",
      description:
        "**ชื่อกิจกรรม** ตามที่เขียนไว้ในภาพ เช่น “สัมมนาการบริหารการเงินธุรกิจเสริม” " +
        "“อบรมอาชีพเสริม ครั้งที่ 2/2569” “ปฐมนิเทศสมาชิกใหม่ ครั้งที่ 6/2569” · " +
        "ไม่ใช่กิจกรรมก็ใช้ชื่อเรื่องของประกาศนั้น · **ไม่เกิน 60 ตัวอักษร** " +
        "ตัดชื่อสหกรณ์ คำเชิญชวน และข้อความในเครื่องหมายคำพูดออกได้ถ้ายาวเกิน " +
        "ห้ามใส่วันที่ สถานที่ หรือเงื่อนไขลงในหัวข้อ — พวกนั้นไปอยู่ในคำอธิบาย",
    },
    caption: {
      type: "string",
      description:
        "คำอธิบายใต้หัวข้อ · **เขียนเป็นท่อน ๆ คั่นด้วย ' · ' (เว้นวรรค จุดกลาง เว้นวรรค) " +
        "ห้ามเขียนติดกันยาวเป็นพืด** เพราะเป็นภาษาไทยที่ไม่มีช่องว่างระหว่างคำ " +
        "ถ้าเขียนติดกันเวลาขึ้นบรรทัดใหม่จะตัดคำผิดจนอ่านไม่รู้เรื่อง · " +
        "เรียงท่อนตามนี้ เอาเฉพาะที่ภาพเขียนไว้จริง: " +
        "(1) วันที่จัด เช่น 'วันอาทิตย์ที่ 27 ก.ย. 2569' " +
        "(2) เวลา เช่น 'เวลา 08.30-15.00 น.' " +
        "(3) สถานที่ เช่น 'ห้องประชุมทวีสุข ชั้น 3' " +
        "(4) เนื้อหาโดยย่อว่าทำอะไรได้อะไร (ถ้าภาพบอกไว้) " +
        "(5) จำนวนที่รับและผู้มีสิทธิ์ เช่น 'รับ 40 ท่าน' " +
        "(6) วิธีสมัคร เช่น 'สมัครโดยสแกน QR Code' " +
        "(7) หมดเขตสมัคร เช่น 'หมดเขต 23 ก.ย. 2569' · " +
        "แต่ละท่อนสั้น ๆ ไม่ต้องเป็นประโยคเต็ม รวมทั้งหมดไม่เกิน 220 ตัวอักษร " +
        "**ห้ามใส่เบอร์โทร ไลน์ไอดี ชื่อวิทยากร ชื่อเต็มของสหกรณ์ และคำเชิญชวน** " +
        "ของพวกนี้อยู่ในภาพให้สมาชิกอ่านเองแล้ว ใส่มาก็มีแต่กินที่จนท่อนสำคัญถูกตัดหาย · " +
        "อันไหนภาพไม่ได้เขียนไว้ก็ข้ามท่อนนั้นไป ห้ามเดา ห้ามซ้ำหัวข้อ " +
        "· ห้ามตอบเป็นข้อความว่างถ้าในภาพมีตัวหนังสือ",
    },
    eventDate: {
      type: "string",
      description:
        'วันที่ "จัดงานจริง" ในรูปแบบ YYYY-MM-DD (ค.ศ.) เช่น วันอบรม วันประชุม วันออกหน่วย — ' +
        'คนละวันกับวันปิดรับสมัคร · จัดหลายวันให้เอาวันแรก · ไม่ใช่งานที่มีวันจัดให้ตอบ ""',
    },
    eventType: {
      type: "string",
      enum: ["mobile", "project", "seminar", ""],
      description:
        "ชนิดของงาน — mobile = รถโมบาย/ออกหน่วยเคลื่อนที่ · seminar = อบรม สัมมนา ประชุม " +
        'บรรยาย · project = โครงการอื่น ๆ · "" = ไม่ใช่กิจกรรม (เช่น ประกาศอัตราดอกเบี้ย)',
    },
    startsAt: {
      type: "string",
      description:
        "วันเริ่มของเรื่องนี้ในรูปแบบ YYYY-MM-DD (ค.ศ.) เช่น วันเริ่มรับสมัคร วันเริ่มใช้อัตราใหม่ " +
        '— ถ้าในภาพไม่ได้ระบุให้ตอบ ""',
    },
    endsAt: {
      type: "string",
      description:
        "วันสุดท้ายที่เรื่องนี้ยังมีผล เช่น วันปิดรับสมัคร วันหมดเขต วันสุดท้ายของงาน " +
        'ในรูปแบบ YYYY-MM-DD (ค.ศ.) — ถ้าในภาพไม่ได้ระบุให้ตอบ ""',
    },
  },
  /*
    strict mode ของ structured outputs บังคับว่าทุกช่องต้องอยู่ใน required
    ลืมเติมช่องใหม่ตรงนี้ = คำขอถูกปฏิเสธทั้งก้อน แล้ว AI จะไม่เคยอ่านภาพให้เลย
  */
  required: ["title", "caption", "eventDate", "eventType", "startsAt", "endsAt"],
  additionalProperties: false,
};

/**
 * ตัดท่อน "ช่องทางติดต่อ" ออกจากคำอธิบาย
 *
 * ⚠️ **สั่งใน prompt อย่างเดียวไม่พอ** — บอกไปตรง ๆ ว่าห้ามใส่เบอร์โทรกับไลน์ไอดี
 * แต่ AI ยังใส่มาให้ทุกใบ (ทดสอบจริง 3 ก.ย. 2569) เพราะมันเห็นว่าเป็นข้อมูลสำคัญ
 * · เบอร์กับไลน์อยู่ในภาพให้สมาชิกอ่านเองอยู่แล้ว และอยู่ท้ายเว็บทุกหน้า
 * ปล่อยไว้ก็มีแต่กินที่จนท่อนวันที่/สถานที่ถูกตัดหายตอนแสดงผล
 *
 * ตัดด้วยโค้ดแน่นอนกว่า เพราะคำอธิบายถูกสั่งให้คั่นท่อนด้วย " · " อยู่แล้ว
 */
function dropContact(caption: string): string {
  const contact = /สอบถาม|โทร\.?\s*\d|line|ไลน์|@spsc/i;
  const parts = caption
    .split("·")
    .map((s) => s.trim())
    .filter(Boolean);
  const kept = parts.filter((part) => !contact.test(part));
  // ทั้งก้อนเป็นช่องทางติดต่อล้วน (ใบประชาสัมพันธ์สั้น ๆ) ก็เก็บของเดิมไว้ ดีกว่าได้ค่าว่าง
  return (kept.length > 0 ? kept : parts).join(" · ");
}

export async function readSlideFromImage(base64: string, mediaType: MediaType) {
  const draft = await readImage<SlideDraft>(
    base64,
    mediaType,
    "นี่คือภาพประกาศของสหกรณ์ออมทรัพย์ อ่านข้อความในภาพให้ครบทุกบรรทัดก่อนตอบ " +
      "แล้วตอบให้ได้ 3 เรื่องนี้เสมอ: (1) เป็นเรื่องอะไร — กิจกรรม โครงการ อบรม สัมมนา " +
      "ประชุม รับสมัคร หรือเชิญให้ทำอะไร · (2) วันที่เท่าไร — แยกให้ออกระหว่าง " +
      "วันที่จัดงานจริง กับวันปิดรับสมัคร/วันหมดเขต ซึ่งมักไม่ใช่วันเดียวกัน · " +
      "(3) เงื่อนไขเป็นอย่างไร — จัดที่ไหน เวลาไหน ใครมีสิทธิ์ รับจำนวนเท่าไร " +
      "สมัครหรือติดต่อทางไหน หมดเขตสมัครวันไหน มีค่าใช้จ่ายหรือไม่ " +
      "ข้อความที่ตอบกลับจะไปวางเป็นแบนเนอร์ข้างรูปบนหน้าเว็บ ซึ่งมีที่ให้แค่ไม่กี่บรรทัด " +
      "**ต้องสั้น** สมาชิกที่อยากรู้ละเอียดกดดูรูปเต็มได้อยู่แล้ว — " +
      "หัวข้อไม่เกิน 60 ตัวอักษร คำอธิบายไม่เกิน 220 ตัวอักษร ห้ามลอกข้อความทั้งใบมาใส่ " +
      "และ**คำอธิบายต้องแบ่งเป็นท่อน ๆ คั่นด้วย ' · '** ห้ามเขียนติดกันยาวเป็นพืด " +
      "ตอบเป็นภาษาไทย ใช้ถ้อยคำทางการ เอาเฉพาะสาระที่อยู่ในภาพจริง ห้ามแต่งเติมตัวเลขหรือเงื่อนไขที่ไม่ได้เขียนไว้ " +
      "เรื่องวันที่: ประกาศไทยมักเขียนปีเป็น พ.ศ. ให้แปลงเป็น ค.ศ. ก่อนตอบ (ลบ 543 เช่น 2569 = 2026) " +
      "และแปลงชื่อเดือนไทยเป็นตัวเลข เช่น 8 มิถุนายน 2569 = 2026-06-08 " +
      'วันไหนที่ภาพไม่ได้ระบุไว้ให้ตอบเป็นข้อความว่าง "" ห้ามเดาเองเด็ดขาด',
    "slide_draft",
    SLIDE_SCHEMA,
  );

  return { ...draft, caption: dropContact(draft.caption) };
}

/**
 * อ่านชื่อ-ตำแหน่งจากรูปบุคลากร — สำหรับ CoopBridge (หลังบ้าน → เชื่อมต่อระบบ)
 *
 * รูปบุคลากรที่ร้านทำมาให้มีแถบชื่อ-สกุลกับตำแหน่งพิมพ์ติดอยู่ในภาพเลย หน้าเว็บจึงเว้น
 * ช่องชื่อใต้รูปว่างไว้ (ดูหัวข้อ "ทำเนียบบุคลากร" ใน AGENTS.md) — ในฐานข้อมูลจึงไม่มี
 * ข้อความชื่อเลย ระบบอื่นที่มาขอข้อมูลไปทำทะเบียนบุคลากรจึงใช้ไม่ได้
 *
 * ⚠️ ผลจากตัวนี้ **ไม่ถูกบันทึกเอง** — ไปเติมในช่องให้เจ้าหน้าที่ตรวจแล้วกดบันทึกเสมอ
 * (หลักเดียวกับ AI อ่านภาพสไลด์) ชื่อคนสะกดผิดคือเรื่องใหญ่กว่าคำโปรยผิด
 */
export type PersonDraft = {
  name: string;
  role: string;
  /** อ่านข้อความในภาพออกไหม — false = ในภาพไม่มีตัวหนังสือ หรืออ่านไม่ออก */
  readable: boolean;
};

const PERSON_SCHEMA = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description: 'ชื่อ-สกุลตามที่เขียนในภาพ คงคำนำหน้าไว้ (นาย/นาง/น.ส./ว่าที่ ร.ต.) — อ่านไม่ออกให้ตอบ ""',
    },
    role: {
      type: "string",
      description: 'ตำแหน่งตามที่เขียนในภาพ เช่น ประธานกรรมการ หัวหน้าฝ่ายการเงิน — ไม่มีให้ตอบ ""',
    },
    readable: { type: "boolean", description: "อ่านข้อความในภาพออกหรือไม่" },
  },
  required: ["name", "role", "readable"],
  additionalProperties: false,
};

export function readPersonFromImage(base64: string, mediaType: MediaType) {
  return readImage<PersonDraft>(
    base64,
    mediaType,
    "รูปนี้เป็นรูปบุคลากรของสหกรณ์ออมทรัพย์ ซึ่งมักมีแถบชื่อ-สกุลและตำแหน่งพิมพ์อยู่ในภาพ " +
      "อ่านข้อความที่เห็นในภาพแล้วตอบเป็นชื่อ-สกุลกับตำแหน่ง เอาเฉพาะที่เขียนอยู่จริงเท่านั้น " +
      "ห้ามเดาชื่อ ห้ามเติมนามสกุล และห้ามแต่งตำแหน่งที่ไม่ได้เขียนไว้ " +
      'ถ้าในภาพไม่มีตัวหนังสือหรืออ่านไม่ออก ให้ตอบ readable=false พร้อมค่าว่าง ""',
    "person_draft",
    PERSON_SCHEMA,
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
