"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  Coins,
  Info,
  Percent,
  Phone,
  Printer,
  RotateCcw,
  Wallet,
} from "lucide-react";
import {
  AMOUNT_CHIPS,
  COMPARE_DAYS,
  DAY_BASES,
  DAY_CHIPS,
  LEGAL_MAX_MONTHLY,
  LEGAL_MAX_YEARLY,
  SAMPLE_DAYS,
  SAMPLE_PRINCIPAL,
  SAMPLE_RATE,
  calcInterest,
  daysBetween,
  money,
  plain,
  readNumber,
  readRateText,
  thaiDate,
  todayISO,
  touchesLeapYear,
  type DayBasis,
} from "@/lib/interestCalc";
import { INTEREST_CREDIT, INTEREST_VERSION } from "@/lib/programPages";

/**
 * โปรแกรมคำนวณดอกเบี้ย — ทำงานฝั่งเบราว์เซอร์ล้วน คิดใหม่ทุกครั้งที่พิมพ์
 *
 * ⚠️ **ไม่มีปุ่ม "คำนวณ" ตั้งใจ** ผลขึ้นทันทีที่แก้ตัวเลข สมาชิกจึงลองเลื่อนดูได้ว่า
 * "ถ้าจ่ายเร็วขึ้นอีก 10 วันจะประหยัดเท่าไร" โดยไม่ต้องกดปุ่มซ้ำทุกครั้ง
 *
 * ⚠️ **ไม่ส่งอะไรไปไหนทั้งนั้น** ไม่มี fetch ไม่มี localStorage — ตัวเลขหนี้สินของสมาชิก
 * เป็นข้อมูลอ่อนไหว หลักเดียวกับโปรแกรมตรวจสุขภาพการเงิน
 *
 * ⚠️ **โปรแกรมนี้พิมพ์ตัวเลขได้ ต่างจากโปรแกรมตรวจสุขภาพการเงินที่ห้ามมีช่องพิมพ์**
 * เพราะที่นี่สมาชิกถือใบเสร็จอยู่ในมือแล้ว ต้องกรอกยอดคงค้างให้ตรงถึงหลักบาท
 * เลื่อนสเกลเอาไม่ได้ · แต่ยังมีปุ่มลัดเลขกลม ๆ ให้กดสำหรับคนที่แค่อยากลองดู
 */

