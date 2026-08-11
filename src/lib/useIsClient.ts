"use client";

import { useSyncExternalStore } from "react";

/**
 * ค่าที่รู้เฉพาะฝั่ง client (เวลาปัจจุบัน วันที่ query string) เอามาใช้ตอน render
 * รอบแรกไม่ได้ เพราะ HTML ที่เซิร์ฟเวอร์ส่งมาจะไม่ตรงกับที่ client วาด (hydration mismatch)
 *
 * วิธีเดิมคือ setState ใน useEffect ซึ่งได้ผลเหมือนกันแต่ทำให้ render ซ้ำอีกหนึ่งรอบ
 * ทุกครั้ง และผิดกฎ react-hooks/set-state-in-effect — useSyncExternalStore ทำงานนี้
 * ได้ตรงกว่า: ตอน SSR/hydrate คืน false ตอนอยู่บน client คืน true
 */
const subscribe = () => () => {};

export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
