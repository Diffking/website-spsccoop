/**
 * เนื้อหาหน้า Home — แก้ข้อความ/ตัวเลขได้ที่ไฟล์นี้ที่เดียว
 * ข่าววิ่ง/ประกาศ/ข้อมูลติดต่อ/ดอกเบี้ย ย้ายเข้าฐานข้อมูลแล้ว (แก้ที่ /admin/home)
 * ที่เหลือในไฟล์นี้ยังเป็น placeholder จาก mockup รอย้ายเข้าหลังบ้านทีละส่วน
 */

import slideWelfare from "@/data/asset/slider-img/slide-welfare.jpg";
import slideDepositCert from "@/data/asset/slider-img/slide-deposit-cert.jpg";
import slideScreenshot from "@/data/asset/slider-img/Screenshot-2026-06-08-105311.png";
// หมายเหตุ: ภาพ "ธ สถิตในดวงใจฯ" (พระองค์ภา) ย้ายไปหน้า /splash ไม่อยู่ในสไลด์แล้ว

// ข้อมูลติดต่อ (ที่อยู่ เบอร์ แฟกซ์ อีเมล เวลาทำการ จำนวนผู้เข้าชม) ย้ายไปอยู่ในฐานข้อมูลแล้ว
// แก้ที่ /admin/home · โค้ดอ่านผ่าน getSiteInfo() ใน src/lib/settings.ts
export const site = {
  name: "สหกรณ์ออมทรัพย์สาธารณสุขสงขลา จำกัด",
  shortName: "สอ.สธ.สงขลา",
};

export type NavItem = { label: string; href: string; children?: NavItem[] };

export const nav: NavItem[] = [
  { label: "หน้าหลัก", href: "/" },
  {
    label: "เกี่ยวกับสหกรณ์",
    href: "/about",
    children: [
      { label: "ประวัติความเป็นมา", href: "/about/history" },
      { label: "วิสัยทัศน์และค่านิยม", href: "/about/vision" },
      { label: "โครงสร้างสหกรณ์", href: "/about/structure" },
      { label: "แผนงานและนโยบาย", href: "/about/plan" },
      {
        label: "ทำเนียบองค์กร",
        href: "/about/directory",
        children: [
          { label: "ที่ปรึกษาและที่ปรึกษากิตติมศักดิ์", href: "/about/directory/advisors" },
          { label: "คณะกรรมการดำเนินการ ชุดที่ 45", href: "/about/directory/board" },
          { label: "คณะผู้ตรวจสอบกิจการ", href: "/about/directory/auditors" },
          { label: "คณะกรรมการสรรหา", href: "/about/directory/nomination" },
          { label: "เจ้าหน้าที่สหกรณ์", href: "/about/directory/staff" },
        ],
      },
      { label: "จรรยาบรรณของคณะกรรมการดำเนินการ ผู้จัดการ และเจ้าหน้าที่ของสหกรณ์", href: "/about/code-of-conduct" },
      { label: "ช่องทางการร้องเรียน", href: "/about/complaints" },
      { label: "ติดต่อสหกรณ์", href: "/contact" },
    ],
  },
  { label: "ข้อบังคับ / ระเบียบสหกรณ์", href: "/regulations" },
  { label: "ดาวน์โหลดเอกสาร", href: "/downloads" },
  { label: "รายการย่อแสดงสินทรัพย์", href: "/assets-report" },
  { label: "รายงานการประชุมประจำเดือน", href: "/meeting-report" },
  {
    label: "ระบบสมาชิก",
    href: "/member",
    children: [
      { label: "สอบถามข้อมูลสมาชิก", href: "/member/login" },
      { label: "ใบเสร็จประจำเดือน", href: "/member/profile" },
    ],
  },
  {
    label: "คลินิกสหกรณ์",
    href: "/clinic",
    children: [
      { label: "คำถามที่พบบ่อย", href: "/clinic/faq" },
      { label: "ปรึกษาเจ้าหน้าที่", href: "/clinic/contact" },
    ],
  },
];

// อัตราดอกเบี้ยย้ายไปอยู่ในฐานข้อมูลแล้วเหมือนกัน — แก้ที่ /admin/home
// ค่าตั้งต้น (ใช้ตอนยังไม่เคยบันทึก) อยู่ที่ DEFAULT_RATES ใน src/lib/settings.ts

