"use client";

import { useState } from "react";
import {
  Check,
  Clock,
  Copy,
  Crosshair,
  ExternalLink,
  Landmark,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Navigation,
  Phone,
  Printer,
} from "lucide-react";
import { Facebook, Line } from "@/components/ui/BrandIcons";
import type { BankAccount } from "@/lib/settings";

/**
 * หน้าติดต่อเรา — แผนที่ + นำทางมาที่สหกรณ์ + ช่องทางติดต่อทั้งหมด
 *
 * ไฮไลต์คือ "นำทาง" ที่ล็อกปลายทางเป็นสหกรณ์ไว้ตายตัว สมาชิกกรอกแค่จุดเริ่มต้น
 * (หรือกดใช้ตำแหน่งปัจจุบัน) แล้วดูเส้นทางได้ในหน้าเลย ไม่ต้องออกไปพิมพ์ชื่อสหกรณ์
 * ในกูเกิลแมปเองแล้วเสี่ยงเจอหมุดผิดที่ — สหกรณ์อยู่ในซอย ค้นชื่อตรง ๆ มักได้ที่ผิด
 *
 * แผนที่ใช้ลิงก์ฝังของกูเกิลแบบไม่ต้องใช้คีย์ (output=embed) จึงไม่มีค่าใช้จ่ายรายเดือน
 * และไม่ต้องเก็บคีย์ไว้ในเครื่อง
 */

type Props = {
  address: string;
  phones: string[];
  fax: string;
  email: string;
  facebook?: string;
  line?: string;
  lineId?: string;
  /** "lat,lng" — ไม่มีก็ใช้ที่อยู่เป็นคำค้นแทน */
  mapPoint?: string;
  bankAccounts: BankAccount[];
  officeHours: string;
  closedDays: string;
  coopName: string;
};

/** โหมดเดินทางที่กูเกิลรองรับ — ค่าที่ส่งไปต้องเป็นคำเหล่านี้เป๊ะ ๆ */
const TRAVEL_MODES = [
  { key: "driving", label: "รถยนต์" },
  { key: "transit", label: "รถสาธารณะ" },
  { key: "walking", label: "เดิน" },
] as const;
type TravelMode = (typeof TRAVEL_MODES)[number]["key"];

