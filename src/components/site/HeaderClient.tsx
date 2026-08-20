"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Clock, Menu, X, Minus, Plus } from "lucide-react";
import { useIsClient } from "@/lib/useIsClient";
import type { NavNode, SiteBrand } from "@/lib/nav";
import { officeStatus, type OfficeHours } from "@/lib/officeHours";
import logo from "@/data/asset/logo_vector.svg";

const THAI_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function ThaiClock({
  hours,
  holidayToday,
}: {
  hours: OfficeHours;
  holidayToday: string | null;
}) {
  const isClient = useIsClient();
  const [tick, setTick] = useState<Date | null>(null);
  useEffect(() => {
    const t = setInterval(() => setTick(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // วินาทีแรกยังไม่มี tick — อ่านเวลาสดตอน render ได้เลยเพราะถึงตรงนี้ hydrate เสร็จแล้ว
  const now = tick ?? (isClient ? new Date() : null);
  if (!now) return <span className="tabular-nums opacity-70">--:--:--</span>;
  const time = now.toLocaleTimeString("th-TH", { hour12: false });
  const dateStr = `วัน${THAI_DAYS[now.getDay()]}ที่ ${now.getDate()} ${THAI_MONTHS[now.getMonth()]} ${now.getFullYear() + 543}`;
  const status = officeStatus(now, hours, holidayToday);
  return (
    <span className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 tabular-nums">
        <Clock className="h-3.5 w-3.5" /> {time}
      </span>
      <span className="hidden sm:inline">{dateStr}</span>
      {/*
        เปิด/ปิดจริงตามวันเวลาทำการที่ตั้งไว้ และวันหยุดสหกรณ์ — เดิมขึ้น "เปิดทำการ" ค้างตลอด
        ต่อท้ายด้วยเวลาปิด/เวลาเปิด จะได้รู้เลยโดยไม่ต้องเอาเมาส์ชี้
      */}
      <span
        title={status.detail}
        className={`hidden items-center gap-1 rounded-full px-2 py-0.5 text-[11px] md:inline-flex ${
          status.open ? "bg-emerald-500/90" : "bg-black/30"
        }`}
      >
        {status.label}
        {status.note && <span className="opacity-80">· {status.note}</span>}
      </span>

      {/*
        ไม่มีป้ายนับถอยหลังวันหยุดครั้งถัดไปแล้ว — ปฏิทินหน้าแรกบอกวันหยุดอยู่แล้ว
        และถ้าวันนี้เป็นวันหยุดจริง ป้ายสถานะเปิด/ปิดข้างบนก็บอกให้แล้ว
        เอามาขึ้นซ้ำบนหัวเว็บทุกหน้าคือข้อมูลซ้ำที่ไม่ได้ช่วยอะไร
      */}
    </span>
  );
}

function FontSizeControl() {
  const [scale, setScale] = useState(100);
  useEffect(() => {
    document.documentElement.style.fontSize = `${scale}%`;
  }, [scale]);
  const btn = "grid h-6 w-6 place-items-center rounded bg-white/15 hover:bg-white/25 transition";
  return (
    <div className="flex items-center gap-1">
      <button aria-label="ลดขนาดตัวอักษร" className={btn} onClick={() => setScale((s) => Math.max(85, s - 10))}>
        <Minus className="h-3.5 w-3.5" />
      </button>
      <button aria-label="ขนาดปกติ" className={btn} onClick={() => setScale(100)}>
        L
      </button>
      <button aria-label="เพิ่มขนาดตัวอักษร" className={btn} onClick={() => setScale((s) => Math.min(130, s + 10))}>
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

const real = (href: string | undefined) => (href && href !== "#" ? href : null);

export default function HeaderClient({
  nav,
  brand,
  logoSvg,
  hours,
  holidayToday,
}: {
  nav: NavNode[];
  brand: SiteBrand;
  /** โค้ด SVG ของโลโก้ที่ล้างแล้ว — มีค่านี้แปลว่าให้ฝังลงหน้าแทนการใส่ผ่าน <img> */
  logoSvg?: string | null;
  hours: OfficeHours;
  holidayToday: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [openSub, setOpenSub] = useState<string | null>(null);

  /* whitespace-nowrap: ชื่อเมนูไทยยาว ๆ ถูกหักขึ้นบรรทัดใหม่กลางคำแล้วแถบเมนูสูงสองเท่า ดูเหมือนซ้อนกัน */
  const topBarClass =
    "flex h-full items-center gap-1 whitespace-nowrap px-3 py-3 text-sm font-medium transition hover:bg-white/15";

  return (
    <header className="sticky top-0 z-50 shadow-sm">
      {/* แถบบน */}
      <div className="bg-gradient-to-r from-brand-700 to-brand-500 text-white text-xs md:text-sm">
        <div className="mx-auto flex max-w-344 items-center justify-between gap-3 px-4 py-1.5">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-white shadow ring-1 ring-black/5">
              {logoSvg ? (
                /* โลโก้ SVG ฝังลงหน้าเลย — โค้ดถูกล้างที่ฝั่งเซิร์ฟเวอร์แล้ว (ดู src/lib/svg.ts) */
                <span className="grid h-7 w-7 place-items-center [&>svg]:h-full [&>svg]:w-full"
                      dangerouslySetInnerHTML={{ __html: logoSvg }} />
              ) : brand.logoUrl ? (
                // โลโก้ที่อัปจากหลังบ้าน ไม่รู้ขนาดล่วงหน้า จึงใช้ <img> ธรรมดา
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brand.logoUrl} alt={brand.name} className="h-7 w-7 object-contain" />
              ) : (
                <Image src={logo} alt={brand.name} width={32} height={32} className="h-7 w-7 object-contain" priority />
              )}
            </span>
            {/* ชื่อเต็มของสหกรณ์ — ไม่ตัดท้ายด้วย ... แล้ว จอแคบให้ตกบรรทัดแทน */}
            <span className="font-medium leading-tight">{brand.name}</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <ThaiClock hours={hours} holidayToday={holidayToday} />
            </div>
            <FontSizeControl />
          </div>
        </div>
      </div>

      {/* แถบเมนู */}
      <nav className="bg-gradient-to-r from-brand-500 to-brand-400 text-white">
        <div className="mx-auto flex max-w-344 items-center justify-between px-4">
          {/* mx-auto: จอกว้างแล้วเมนูจะอยู่กลางแถบ ไม่ไปกองชิดซ้ายจนขวาโล่งครึ่งจอ
              (บนมือถือปุ่มเมนูกับโลโก้ย่อยังทำงานเหมือนเดิม เพราะ ul ถูกซ่อน) */}
          <ul className="hidden items-stretch lg:mx-auto lg:flex">
            {nav.map((item, index) => {
              // เมนูสองอันขวาสุดต้องกางเมนูย่อยไปทางซ้าย ไม่งั้นก้อนเมนูล้นออกนอกจอ
              const alignRight = index >= nav.length - 2;

              return (
              <li
                key={item.label}
                className="group relative"
                onMouseEnter={() => setOpenSub(item.label)}
                onMouseLeave={() => setOpenSub(null)}
              >
                {/* เมนูที่ไม่ได้ใส่ลิงก์ = หัวข้อไว้กางเมนูย่อย ไม่ทำเป็นลิงก์กดแล้วไม่ไปไหน */}
                {real(item.href) ? (
                  <Link href={real(item.href)!} className={topBarClass}>
                    {item.label}
                    {item.children && <ChevronDown className="h-3.5 w-3.5" />}
                  </Link>
                ) : (
                  <span className={topBarClass}>
                    {item.label}
                    {item.children && <ChevronDown className="h-3.5 w-3.5" />}
                  </span>
                )}
                {item.children && openSub === item.label && (
                  <ul
                    className={`absolute top-full z-20 w-max min-w-72 max-w-120 rounded-b-xl border-t-2 border-brand-400 bg-white py-2 text-gray-700 shadow-2xl ring-1 ring-black/5 ${
                      alignRight ? "right-0" : "left-0"
                    }`}
                  >
                    {item.children.map((c) => (
                      <li key={c.label} className="group/sub relative px-1.5">
                        {c.children ? (
                          <>
                            <button className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition group-hover/sub:bg-brand-50 group-hover/sub:text-brand-700">
                              <span className="leading-snug">{c.label}</span>
                              <ChevronRight className="h-3.5 w-3.5 shrink-0 transition group-hover/sub:translate-x-0.5" />
                            </button>
                            {/* flyout ชั้นที่ 3 */}
                            <ul
                              className={`invisible absolute top-0 z-10 w-max min-w-72 max-w-120 rounded-xl border-t-2 border-brand-400 bg-white py-2 text-gray-700 opacity-0 shadow-2xl ring-1 ring-black/5 transition-all duration-150 group-hover/sub:visible group-hover/sub:translate-x-0 group-hover/sub:opacity-100 ${
                                alignRight ? "right-full translate-x-1" : "left-full -translate-x-1"
                              }`}
                            >
                              {c.children.map((g) => (
                                <li key={g.label} className="px-1.5">
                                  <Link
                                    href={real(g.href) ?? "/"}
                                    className="block rounded-lg px-3 py-2 text-sm leading-snug transition hover:bg-brand-50 hover:text-brand-700"
                                  >
                                    {g.label}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </>
                        ) : (
                          <Link
                            href={real(c.href) ?? "/"}
                            className="block rounded-lg px-3 py-2 text-sm leading-snug transition hover:bg-brand-50 hover:text-brand-700"
                          >
                            {c.label}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
              );
            })}
          </ul>

          {/* โลโก้ย่อบนมือถือ */}
          <span className="lg:hidden py-3 text-sm font-semibold">{brand.shortName}</span>

          <button
            className="lg:hidden grid h-9 w-9 place-items-center rounded hover:bg-white/15"
            onClick={() => setOpen((v) => !v)}
            aria-label="เมนู"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* เมนูมือถือ */}
        {open && (
          <ul className="lg:hidden border-t border-white/20 bg-brand-500 pb-2">
            {nav.map((item) => (
              <li key={item.label}>
                {real(item.href) ? (
                  <Link
                    href={real(item.href)!}
                    className="block px-4 py-2.5 text-sm font-medium hover:bg-white/10"
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className="block px-4 py-2.5 text-sm font-medium">{item.label}</span>
                )}
                {item.children && (
                  <ul className="bg-brand-600/40">
                    {item.children.map((c) => (
                      <li key={c.label}>
                        <Link
                          href={real(c.href) ?? "/"}
                          className="block px-8 py-2 text-sm text-white/90 hover:bg-white/10"
                          onClick={() => setOpen(false)}
                        >
                          – {c.label}
                        </Link>
                        {c.children && (
                          <ul className="bg-brand-700/40">
                            {c.children.map((g) => (
                              <li key={g.label}>
                                <Link
                                  href={real(g.href) ?? "/"}
                                  className="block px-12 py-1.5 text-xs text-white/70 hover:bg-white/10"
                                  onClick={() => setOpen(false)}
                                >
                                  · {g.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </nav>
    </header>
  );
}
