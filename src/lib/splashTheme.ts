/**
 * พื้นหลังของหน้าวันสำคัญ (splash)
 *
 * วันสำคัญแต่ละวันโทนภาพไม่เหมือนกัน — วันสำคัญของราชวงศ์มักใช้พื้นดำหรือน้ำเงินเข้ม
 * ส่วนวันขึ้นปีใหม่หรือวันสหกรณ์ใช้โทนสว่างได้ จึงให้เลือกได้ทีละวันสำคัญ
 *
 * เก็บเป็น "คีย์" ไม่ใช่โค้ดสี เพราะค่าที่บันทึกไว้ในฐานจะได้ไม่ผูกกับสีชุดใดชุดหนึ่ง
 * วันหลังอยากปรับเฉดก็แก้ที่นี่ที่เดียว หน้าเว็บเปลี่ยนตามทันที
 *
 * ไฟล์นี้ไม่แตะฐานข้อมูล ฝั่ง client จึง import ได้
 */

export const SPLASH_BACKGROUNDS = [
  { key: "black", label: "ดำสนิท", className: "bg-black", swatch: "#000000" },
  {
    key: "navy",
    label: "น้ำเงินเข้ม",
    className: "bg-gradient-to-b from-[#0a2f52] via-[#061a2e] to-black",
    swatch: "linear-gradient(#0a2f52,#061a2e)",
  },
  {
    key: "royal",
    label: "ม่วงเข้ม",
    className: "bg-gradient-to-b from-[#2a1244] via-[#160a26] to-black",
    swatch: "linear-gradient(#2a1244,#160a26)",
  },
  {
    key: "forest",
    label: "เขียวเข้ม",
    className: "bg-gradient-to-b from-[#0b2f26] via-[#061a15] to-black",
    swatch: "linear-gradient(#0b2f26,#061a15)",
  },
  {
    key: "warm",
    label: "น้ำตาลอบอุ่น",
    className: "bg-gradient-to-b from-[#3a2410] via-[#1e1207] to-black",
    swatch: "linear-gradient(#3a2410,#1e1207)",
  },
  {
    key: "cream",
    label: "ครีมสว่าง",
    className: "bg-gradient-to-b from-[#fdf6e8] to-[#f0e3cc]",
    swatch: "linear-gradient(#fdf6e8,#f0e3cc)",
  },
] as const;

export type SplashBackground = (typeof SPLASH_BACKGROUNDS)[number]["key"];

export const DEFAULT_SPLASH_BG: SplashBackground = "black";

export const isSplashBackground = (value: unknown): value is SplashBackground =>
  typeof value === "string" && SPLASH_BACKGROUNDS.some((b) => b.key === value);

/** คลาสพื้นหลังของวันสำคัญนั้น — ค่าที่ไม่รู้จักถอยไปใช้พื้นดำ */
export const splashBgClass = (key: string | undefined): string =>
  (SPLASH_BACKGROUNDS.find((b) => b.key === key) ?? SPLASH_BACKGROUNDS[0]).className;

/** พื้นสว่างต้องใช้ตัวหนังสือสีเข้ม ไม่งั้นอ่านไม่ออก */
export const isLightSplashBg = (key: string | undefined): boolean => key === "cream";
