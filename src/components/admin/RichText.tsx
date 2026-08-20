"use client";

import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Link2, Unlink } from "lucide-react";
import { cleanInline } from "@/lib/pageBlocks";

/**
 * ช่องพิมพ์ข้อความหนึ่งบรรทัด/หนึ่งย่อหน้าของ EditUI — พิมพ์ได้เลย ไม่ต้องเห็นแท็ก
 *
 * ตัวหนา/ตัวเอียง/ลิงก์ กดจากปุ่มที่โผล่ตอนคลิกเข้าไปในช่อง ผลที่ได้เป็น
 * <strong> <em> <a> เหมือนที่แถบเครื่องมือของ EditCode เขียน — สลับโหมดไปมาแล้วตรงกัน
 *
 * เป็นช่องแบบ "ปล่อยอิสระ" (uncontrolled) ตั้งใจ: React ไม่เขียน innerHTML ทับ
 * ระหว่างพิมพ์ ไม่งั้นเคอร์เซอร์จะเด้งไปต้นบรรทัดทุกตัวอักษร ค่าที่พิมพ์ถูกส่งออกไป
 * ทาง onChange เท่านั้น แล้วค่อยล้างแท็กขยะให้ตรงกับ DOM ตอนคลิกออกจากช่อง
 */
export default function RichText({
  value,
  onChange,
  placeholder,
  singleLine = false,
  className = "",
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /** true = กด Enter แล้วไม่ขึ้นบรรทัดใหม่ (ใช้กับหัวข้อและช่องในตาราง) */
  singleLine?: boolean;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [empty, setEmpty] = useState(!value.trim());

  /*
   * เขียนเนื้อหาลง DOM เฉพาะตอนที่ช่องนี้ไม่ได้ถูกพิมพ์อยู่ — ครอบคลุมทั้งตอนสร้างช่อง
   * และตอนที่ข้างนอกเปลี่ยนค่าให้ (เช่นสลับกลับมาจาก EditCode) โดยไม่กวนคนที่กำลังพิมพ์
   */
  useEffect(() => {
    const el = box.current;
    if (!el || focused) return;
    if (el.innerHTML !== value) el.innerHTML = value;
    setEmpty(!(el.textContent ?? "").trim());
  }, [value, focused]);

  const publish = () => {
    const el = box.current;
    if (!el) return;
    setEmpty(!(el.textContent ?? "").trim());
    onChange(cleanInline(el.innerHTML));
  };

  /** ครอบข้อความที่เลือกไว้ด้วยรูปแบบที่กด — ต้องให้ช่องมีโฟกัสก่อน คำสั่งถึงจะรู้ว่าทำกับที่ไหน */
  const run = (command: string, arg?: string) => {
    box.current?.focus();
    document.execCommand(command, false, arg);
    publish();
  };

  const addLink = () => {
    const url = prompt("ลิงก์ปลายทาง — วางที่อยู่เว็บ หรือที่อยู่ในเว็บนี้ เช่น /downloads/");
    if (url === null) return;
    const clean = url.trim();
    if (!clean) return;
    run("createLink", clean);
  };

  return (
    <div className={`relative ${className}`}>
      {focused && (
        <div className="absolute -top-8 left-0 z-10 flex items-center gap-0.5 rounded-lg bg-gray-800 px-1 py-1 shadow-lg">
          <ToolButton icon={Bold} title="ตัวหนา" onClick={() => run("bold")} />
          <ToolButton icon={Italic} title="ตัวเอียง" onClick={() => run("italic")} />
          <ToolButton icon={Link2} title="ใส่ลิงก์" onClick={addLink} />
          <ToolButton icon={Unlink} title="เอาลิงก์ออก" onClick={() => run("unlink")} />
        </div>
      )}

      <div
        ref={box}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline={!singleLine}
        onInput={publish}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          publish();
        }}
        onKeyDown={(e) => {
          if (singleLine && e.key === "Enter") e.preventDefault();
        }}
        /*
         * วางข้อความจาก Word/เว็บอื่นให้เหลือแต่ตัวอักษร — ของที่ก๊อปมามักพ่วง
         * <span style="font-family:TH SarabunPSK"> มาเป็นพรวน ซึ่งไปทับสไตล์ของเว็บ
         */
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
        }}
        className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-base leading-relaxed outline-none transition focus:border-brand-500 ${
          singleLine ? "" : "min-h-[2.75rem]"
        }`}
      />

      {empty && placeholder && (
        <span className="pointer-events-none absolute left-3 top-2 text-base text-gray-400">
          {placeholder}
        </span>
      )}
    </div>
  );
}

/** ปุ่มบนแถบรูปแบบที่ลอยอยู่เหนือช่องพิมพ์ */
function ToolButton({
  icon: Icon,
  title,
  onClick,
}: {
  icon: typeof Bold;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      // กดปุ่มแล้วช่องต้องไม่เสียโฟกัส ไม่งั้นจะไม่รู้ว่าเลือกข้อความไหนไว้
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="rounded p-1.5 text-gray-300 transition hover:bg-white/15 hover:text-white"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