export default function ContactView({
  address,
  phones,
  fax,
  email,
  facebook,
  line,
  lineId,
  mapPoint,
  bankAccounts,
  officeHours,
  closedDays,
  coopName,
}: Props) {
  const [origin, setOrigin] = useState("");
  const [mode, setMode] = useState<TravelMode>("driving");
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [openChannel, setOpenChannel] = useState<string | null>(null);

  /*
   * ปลายทางที่ล็อกไว้ — มีพิกัดใช้พิกัด ไม่มีก็ค้นด้วย "ชื่อสหกรณ์ + ที่อยู่"
   *
   * ห้ามใช้ที่อยู่ลอย ๆ อย่างเดียว: กูเกิลจะเดาเป็นเลขที่บ้านบนถนนเส้นนั้นแล้วปักหมุด
   * ผิดตึกไปเลย (ทดสอบแล้วได้โรงงานคนละฝั่งถนน) พอมีชื่อสหกรณ์นำหน้าจะเจอสถานที่จริง
   */
  const destination = mapPoint?.trim() || `${coopName} ${address}`;

  // มีจุดเริ่มต้นแล้วสลับแผนที่เป็นแบบเส้นทาง (saddr/daddr) ยังไม่มีก็ปักหมุดเฉย ๆ
  const mapSrc = origin.trim()
    ? `https://maps.google.com/maps?saddr=${encodeURIComponent(origin)}&daddr=${encodeURIComponent(destination)}&hl=th&output=embed`
    : `https://maps.google.com/maps?q=${encodeURIComponent(destination)}&z=16&hl=th&output=embed`;

  const directionsUrl =
    "https://www.google.com/maps/dir/?api=1" +
    (origin.trim() ? `&origin=${encodeURIComponent(origin)}` : "") +
    `&destination=${encodeURIComponent(destination)}&travelmode=${mode}`;

  /** ขอตำแหน่งจากเบราว์เซอร์ — ต้องเป็น https ถึงจะขออนุญาตได้ */
  function useMyLocation() {
    setGeoError(null);

    if (!navigator.geolocation) {
      setGeoError("เบราว์เซอร์นี้ไม่รองรับการหาตำแหน่ง กรุณาพิมพ์จุดเริ่มต้นเอง");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setOrigin(`${latitude.toFixed(6)},${longitude.toFixed(6)}`);
        setLocating(false);
      },
      () => {
        setLocating(false);
        setGeoError("ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง — พิมพ์ชื่อสถานที่เริ่มต้นเองได้");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function copy(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000);
    } catch {
      setCopied(null);
    }
  }

  /** ช่องทางติดต่อที่กดแล้วกางข้อมูลออกมาให้เลย ไม่ต้องเดาว่าเบอร์อะไร */
  const channels = [
    ...phones.map((phone, i) => ({
      id: `phone-${i}`,
      icon: Phone,
      title: "โทรศัพท์",
      value: phone,
      href: `tel:${phone.replace(/[^\d+]/g, "")}`,
      action: "โทรออก",
      tone: "bg-brand-50 text-brand-700 ring-brand-100",
    })),
    ...(fax
      ? [
          {
            id: "fax",
            icon: Printer,
            title: "โทรสาร",
            value: fax,
            href: "",
            action: "",
            tone: "bg-gray-50 text-gray-600 ring-gray-200",
          },
        ]
      : []),
    {
      id: "email",
      icon: Mail,
      title: "อีเมล",
      value: email,
      href: `mailto:${email}`,
      action: "เขียนอีเมล",
      tone: "bg-amber-50 text-amber-700 ring-amber-100",
    },
    ...(lineId || line
      ? [
          {
            id: "line",
            icon: Line,
            title: "ไลน์ทางการ",
            value: lineId || "เพิ่มเพื่อนผ่านลิงก์",
            href: line ?? "",
            action: "เพิ่มเพื่อน",
            tone: "bg-emerald-50 text-emerald-700 ring-emerald-100",
          },
        ]
      : []),
    ...(facebook
      ? [
          {
            id: "facebook",
            icon: Facebook,
            title: "เฟซบุ๊ก",
            value: "เพจสหกรณ์ออมทรัพย์สาธารณสุขสงขลา",
            href: facebook,
            action: "เปิดเพจ",
            tone: "bg-sky-50 text-sky-700 ring-sky-100",
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      {/* ---- แผนที่ + นำทาง ---- */}
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <div className="aspect-16/10 w-full bg-gray-100 sm:aspect-16/7">
          <iframe
            key={mapSrc}
            src={mapSrc}
            title={`แผนที่ ${coopName}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-full w-full border-0"
          />
        </div>

        <div className="border-t border-gray-100 p-4 md:p-5">
          <h2 className="flex items-center gap-2 font-semibold text-gray-800">
            <Navigation className="h-4 w-4 text-brand-600" /> นำทางมาที่สหกรณ์
          </h2>

          {/* ปลายทางล็อกไว้ตายตัว สมาชิกกรอกแค่จุดเริ่มต้น */}
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="block text-sm text-gray-600">
              จุดเริ่มต้น
              <div className="mt-1 flex gap-2">
                <input
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="เช่น โรงพยาบาลหาดใหญ่ หรือกดใช้ตำแหน่งปัจจุบัน"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base outline-none focus:border-brand-500"
                />
                <button
                  type="button"
                  onClick={useMyLocation}
                  disabled={locating}
                  title="ใช้ตำแหน่งปัจจุบันของฉัน"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-60"
                >
                  {locating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Crosshair className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">ตำแหน่งฉัน</span>
                </button>
              </div>
            </label>

            <div className="text-sm text-gray-600">
              ปลายทาง
              <div className="mt-1 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 ring-1 ring-gray-200">
                <Lock className="h-4 w-4 shrink-0 text-gray-400" />
                <span className="truncate font-medium text-gray-700">{coopName}</span>
              </div>
            </div>
          </div>

          {geoError && <p className="mt-2 text-sm text-amber-700">{geoError}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {TRAVEL_MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  mode === m.key
                    ? "bg-brand-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {m.label}
              </button>
            ))}

            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-700"
            >
              <Navigation className="h-4 w-4" /> เปิดนำทางในกูเกิลแมป
              <ExternalLink className="h-3.5 w-3.5 opacity-80" />
            </a>
          </div>

          <p className="mt-2 text-xs text-gray-500">
            ใส่จุดเริ่มต้นแล้วแผนที่ด้านบนจะเปลี่ยนเป็นเส้นทางให้ทันที · ปลายทางล็อกเป็นสหกรณ์เสมอ
          </p>
        </div>
      </section>

      {/* ---- ที่อยู่ + เวลาทำการ ---- */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="flex items-center gap-2 font-semibold text-gray-800">
            <MapPin className="h-4 w-4 text-brand-600" /> ที่อยู่สำนักงาน
          </h2>
          <p className="mt-2 leading-relaxed text-gray-600">{address}</p>
          <button
            type="button"
            onClick={() => copy(address, "address")}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-100"
          >
            {copied === "address" ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" /> คัดลอกแล้ว
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" /> คัดลอกที่อยู่
              </>
            )}
          </button>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="flex items-center gap-2 font-semibold text-gray-800">
            <Clock className="h-4 w-4 text-brand-600" /> เวลาทำการ
          </h2>
          <p className="mt-2 text-gray-600">{officeHours}</p>
          {closedDays && (
            <p className="mt-1 text-sm text-gray-500">{closedDays} และวันหยุดสหกรณ์ — ปิดทำการ</p>
          )}
        </div>
      </section>

      {/* ---- ช่องทางติดต่อ: ไอคอนกดแล้วกางข้อมูล ---- */}
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <h2 className="font-semibold text-gray-800">ช่องทางติดต่อ</h2>
        <p className="mt-0.5 text-sm text-gray-500">กดที่ไอคอนเพื่อดูข้อมูลและใช้งานได้ทันที</p>

        <div className="mt-4 flex flex-wrap gap-3">
          {channels.map((channel) => (
            <button
              key={channel.id}
              type="button"
              onClick={() => setOpenChannel((c) => (c === channel.id ? null : channel.id))}
              title={`${channel.title} ${channel.value}`}
              aria-label={`${channel.title} ${channel.value}`}
              aria-pressed={openChannel === channel.id}
              className={`w-24 rounded-2xl px-2 py-3 text-center ring-1 transition hover:-translate-y-0.5 hover:shadow-md ${channel.tone} ${
                openChannel === channel.id ? "-translate-y-0.5 shadow-md" : ""
              }`}
            >
              <channel.icon className="mx-auto h-6 w-6" />
              <span className="mt-1.5 block truncate text-[11px] font-medium">{channel.title}</span>
            </button>
          ))}
        </div>

        {/* กดไอคอนไหนก็กางข้อมูลของช่องทางนั้นออกมาตรงนี้ */}
        {channels.map(
          (channel) =>
            openChannel === channel.id && (
              <div
                key={channel.id}
                className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-gray-50 p-4 ring-1 ring-gray-200"
              >
                <channel.icon className="h-5 w-5 shrink-0 text-gray-500" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">{channel.title}</p>
                  <p className="truncate font-medium text-gray-800">{channel.value}</p>
                </div>

                <div className="ml-auto flex gap-2">
                  <button
                    type="button"
                    onClick={() => copy(channel.value, channel.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-100"
                  >
                    {copied === channel.id ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" /> คัดลอกแล้ว
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> คัดลอก
                      </>
                    )}
                  </button>

                  {channel.href && channel.action && (
                    <a
                      href={channel.href}
                      target={channel.href.startsWith("http") ? "_blank" : undefined}
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700"
                    >
                      {channel.action}
                    </a>
                  )}
                </div>
              </div>
            ),
        )}
      </section>

      {/* ---- เลขที่บัญชี ---- */}
      {bankAccounts.length > 0 && (
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="flex items-center gap-2 font-semibold text-gray-800">
            <Landmark className="h-4 w-4 text-brand-600" /> เลขที่บัญชีสหกรณ์
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            โอนเงินแล้วส่งหลักฐานให้เจ้าหน้าที่ทุกครั้ง เพื่อให้บันทึกรายการได้ถูกต้อง
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {bankAccounts.map((account, i) => (
              <div key={`${account.number}-${i}`} className="rounded-xl bg-gray-50 p-4 ring-1 ring-gray-200">
                <p className="text-sm font-semibold text-gray-700">
                  ธนาคาร{account.bank} สาขา{account.branch}
                </p>
                <p className="mt-2 font-mono text-xl font-bold tracking-wide text-brand-700">
                  {account.number}
                </p>
                <p className="mt-1 text-sm text-gray-500">ชื่อบัญชี {account.name}</p>

                <button
                  type="button"
                  onClick={() => copy(account.number, `bank-${i}`)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-100"
                >
                  {copied === `bank-${i}` ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" /> คัดลอกแล้ว
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> คัดลอกเลขบัญชี
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