/**
 * ภาพสไลด์กิจกรรม (Hero) — โปสเตอร์ 600x600 / 1024x1024 (มีข้อความบนภาพแล้ว)
 * แสดงทั้งภาพแบบย่อ (object-contain) + fade crossfade ช้าๆ + ข้อความสรุปจากภาพ
 * เพิ่ม/แก้สไลด์: import รูปด้านบนแล้วเพิ่มรายการที่นี่ (title/desc ถอดจากภาพ)
 */
export const activitySlides = [
  {
    src: slideWelfare,
    title: "สวัสดิการใหม่สำหรับสมาชิก",
    desc: "รับขวัญบุตรแรกเกิด 1,500 บาท · ช่วยเหลือบุตรที่มีความบกพร่องทางสติปัญญา 2,500 บาท/ปี",
    href: "#",
  },
  {
    src: slideDepositCert,
    title: "ยกเลิกพิมพ์หนังสือรับรองการหักภาษี ณ ที่จ่าย",
    desc: "เงินฝากประจำใช้ระบบ D-MyTax ดึงข้อมูลอัตโนมัติ ตั้งแต่ปี 2569 เป็นต้นไป",
    href: "#",
  },
  {
    src: slideScreenshot,
    title: "ขอเชิญร่วมตอบแบบสำรวจความพึงพอใจสมาชิก ปี 2569",
    desc: "ทุกความคิดเห็นมีคุณค่า เพื่อสหกรณ์ที่มั่นคง โปร่งใส และพัฒนาต่อเนื่อง",
    href: "#",
  },
];




export const committees = [
  { name: "จำลอง แก้วพิทยานนท์", role: "ประธานกรรมการ" },
  { name: "ชวนหลุ๊ดหล๊ะ", role: "รองประธานกรรมการ" },
  { name: "ภานุมาศ สุขขัง", role: "เลขานุการ" },
  { name: "อนุชา ซุ้นสุวรรณ", role: "เหรัญญิก" },
  { name: "เป็น รักเกิด", role: "ประธานกรรมการเงินกู้" },
  { name: "บุญญิสา เมืองทอง", role: "ประธานกรรมการศึกษา" },
];

export const services = [
  { label: "สหกรณ์เพื่อนคิด", icon: "Users", href: "#" },
  { label: "ภาพกิจกรรม", icon: "Image", href: "#" },
  { label: "ดาวน์โหลดเอกสาร", icon: "FileText", href: "/downloads" },
  { label: "รายการย่อแสดงสินทรัพย์", icon: "ClipboardList", href: "/assets-report" },
  { label: "ศูนย์ประสานงาน สสธท.", icon: "Building2", href: "#" },
  { label: "คำนวณเงินปันผล", icon: "Lightbulb", href: "#" },
  { label: "ตรวจสุขภาพการเงิน", icon: "HeartPulse", href: "#" },
  { label: "คิวอัจฉริยะ", icon: "Ticket", href: "#" },
  // ย้ายมาจากส่วน "เข้าสู่ระบบงาน" เดิม
  { label: "ระบบบริหารจัดการ", icon: "LayoutGrid", href: "#" },
  { label: "ระบบตัวแทนการเงิน", icon: "Wallet", href: "#" },
  { label: "ระบบเจ้าหน้าที่", icon: "UserCog", href: "#" },
  { label: "ระบบดูแลเว็บไซต์", icon: "MonitorCog", href: "#" },
];

export const recommends = [
  {
    title: "เงินรับฝาก",
    subtitle: "ออมทรัพย์ · ประจำ · ออมทรัพย์พิเศษ",
    theme: "blue",
    href: "/deposit",
  },
  {
    title: "เงินให้กู้",
    subtitle: "สามัญ · ฉุกเฉิน · พิเศษ",
    theme: "green",
    href: "/loan",
  },
  {
    title: "สวัสดิการ",
    subtitle: "ดูแลสมาชิกทุกช่วงชีวิต",
    theme: "orange",
    href: "/welfare",
  },
] as const;

