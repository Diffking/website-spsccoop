import HeaderClient from "@/components/site/HeaderClient";
import { getBrand, getNav } from "@/lib/nav";
import { localAsset } from "@/lib/assetFallback";
import { getHolidayToday } from "@/lib/content";
import { getOfficeHours } from "@/lib/settings";
import { inlineSvg } from "@/lib/inlineSvg";
import { svgWithClass } from "@/lib/svg";

// เมนูและชื่อ/โลโก้มาจากฐาน แก้ได้ที่ /admin/header — ฐานว่างจะใช้ค่าตั้งต้นใน src/data/home.ts
// วัน/เวลาทำการกับวันหยุดวันนี้ส่งไปให้ป้าย "เปิดทำการ/ปิดทำการ" คิดฝั่งเบราว์เซอร์
export default async function Header() {
  const [nav, brand, hours, holidayToday] = await Promise.all([
    getNav(),
    getBrand(),
    getOfficeHours(),
    getHolidayToday(),
  ]);

  /*
   * โลโก้ที่เป็น .svg ฝังลงหน้าเลย ไม่ต้องรออีกหนึ่ง request และคมทุกความละเอียด
   * ไฟล์แบบอื่น (png/jpg) ยังใส่ผ่าน <img> เหมือนเดิม
   */
  const logoUrl = localAsset(brand.logoUrl);
  const raw = await inlineSvg(logoUrl);
  const logoSvg = raw ? svgWithClass(raw, "h-8 w-8 object-contain", brand.name) : null;

  return (
    <HeaderClient
      nav={nav}
      brand={{ ...brand, logoUrl }}
      logoSvg={logoSvg}
      hours={hours}
      holidayToday={holidayToday}
    />
  );
}
