import HeaderClient from "@/components/site/HeaderClient";
import { getBrand, getNav } from "@/lib/nav";
import { getHolidayToday, getNextHoliday } from "@/lib/content";
import { getOfficeHours } from "@/lib/settings";

// เมนูและชื่อ/โลโก้มาจากฐาน แก้ได้ที่ /admin/header — ฐานว่างจะใช้ค่าตั้งต้นใน src/data/home.ts
// วัน/เวลาทำการกับวันหยุดวันนี้ส่งไปให้ป้าย "เปิดทำการ/ปิดทำการ" คิดฝั่งเบราว์เซอร์
export default async function Header() {
  const [nav, brand, hours, holidayToday, nextHoliday] = await Promise.all([
    getNav(),
    getBrand(),
    getOfficeHours(),
    getHolidayToday(),
    getNextHoliday(),
  ]);
  return (
    <HeaderClient
      nav={nav}
      brand={brand}
      hours={hours}
      holidayToday={holidayToday}
      nextHoliday={nextHoliday}
    />
  );
}