// แถวที่ 2 ของส่วน "สำหรับสมาชิก" (การ์ดคิวอาร์โค้ดและลิงก์โซเชียล)
export const memberFeatures = [
  { title: "สหกรณ์เพื่อนคิด", subtitle: "ปรึกษา / ข้อเสนอแนะ", icon: "Users", href: "#" },
  { title: "ตรวจสุขภาพการเงิน", subtitle: "ประเมินสถานะการเงินของคุณ", icon: "HeartPulse", href: "#" },
  { title: "คำนวณเงินปันผล", subtitle: "ประมาณการเงินปันผลรายปี", icon: "Lightbulb", href: "#" },
];

export const memberLinks = [
  { label: "คู่มือสมาชิก", icon: "BookOpen", href: "#" },
  { label: "คู่มือเกษียณ", icon: "FileBadge", href: "#" },
  { label: "ไลน์สหกรณ์", icon: "MessageCircle", href: "#" },
];

export type CalendarEvent = {
  day: number; // วันที่ในเดือน (แสดงเฉพาะเดือนปัจจุบัน)
  type: "holiday" | "mobile" | "project";
  title: string; // ทำอะไร
  place?: string; // ที่ไหน
  time?: string; // เวลา
};

// กิจกรรมของ "เดือนปัจจุบัน" (ปฏิทินจะโชว์เฉพาะเดือนที่เปิดดู)
export const calendarEvents: CalendarEvent[] = [
  { day: 3, type: "mobile", title: "หน่วยบริการเคลื่อนที่ (รถโมบาย)", place: "รพ.หาดใหญ่", time: "09:00 – 12:00 น." },
  { day: 9, type: "project", title: "โครงการออมเพื่ออนาคต", place: "สำนักงานสหกรณ์", time: "เปิดรับสมัครแล้ว" },
  { day: 14, type: "holiday", title: "วันหยุดทำการสหกรณ์", place: "สหกรณ์ปิดทำการ", time: "หยุด 1 วัน" },
  { day: 20, type: "mobile", title: "หน่วยบริการเคลื่อนที่ (รถโมบาย)", place: "สสอ.เมืองสงขลา", time: "09:00 – 12:00 น." },
  { day: 26, type: "project", title: "อบรมงานแผนการเงินสมาชิก", place: "ห้องประชุมสหกรณ์", time: "13:00 – 16:00 น." },
];

/**
 * บริการของเจ้าหน้าที่ (OfficerService) — 3 สำนักงาน = 3 การ์ด (การ์ดละสำนักงาน)
 * image: เว้นว่างไว้ก่อน (ภาพห้องการเงิน) เดี๋ยวเติมภายหลัง — ตอนนี้มีเฉพาะสำนักงานใหญ่
 */
export type OfficerService = {
  office: "สำนักงานใหญ่" | "สาขา รพ.สงขลา" | "รถตู้โมบาย";
  officeIcon: "head" | "hospital" | "van";
  desc: string;
  image: string;
};

export const officerServices: OfficerService[] = [
  {
    office: "สำนักงานใหญ่",
    officeIcon: "head",
    desc: "สำนักงานใหญ่ของสหกรณ์ ให้บริการสมาชิกครบทุกด้าน พร้อมเจ้าหน้าที่ทุกฝ่ายคอยดูแล",
    image: "",
  },
  {
    office: "สาขา รพ.สงขลา",
    officeIcon: "hospital",
    desc: "จุดบริการสาขาในโรงพยาบาลสงขลา อำนวยความสะดวกสมาชิกใกล้ที่ทำงาน",
    image: "",
  },
  {
    office: "รถตู้โมบาย",
    officeIcon: "van",
    desc: "หน่วยบริการเคลื่อนที่ ออกให้บริการถึงหน่วยงานตามตารางที่สหกรณ์ประกาศ",
    image: "",
  },
];

export const footerLinks = [
  { label: "กรมส่งเสริมสหกรณ์", href: "https://www.cpd.go.th" },
  { label: "สันนิบาตสหกรณ์แห่งประเทศไทย", href: "https://www.clt.or.th" },
  { label: "ชุมนุมสหกรณ์ออมทรัพย์ฯ (ชสอ.)", href: "https://www.fsct.com" },
  { label: "สมาคมฌาปนกิจสงเคราะห์ฯ (สสธท.)", href: "#" },
];
