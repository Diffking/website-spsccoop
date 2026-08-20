/**
 * ดึงวันหยุดจากระบบสำนักงาน (QgeniusCoop API) ที่รันอยู่ในวงแลนของสหกรณ์
 *
 * ที่นั่นเป็นต้นทางที่เจ้าหน้าที่ตั้งวันหยุดของสหกรณ์อยู่แล้ว การมาพิมพ์ซ้ำในเว็บอีกรอบ
 * คือที่มาของวันหยุดสองที่ไม่ตรงกัน — ดึงมาทีเดียวจบดีกว่า
 *
 * **ดึงมาเก็บในฐานของเว็บ ไม่ได้อ่านสดทุกครั้งที่มีคนเปิดหน้าเว็บ** เพราะ:
 *   · เครื่องต้นทางอยู่ในวงแลน ปิดเครื่อง/เน็ตสำนักงานล่ม = วันหยุดหายจากหน้าเว็บทันที
 *   · สมาชิกอ่านผ่านสำเนาบนโฮสต์อยู่แล้ว ยังไงก็ไม่ได้เห็นค่าสด ๆ
 *   · ดึงมาแล้วยังแก้ต่อได้ (เพิ่มวันหยุดของสหกรณ์เอง ใส่หมายเหตุ ซ่อนบางวัน)
 *
 * ตั้งที่อยู่ต้นทางที่ HOLIDAY_SOURCE_URL ใน .env — ไม่ตั้ง = ซ่อนปุ่มดึงข้อมูลไปเลย
 */

export type SourceHoliday = {
  /** "YYYY-MM-DD" ตามปฏิทินสากล */
  date: string;
  title: string;
};

export type SourceResult =
  | {
      ok: true;
      /** ต้นทางเปิดใช้ระบบวันหยุดอยู่ไหม — ปิดอยู่ก็ไม่ควรเอาของเก่ามาทับ */
      enabled: boolean;
      holidays: SourceHoliday[];
    }
  | { ok: false; error: string };

/** ที่อยู่ต้นทาง — ว่าง = ยังไม่ได้ตั้งค่า ฟีเจอร์นี้ถูกซ่อน */
export function holidaySourceUrl(): string {
  return (process.env.HOLIDAY_SOURCE_URL ?? "").trim();
}

/** ชื่อเครื่องต้นทางแบบอ่านง่าย ไว้โชว์ในหลังบ้าน — อ่านไม่ออกก็คืนค่าเดิม */
export function holidaySourceLabel(): string {
  const url = holidaySourceUrl();
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

/**
 * อ่านรายการวันหยุดจากต้นทาง
 *
 * ตอบกลับหน้าตา { "enabled": true, "holidays": { "2026-04-06": "วันจักรี", ... } }
 * ต่อไม่ติดไม่ใช่เรื่องผิดปกติ (ปิดเครื่อง เน็ตสำนักงานหลุด) จึงคืนเป็นข้อความบอกสาเหตุ
 * ไม่ใช่ throw ให้หน้าหลังบ้านพังทั้งหน้า
 */
export async function fetchHolidaySource(): Promise<SourceResult> {
  const url = holidaySourceUrl();
  if (!url) return { ok: false, error: "ยังไม่ได้ตั้งค่าที่อยู่ระบบต้นทาง (HOLIDAY_SOURCE_URL)" };

  try {
    // ตัดจบที่ 6 วินาที — เครื่องต้นทางอยู่ในวงแลน ถ้าไม่ตอบใน 6 วิ คือปิดอยู่ ไม่ใช่ช้า
    const response = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });

    if (!response.ok) {
      return { ok: false, error: `ระบบต้นทางตอบกลับ ${response.status}` };
    }

    const data = (await response.json()) as {
      enabled?: unknown;
      holidays?: unknown;
    };

    const map = data.holidays;
    if (typeof map !== "object" || map === null) {
      return { ok: false, error: "ข้อมูลที่ได้จากระบบต้นทางไม่ใช่รูปแบบที่รู้จัก" };
    }

    const holidays = Object.entries(map as Record<string, unknown>)
      .filter(([date, title]) => isDate(date) && typeof title === "string" && title.trim())
      .map(([date, title]) => ({ date, title: String(title).trim() }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { ok: true, enabled: data.enabled !== false, holidays };
  } catch (error) {
    // ต่อไม่ติดคือกรณีปกติที่ต้องบอกให้เข้าใจ ไม่ใช่ error ที่ต้องไปงมใน log
    const reason =
      error instanceof Error && error.name === "TimeoutError"
        ? "ระบบต้นทางไม่ตอบใน 6 วินาที (เครื่องอาจปิดอยู่)"
        : "ต่อกับระบบต้นทางไม่ได้";
    console.error("ดึงวันหยุดจากระบบสำนักงานไม่สำเร็จ:", error);
    return { ok: false, error: `${reason} — ${holidaySourceLabel()}` };
  }
}

export type CompareStatus = "new" | "same" | "renamed";

export type ComparedHoliday = SourceHoliday & {
  status: CompareStatus;
  /** ชื่อที่ใช้อยู่ในเว็บตอนนี้ — มีเฉพาะตอน status = renamed */
  currentTitle?: string;
};

/**
 * เทียบของจากต้นทางกับที่มีอยู่ในเว็บ — บอกว่าจะเพิ่มอะไร ชนกับอะไร
 * เทียบด้วย "วันที่" เป็นหลัก เพราะวันเดียวกันคือวันหยุดเดียวกัน ต่อให้เรียกชื่อต่างกัน
 */
export function compareHolidays(
  source: SourceHoliday[],
  current: { date: string; title: string }[],
): ComparedHoliday[] {
  const byDate = new Map(current.map((h) => [h.date, h.title]));

  return source.map((item) => {
    const existing = byDate.get(item.date);
    if (existing === undefined) return { ...item, status: "new" as const };
    if (existing === item.title) return { ...item, status: "same" as const };
    return { ...item, status: "renamed" as const, currentTitle: existing };
  });
}
