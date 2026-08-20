/**
 * รายการย่อยของหน้าแรกทุกส่วนอยู่ในตาราง HomeItem ตารางเดียว แยกกันด้วยชื่อ section
 * แต่ในหลังบ้านแต่ละส่วนอยู่คนละหน้าและมีเจ้าหน้าที่ดูแลคนละคน
 * ตารางนี้จึงบอกว่า section ไหนอยู่ในความรับผิดชอบของพื้นที่ไหน
 */

import type { AreaKey } from "@/lib/permissions";

export const SECTION_AREA: Record<string, AreaKey> = {
  services: "home.services",
  recommends: "home.member",
  memberFeatures: "home.member",
  memberLinks: "home.member",
  committees: "home.committees",
  officers: "home.officers",
  footerLinks: "footer",
};
