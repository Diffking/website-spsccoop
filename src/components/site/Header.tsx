import HeaderClient from "@/components/site/HeaderClient";
import { getBrand, getNav } from "@/lib/nav";

// เมนูและชื่อ/โลโก้มาจากฐาน แก้ได้ที่ /admin/header — ฐานว่างจะใช้ค่าตั้งต้นใน src/data/home.ts
export default async function Header() {
  const [nav, brand] = await Promise.all([getNav(), getBrand()]);
  return <HeaderClient nav={nav} brand={brand} />;
}