export default function InterestCalculator({
  loanRates,
  contactPhone,
  lineId,
}: {
  /** อัตราดอกเบี้ยเงินกู้จริงของสหกรณ์ — เจ้าหน้าที่ตั้งที่ หลังบ้าน → อัตราดอกเบี้ย */
  loanRates: { label: string; rate: string }[];
  /** เบอร์สหกรณ์ — แอดมินแก้ได้ที่ หลังบ้าน → ส่วนท้ายเว็บ (ห้ามฝังเบอร์ไว้ในโค้ด) */
  contactPhone: string;
  /** ไอดีไลน์ของสหกรณ์ — มาจากที่เดียวกัน เว้นว่าง = ไม่แสดงบรรทัดไลน์ */
  lineId: string;
}) {
  /* ปุ่มลัดอัตราดอกเบี้ย — เอาเฉพาะรายการที่อ่านเป็นตัวเลขได้ และตัดตัวซ้ำออก */
  const rateChips = useMemo(() => {
    const seen = new Set<number>();
    return loanRates
      .map((row) => ({ label: row.label, rate: readRateText(row.rate) }))
      .filter((row) => {
        if (row.rate <= 0 || seen.has(row.rate)) return false;
        seen.add(row.rate);
        return true;
      });
  }, [loanRates]);

  const [principalText, setPrincipalText] = useState(String(SAMPLE_PRINCIPAL));
  // ตั้งต้นด้วยอัตราจริงของสหกรณ์ถ้ามี — ไม่มีค่อยใช้เลขในตัวอย่างของใบประชาสัมพันธ์
  const [rateText, setRateText] = useState(() => String(rateChips[0]?.rate ?? SAMPLE_RATE));
  const [daysText, setDaysText] = useState(String(SAMPLE_DAYS));
  const [basis, setBasis] = useState<DayBasis>(365);

  /** นับวันเอง หรือให้ระบบนับจากปฏิทิน */
  const [mode, setMode] = useState<"days" | "dates">("days");
  const [from, setFrom] = useState(() => todayISO());
  const [to, setTo] = useState(() => todayISO());

  const principal = readNumber(principalText);
  const rate = readNumber(rateText);

  /** จำนวนวันที่เอาไปคิดจริง — โหมดปฏิทินนับให้จากวันที่สองช่อง */
  const picked = mode === "dates" ? daysBetween(from, to) : null;
  const days = mode === "dates" ? (picked ?? 0) : readNumber(daysText);
  /** วันชำระอยู่ก่อนวันเริ่ม = กรอกสลับกัน ต้องบอกให้แก้ ไม่ใช่คิดเป็น 0 เงียบ ๆ */
  const badRange = mode === "dates" && picked === null;

  const result = useMemo(
    () => calcInterest({ principal, rate, days, basis }),
    [principal, rate, days, basis],
  );

  /** ช่วงที่เลือกคร่อมปีอธิกสุรทิน — เตือนว่าจะใช้ตัวหาร 366 ก็ได้ */
  const leapHint = mode === "dates" && !badRange && basis === 365 && touchesLeapYear(from, to);

  const reset = () => {
    setPrincipalText(String(SAMPLE_PRINCIPAL));
    setRateText(String(rateChips[0]?.rate ?? SAMPLE_RATE));
    setDaysText(String(SAMPLE_DAYS));
    setBasis(365);
    setMode("days");
    setFrom(todayISO());
    setTo(todayISO());
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      {/* ---------------- กรอกตัวเลข ---------------- */}
      <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
        <div className="border-b border-brand-100 bg-gradient-to-b from-brand-50/80 to-white px-5 py-5 md:px-8">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/25">
              <Coins className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-brand-900 md:text-xl">
                คำนวณดอกเบี้ยเงินกู้ (ร้อยละต่อปี)
              </h2>
              <p className="text-sm text-gray-600">
                กรอกสามช่อง แล้วดูผลด้านล่างได้ทันที ไม่ต้องกดปุ่มคำนวณ
              </p>
            </div>
          </div>

          {/*
            สูตรตั้งต้นแบบเดียวกับใบประชาสัมพันธ์ — วางไว้ตรงนี้ให้เห็นก่อนกรอก
            สมาชิกที่เคยเห็นใบประชาสัมพันธ์จะจับคู่ได้ทันทีว่าโปรแกรมคิดแบบเดียวกัน
          */}
          <div className="mt-4 overflow-x-auto rounded-2xl bg-brand-900 px-4 py-3 text-white">
            <div className="flex min-w-max items-center gap-2 text-sm md:text-base">
              <span className="font-semibold">ดอกเบี้ยที่ต้องจ่าย =</span>
              <span>เงินต้นคงค้าง</span>
              <span className="text-brand-200">×</span>
              <Fraction top="อัตราดอกเบี้ย" bottom="100" />
              <span className="text-brand-200">×</span>
              <Fraction top="จำนวนวันที่คิดดอกเบี้ย" bottom={`${basis} (วัน)`} />
            </div>
          </div>
        </div>

        <div className="grid gap-5 px-5 py-6 md:grid-cols-2 md:px-8">
          {/* เงินต้นคงค้าง */}
          <Field
            id="principal"
            label="เงินต้นคงค้าง"
            hint="ยอดหนี้ที่ยังไม่ได้ชำระ ณ วันที่เริ่มคิดดอกเบี้ย"
            icon={<Wallet className="h-4 w-4" />}
            unit="บาท"
            value={principalText}
            onChange={setPrincipalText}
          >
            <Chips
              items={AMOUNT_CHIPS.map((amount) => ({ key: amount, label: plain(amount) }))}
              active={principal}
              onPick={(next) => setPrincipalText(String(next))}
            />
          </Field>

          {/* อัตราดอกเบี้ย */}
          <Field
            id="rate"
            label="อัตราดอกเบี้ย (ร้อยละต่อปี)"
            hint="ดูได้จากสัญญาเงินกู้ หรือกดเลือกจากอัตราของสหกรณ์"
            icon={<Percent className="h-4 w-4" />}
            unit="% ต่อปี"
            value={rateText}
            onChange={setRateText}
          >
            {rateChips.length > 0 ? (
              <Chips
                items={rateChips.map((row) => ({
                  key: row.rate,
                  label: `${row.label} ${row.rate}%`,
                }))}
                active={rate}
                onPick={(next) => setRateText(String(next))}
              />
            ) : null}
          </Field>

          {/* จำนวนวัน — พิมพ์เองหรือให้ปฏิทินนับให้ */}
          <div className="md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                <CalendarDays className="h-4 w-4 text-gray-400" />
                จำนวนวันที่คิดดอกเบี้ย
              </span>

              {/* สลับวิธีกรอก — ปุ่มคู่ ไม่ใช่ช่องติ๊ก จะได้เห็นทั้งสองทางเลือกพร้อมกัน */}
              <div className="no-print flex rounded-full bg-gray-100 p-1 text-sm">
                <button
                  type="button"
                  onClick={() => setMode("days")}
                  className={`rounded-full px-3.5 py-1.5 font-medium transition ${
                    mode === "days" ? "bg-white text-brand-700 shadow-sm" : "text-gray-500"
                  }`}
                >
                  ใส่จำนวนวันเอง
                </button>
                <button
                  type="button"
                  onClick={() => setMode("dates")}
                  className={`rounded-full px-3.5 py-1.5 font-medium transition ${
                    mode === "dates" ? "bg-white text-brand-700 shadow-sm" : "text-gray-500"
                  }`}
                >
                  เลือกจากปฏิทิน
                </button>
              </div>
            </div>

            {mode === "days" ? (
              <>
                <NumberBox
                  id="days"
                  unit="วัน"
                  value={daysText}
                  onChange={setDaysText}
                  className="mt-2"
                />
                <Chips
                  items={DAY_CHIPS.map((chip) => ({ key: chip.days, label: chip.label }))}
                  active={days}
                  onPick={(next) => setDaysText(String(next))}
                />
              </>
            ) : (
              <>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <DateBox id="from" label="วันที่เริ่มคิดดอกเบี้ย" value={from} onChange={setFrom} />
                  <DateBox id="to" label="วันที่ชำระ" value={to} onChange={setTo} />
                </div>
                <p
                  className={`mt-2 text-sm ${badRange ? "font-medium text-red-600" : "text-gray-500"}`}
                >
                  {badRange
                    ? "วันที่ชำระต้องไม่อยู่ก่อนวันที่เริ่มคิดดอกเบี้ย — กรอกสลับกันอยู่หรือเปล่า"
                    : `${thaiDate(from)} ถึง ${thaiDate(to)} นับได้ ${plain(days)} วัน`}
                </p>
              </>
            )}
          </div>

          {/* ตัวหาร 365 / 366 */}
          <div className="md:col-span-2">
            <span className="text-sm font-semibold text-gray-700">จำนวนวันใน 1 ปี (ตัวหาร)</span>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {DAY_BASES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setBasis(value)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium tabular-nums transition ${
                    basis === value
                      ? "bg-brand-600 text-white shadow"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {value} วัน
                </button>
              ))}
              <span className="text-xs text-gray-500">
                ปกติใช้ 365 วัน · บางกิจการคิด 366 วันตามจำนวนวันจริงของปีนั้น ๆ
              </span>
            </div>
            {leapHint && (
              <p className="mt-2 inline-flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                ช่วงวันที่เลือกไว้คร่อมปีอธิกสุรทิน (เดือนกุมภาพันธ์มี 29 วัน) ถ้าเจ้าหนี้คิดตามวันจริงของปี
                ให้เลือกตัวหาร 366 วัน
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ---------------- ผลลัพธ์ ---------------- */}
      <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
        <div className="px-5 py-6 md:px-8">
          {result.ready && !badRange ? (
            <>
              <p className="text-sm font-medium text-gray-500">ดอกเบี้ยที่ต้องจ่าย</p>
              <p className="mt-1 text-4xl font-bold tabular-nums text-brand-700 md:text-5xl">
                {money(result.interest)}{" "}
                <span className="text-2xl font-semibold text-brand-600 md:text-3xl">บาท</span>
              </p>

              {/*
                วิธีคิดเป็นตัวเลขจริง — หัวใจของโปรแกรมนี้
                สมาชิกที่สงสัยว่าสหกรณ์คิดมาได้ยังไง จะได้เอาไปทานกับใบเสร็จทีละตัว
                (เลื่อนแนวนอนได้บนมือถือ ไม่ตัดบรรทัดกลางสูตร)
              */}
              <div className="mt-4 overflow-x-auto rounded-2xl bg-gray-50 px-4 py-3 ring-1 ring-gray-100">
                <div className="flex min-w-max items-center gap-2 text-sm text-gray-700 md:text-base">
                  <span className="tabular-nums">{plain(principal)}</span>
                  <span className="text-gray-400">×</span>
                  <Fraction top={String(rate)} bottom="100" />
                  <span className="text-gray-400">×</span>
                  <Fraction top={plain(days)} bottom={String(basis)} />
                  <span className="text-gray-400">=</span>
                  <span className="font-bold tabular-nums text-brand-700">
                    {money(result.interest)} บาท
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Tile
                  label="ดอกเบี้ยวันละ"
                  value={`${money(result.perDay)} บาท`}
                  hint="ชำระเร็วขึ้น 1 วัน ประหยัดได้เท่านี้"
                />
                <Tile
                  label="เงินต้น + ดอกเบี้ย"
                  value={`${money(result.total)} บาท`}
                  hint="ยอดรวมถ้าปิดหนี้ทั้งก้อนในวันที่ชำระ"
                  strong
                />
              </div>

              {/* ตารางเทียบ — ตอบคำถามที่ตามมาเสมอว่า "แล้วถ้าปล่อยไว้อีกล่ะ" */}
              <div className="mt-5">
                <p className="text-sm font-semibold text-gray-700">
                  ถ้าเงินต้นและอัตราเท่าเดิม แต่ทิ้งไว้นานขึ้น
                </p>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[22rem] text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-500">
                        <th className="py-2 font-medium">จำนวนวัน</th>
                        <th className="py-2 text-right font-medium">ดอกเบี้ย (บาท)</th>
                        <th className="py-2 text-right font-medium">รวมกับเงินต้น (บาท)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {COMPARE_DAYS.map((n) => {
                        const row = calcInterest({ principal, rate, days: n, basis });
                        return (
                          <tr
                            key={n}
                            className={`border-b border-gray-100 ${n === days ? "bg-brand-50/60 font-semibold text-brand-800" : ""}`}
                          >
                            <td className="py-2 tabular-nums">{plain(n)} วัน</td>
                            <td className="py-2 text-right tabular-nums">{money(row.interest)}</td>
                            <td className="py-2 text-right tabular-nums">{money(row.total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <p className="py-6 text-center text-gray-500">
              {badRange
                ? "แก้วันที่ให้ถูกต้องก่อน แล้วผลจะขึ้นให้ทันที"
                : "กรอกเงินต้นคงค้าง อัตราดอกเบี้ย และจำนวนวัน แล้วผลจะขึ้นให้ทันที"}
            </p>
          )}
        </div>

        {/* คำเตือนเรื่องเพดานดอกเบี้ยตามกฎหมาย — มาจากใบประชาสัมพันธ์ของสหกรณ์ */}
        <div
          className={`border-t px-5 py-4 text-sm md:px-8 ${
            result.overLegal
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-gray-100 bg-gray-50 text-gray-600"
          }`}
        >
          <p className="flex items-start gap-2">
            {result.overLegal ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
            )}
            <span>
              {result.overLegal ? (
                <>
                  อัตราที่กรอกไว้ <b className="tabular-nums">{rate}%</b> ต่อปี{" "}
                  <b>เกินกว่าอัตราที่กฎหมายกำหนด</b> — การเรียกเก็บดอกเบี้ยเงินกู้ยืมของประชาชนทั่วไป
                  เกินกว่าร้อยละ {LEGAL_MAX_YEARLY} ต่อปี หรือร้อยละ {LEGAL_MAX_MONTHLY} ต่อเดือน
                  เป็นการเรียกดอกเบี้ยเกินกว่าอัตราที่กฎหมายกำหนด
                </>
              ) : (
                <>
                  การเรียกเก็บดอกเบี้ยเงินกู้ยืมของประชาชนทั่วไป เกินกว่าร้อยละ {LEGAL_MAX_YEARLY} ต่อปี
                  หรือร้อยละ {LEGAL_MAX_MONTHLY} ต่อเดือน เป็นการเรียกดอกเบี้ยเกินกว่าอัตราที่กฎหมายกำหนด
                </>
              )}
            </span>
          </p>
        </div>
      </section>

      {/* ---------------- ปุ่มและทางไปต่อ ---------------- */}
      <div className="no-print flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
        >
          <Printer className="h-4 w-4" /> พิมพ์ผลคำนวณ
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-brand-700"
        >
          <RotateCcw className="h-4 w-4" /> เริ่มใหม่
        </button>
      </div>

      <section className="no-print rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 md:p-6">
        <h2 className="text-base font-bold text-gray-800">สอบถามเพิ่มเติม</h2>
        <p className="mt-1 text-sm text-gray-600">
          ยอดที่คำนวณได้เป็นการประมาณตามตัวเลขที่กรอกเอง ยอดจริงตามสัญญาให้ยึดตามที่สหกรณ์แจ้ง
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {contactPhone && (
            <a
              href={`tel:${contactPhone.split(",")[0].replace(/[^\d+]/g, "")}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-700"
            >
              <Phone className="h-4 w-4" /> โทรหาเจ้าหน้าที่ {contactPhone}
            </a>
          )}
          {lineId && (
            <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
              ไลน์ {lineId}
            </span>
          )}
          <Link
            href="/loans/"
            className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200"
          >
            ดูอัตราดอกเบี้ยเงินกู้ทุกประเภท <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <p className="pb-2 text-center text-xs text-gray-400">
        {INTEREST_CREDIT} · เวอร์ชัน {INTEREST_VERSION}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * ชิ้นส่วนย่อย
 * ------------------------------------------------------------------ */

/**
 * เศษส่วนแบบในใบประชาสัมพันธ์ — ตัวเศษอยู่บน ตัวส่วนอยู่ล่าง มีเส้นคั่นกลาง
 * เขียนเป็น a/b บรรทัดเดียวก็ได้ แต่คนที่จับคู่กับใบประชาสัมพันธ์จะอ่านยากกว่ามาก
 */
function Fraction({ top, bottom }: { top: string; bottom: string }) {
  return (
    <span className="inline-flex flex-col items-center leading-tight">
      <span className="px-1.5 tabular-nums">{top}</span>
      <span className="my-0.5 h-px w-full self-stretch bg-current opacity-60" />
      <span className="px-1.5 tabular-nums">{bottom}</span>
    </span>
  );
}

/** ช่องกรอกตัวเลขพร้อมหน่วยท้ายช่อง */
function NumberBox({
  id,
  unit,
  value,
  onChange,
  className = "",
}: {
  id: string;
  unit: string;
  value: string;
  onChange: (next: string) => void;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      {/*
        ⚠️ type="text" + inputMode ตั้งใจ ไม่ใช้ type="number"
        — บนมือถือยังได้แป้นตัวเลขเหมือนกัน แต่ไม่มีลูกศรขึ้นลงมากวน
        และไม่โดนเบราว์เซอร์ล้างค่าทิ้งทั้งช่องเวลาพิมพ์จุลภาคหรือเลขไทยติดมา
      */}
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-4 pr-16 text-lg font-semibold tabular-nums text-gray-800 shadow-sm outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
      />
      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-medium text-gray-400">
        {unit}
      </span>
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  icon,
  unit,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  unit: string;
  value: string;
  onChange: (next: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700">
        <span className="text-gray-400">{icon}</span>
        {label}
      </label>
      <p className="mt-0.5 text-xs text-gray-500">{hint}</p>
      <NumberBox id={id} unit={unit} value={value} onChange={onChange} className="mt-2" />
      {children}
    </div>
  );
}

function DateBox({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-gray-500">
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base font-semibold text-gray-800 shadow-sm outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
      />
    </div>
  );
}

/** ปุ่มลัดเลขกลม ๆ ใต้ช่องกรอก — กดทีเดียวจบ ไม่ต้องพิมพ์ทีละหลัก */
function Chips({
  items,
  active,
  onPick,
}: {
  items: { key: number; label: string }[];
  active: number;
  onPick: (next: number) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="no-print mt-2 flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onPick(item.key)}
          className={`rounded-full px-3 py-1.5 text-sm font-medium tabular-nums transition ${
            active === item.key
              ? "bg-brand-600 text-white shadow"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  strong = false,
}: {
  label: string;
  value: string;
  hint: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl px-4 py-3 ring-1 ${
        strong ? "bg-brand-50 ring-brand-100" : "bg-gray-50 ring-gray-100"
      }`}
    >
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p
        className={`mt-0.5 text-xl font-bold tabular-nums ${strong ? "text-brand-800" : "text-gray-800"}`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-gray-500">{hint}</p>
    </div>
  );
}
