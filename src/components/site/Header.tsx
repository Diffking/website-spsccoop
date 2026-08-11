"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Clock, Menu, X, Minus, Plus } from "lucide-react";
import { nav, site } from "@/data/home";
import logo from "@/data/asset/logo_vector.svg";

const THAI_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function ThaiClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <span className="tabular-nums opacity-70">--:--:--</span>;
  const time = now.toLocaleTimeString("th-TH", { hour12: false });
  const dateStr = `วัน${THAI_DAYS[now.getDay()]}ที่ ${now.getDate()} ${THAI_MONTHS[now.getMonth()]} ${now.getFullYear() + 543}`;
  return (
    <span className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 tabular-nums">
        <Clock className="h-3.5 w-3.5" /> {time}
      </span>
      <span className="hidden sm:inline">{dateStr}</span>
      <span className="hidden md:inline rounded-full bg-emerald-500/90 px-2 py-0.5 text-[11px]">
        เปิดทำการ
      </span>
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

export default function Header() {
  const [open, setOpen] = useState(false);
  const [openSub, setOpenSub] = useState<string | null>(null);

  return (
    <header className="sticky top-0 z-50 shadow-sm">
      {/* แถบบน */}
      <div className="bg-gradient-to-r from-brand-700 to-brand-500 text-white text-xs md:text-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-1.5">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-white shadow ring-1 ring-black/5">
              <Image src={logo} alt={site.name} width={32} height={32} className="h-7 w-7 object-contain" priority />
            </span>
            <span className="truncate font-medium">{site.name}</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <ThaiClock />
            </div>
            <FontSizeControl />
          </div>
        </div>
      </div>

      {/* แถบเมนู */}
      <nav className="bg-gradient-to-r from-brand-500 to-brand-400 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4">
          <ul className="hidden lg:flex items-stretch">
            {nav.map((item) => (
              <li
                key={item.label}
                className="group relative"
                onMouseEnter={() => setOpenSub(item.label)}
                onMouseLeave={() => setOpenSub(null)}
              >
                <Link
                  href={item.href}
                  className="flex h-full items-center gap-1 px-3 py-3 text-sm font-medium hover:bg-white/15 transition"
                >
                  {item.label}
                  {item.children && <ChevronDown className="h-3.5 w-3.5" />}
                </Link>
                {item.children && openSub === item.label && (
                  <ul className="absolute left-0 top-full min-w-64 max-w-80 rounded-b-xl border-t-2 border-brand-400 bg-white py-2 text-gray-700 shadow-2xl ring-1 ring-black/5">
                    {item.children.map((c) => (
                      <li key={c.label} className="group/sub relative px-1.5">
                        {c.children ? (
                          <>
                            <button className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition group-hover/sub:bg-brand-50 group-hover/sub:text-brand-700">
                              <span className="leading-snug">{c.label}</span>
                              <ChevronRight className="h-3.5 w-3.5 shrink-0 transition group-hover/sub:translate-x-0.5" />
                            </button>
                            {/* flyout ชั้นที่ 3 */}
                            <ul className="invisible absolute left-full top-0 z-10 min-w-64 max-w-80 -translate-x-1 rounded-xl border-t-2 border-brand-400 bg-white py-2 text-gray-700 opacity-0 shadow-2xl ring-1 ring-black/5 transition-all duration-150 group-hover/sub:visible group-hover/sub:translate-x-0 group-hover/sub:opacity-100">
                              {c.children.map((g) => (
                                <li key={g.label} className="px-1.5">
                                  <Link
                                    href={g.href}
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
                            href={c.href}
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
            ))}
          </ul>

          {/* โลโก้ย่อบนมือถือ */}
          <span className="lg:hidden py-3 text-sm font-semibold">{site.shortName}</span>

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
                <Link
                  href={item.href}
                  className="block px-4 py-2.5 text-sm font-medium hover:bg-white/10"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
                {item.children && (
                  <ul className="bg-brand-600/40">
                    {item.children.map((c) => (
                      <li key={c.label}>
                        <Link
                          href={c.href}
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
                                  href={g.href}
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
