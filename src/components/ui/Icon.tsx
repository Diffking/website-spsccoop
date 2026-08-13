import {
  Users, Image, FileText, ClipboardList, Building2, Lightbulb, HeartPulse, Ticket,
  BookOpen, FileBadge, MessageCircle, LayoutGrid, Wallet, UserCog, MonitorCog,
  Banknote, PiggyBank, Calculator, Receipt, HandCoins, Landmark, ShieldCheck,
  Phone, Mail, MapPin, CalendarDays, Download, Scale, GraduationCap, Stethoscope,
  Gavel, ClipboardCheck, UserCheck, Handshake, Newspaper, Link2, Globe, Bell,
} from "lucide-react";
import { Line, Facebook, QrCode } from "@/components/ui/BrandIcons";

/**
 * ไอคอนที่เลือกใช้ได้ในหลังบ้าน — เพิ่มชื่อในนี้ที่เดียว แล้วตัวเลือกในหลังบ้านจะขึ้นเอง
 * (import ทีละตัวแบบนี้ ไม่ใช่ทั้งชุด lucide จะได้ไม่ลากไอคอนที่ไม่ได้ใช้เข้า bundle)
 *
 * ชนิดเป็น ComponentType ไม่ใช่ LucideIcon เพราะมีไอคอนแบรนด์ที่วาดเองปนอยู่ด้วย
 * (lucide ถอดไอคอนแบรนด์อย่าง LINE/Facebook ออกไปแล้ว)
 */
export const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  // ทั่วไป
  LayoutGrid, FileText, ClipboardList, ClipboardCheck, Newspaper, BookOpen, FileBadge,
  Download, Link2, Globe, Bell, CalendarDays, Image,
  // เงิน
  Wallet, Banknote, PiggyBank, HandCoins, Calculator, Receipt, Landmark,
  // คน / หน่วยงาน
  Users, UserCog, UserCheck, Handshake, Building2, GraduationCap,
  // ช่องทางติดต่อ / โซเชียล
  Line, Facebook, QrCode, MessageCircle, Phone, Mail,
  // อื่น ๆ
  HeartPulse, Stethoscope, ShieldCheck, Scale, Gavel, Lightbulb, Ticket,
  MonitorCog, MapPin,
};

export const ICON_NAMES = Object.keys(ICONS);

export default function Icon({ name, className }: { name: string; className?: string }) {
  const Cmp = ICONS[name] ?? FileText;
  return <Cmp className={className} />;
}
