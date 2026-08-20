"use client";

import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Link2, Unlink } from "lucide-react";
import { cleanInline } from "@/lib/pageBlocks";

/**
 * ข้อความที่พิมพ์ทับได้ตรงที่มันอยู่บนหน้าเว็บ
 *
 * ตัวนี้ไม่ใช่ "ช่องกรอก" — มันคือแท็กจริงของหน้าเว็บ (h2 · p · li · td) ที่พิมพ์ได้
 * เจ้าหน้าที่จึงเห็นตัวหนังสือขนาดจริง สีจริง ตำแหน่งจริง ระหว่างพิมพ์
 * ไม่ต้องนึกภาพเอาเองว่าพิมพ์ไปแล้วจะออกมาหน้าตายังไง
 *
 * ตัวหนา/ตัวเอียง/ลิงก์ อยู่บนแถบเล็ก ๆ ที่ลอยขึ้นมาตอนคลิกเข้าไปในข้อความ
 * ผลที่ได้เป็น <strong> <em> <a> เหมือนที่ EditCode เขียน — สลับโหมดแล้วตรงกัน
 *
 * เป็นช่องแบบ "ปล่อยอิสระ" (uncontrolled) ตั้งใจ: React ไม่เขียน innerHTML ทับ
 * ระหว่างพิมพ์ ไม่งั้นเคอร์เซอร์จะเด้งไปต้นบรรทัดทุกตัวอักษร ค่าที่พิมพ์ถูกส่งออก
 * ทาง onChange เท่านั้น แล้วค่อยล้างแท็กขยะให้ตรงกับ DOM ตอนคลิกออกจากข้อความ
 */

export type TextTag =
  | "div"
  | "h2"
  | "h3"
  | "h4"
  | "p"
  | "li"
  | "td"
  | "th"
  | "span"
  | "blockquote"
  | "figcaption";

export default function RichText({
  value,
  onChange,
  placeholder,
  as = "div",
  singleLine = false,
  className = "",
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /** แท็กจริงที่จะวาด — ใช้ให้ตรงกับที่จะออกไปอยู่บนหน้าเว็บ */
  as?: TextTag;
  /** true = กด Enter แล้วไม่ขึ้นบรรทัดใหม่ (หัวข้อ ช่องในตาราง ชื่อคน) */
  singleLine?: boolean;
  className?: string;
}) {
  const box = useRef<HTMLElement>(null);
  const [bar, setBar] = useState<{ top: number; left: number } | null>(null);
  const [empty, setEmpty] = useState(!value.trim());

  /*
   * เขียนเนื้อหาลง DOM เฉพาะตอนที่ไม่ได้ถูกพิมพ์อยู่ — ครอบคลุมทั้งตอนสร้าง
   * และตอนที่ข้างนอกเปลี่ยนค่าให้ (เช่นสลับกลับมาจาก EditCode) โดยไม่กวนคนที่กำลังพิมพ์
   */
  useEffect(() => {
    const el = box.current;
    if (!el || bar) return;
    if (el.innerHTML !== value) el.innerHTML = value;
    setEmpty(!(el.textContent ?? "").trim());
  }, [value, bar]);

  const publish = () => {
    const el = box.current;
    if (!el) return;
    setEmpty(!(el.textContent ?? "").trim());
    onChange(cleanInline(el.innerHTML));
  };

  /** แถบรูปแบบลอยเหนือข้อความที่กำลังพิมพ์ — วัดตำแหน่งจริงเอา ไม่ต้องมี div ครอบ */
  const placeBar = () => {
    const rect = box.current?.getBoundingClientRect();
    if (rect) setBar({ top: rect.top - 38, left: rect.left });
  };

  /** ครอบข้อความที่เลือกไว้ด้วยรูปแบบที่กด — ต้องมีโฟกัสก่อน คำสั่งถึงจะรู้ว่าทำกับที่ไหน */
  const run = (command: string, arg?: string) => {
    box.current?.focus();
    document.execCommand(command, false, arg);
    publish();
  };

  const addLink = () => {
    const url = prompt("ลิงก์ปลายทาง — วางที่อยู่เว็บ หรือที่อยู่ในเว็บนี้ เช่น /downloads/");
    if (url === null) return;
    const clean = url.trim();
    if (clean) run("createLink", clean);
  };

  // วาดเป็นแท็กจริงที่ขอมา — h2/p/li/td ฯลฯ ไม่ใช่ div ที่แต่งให้เหมือน
  const Tag = as as React.ElementType;

  return (
    <>
      <Tag
        ref={box}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline={!singleLine}
        data-empty={empty ? "" : undefined}
        data-placeholder={placeholder}
        onInput={publish}
        onFocus={placeBar}
        onBlur={() => {
          setBar(null);
          publish();
        }}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (singleLine && e.key === "Enter") e.preventDefault();
        }}
        /*
         * วางข้อความจาก Word/เว็บอื่นให้เหลือแต่ตัวอักษร — ของที่ก๊อปมามักพ่วง
         * <span style="font-family:TH SarabunPSK"> มาเป็นพรวน ซึ่งไปทับสไตล์ของเว็บ
         */
        onPaste={(e: React.ClipboardEvent) => {
          e.preventDefault();
          document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
        }}
        className={`edit-text ${className}`}
      />
      {bar && (
        <div
          style={{ top: bar.top, left: bar.left }}
          className="fixed z-50 flex items-center gap-0.5 rounded-lg bg-gray-800 px-1 py-1 shadow-lg"
        >
          <ToolButton icon={Bold} title="ตัวหนา" onClick={() => run("bold")} />
          <ToolButton icon={Italic} title="ตัวเอียง" onClick={() => run("italic")} />
          <ToolButton icon={Link2} title="ใส่ลิงก์" onClick={addLink} />
          <ToolButton icon={Unlink} title="เอาลิงก์ออก" onClick={() => run("unlink")} />
        </div>
      )}
    </>
  );
}

/** ปุ่มบนแถบรูปแบบที่ลอยอยู่เหนือข้อความ */
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
      // กดปุ่มแล้วข้อความต้องไม่เสียโฟกัส ไม่งั้นจะไม่รู้ว่าเลือกตัวไหนไว้
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="rounded p-1.5 text-gray-300 transition hover:bg-white/15 hover:text-white"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
