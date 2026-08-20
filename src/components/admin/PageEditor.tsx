"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Code2,
  FolderTree,
  Loader2,
  MousePointerClick,
  Save,
  Send,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import ContentToolbar from "@/components/admin/ContentToolbar";
import VisualEditor from "@/components/admin/VisualEditor";
import { repairStructure, structureProblems } from "@/lib/htmlStructure";
import { prettyHtml } from "@/lib/prettyHtml";
import Toggle from "@/components/ui/Toggle";

/** จำสวิตช์ AI ไว้ในเครื่องคนใช้ ไม่ใช่ในฐาน — เป็นความชอบส่วนตัวของแต่ละคน ไม่ใช่ค่าของเว็บ */
const AI_FORMAT_KEY = "spsc_page_ai_format";
/**
 * จำโหมดแก้ไขที่เลือกไว้ครั้งก่อน — คนที่ถนัด EditCode จะได้ไม่ต้องกดสลับทุกครั้งที่เปิดหน้า
 * เก็บเป็น cookie ด้วยเหตุผลเดียวกับสวิตช์ AI: เซิร์ฟเวอร์อ่านได้ตั้งแต่ตอน render
 * แท็บที่เลือกจึงขึ้นถูกตั้งแต่วินาทีแรก ไม่กระพริบจาก EditUI ไป EditCode หลังโหลดเสร็จ
 */
const MODE_KEY = "spsc_page_edit_mode";

/** จำค่าที่คนใช้เลือกไว้ 1 ปี — เป็นความชอบของแต่ละคน ไม่ใช่ค่าของเว็บ จึงไม่เก็บลงฐาน */
function remember(key: string, value: string) {
  document.cookie = `${key}=${value}; path=/; max-age=31536000; samesite=lax`;
}

type Mode = "ui" | "code";

type Props = {
  page: {
    id: string;
    slug: string;
    title: string;
    body: string;
    published: boolean;
    /** โฟลเดอร์เก็บไฟล์แนบของหน้านี้ใต้ assets/ */
    assetFolder: string;
    /** หมวดสำหรับจัดกลุ่มในรายการหลังบ้าน */
    category: string;
  };
  /** ตั้งคีย์ AI ไว้ไหม — ไม่ได้ตั้งก็ซ่อนสวิตช์จัดรูปแบบไปเลย */
  aiReady?: boolean;
  /** หมวดที่หน้าอื่นใช้อยู่ — ไว้เลือกซ้ำได้ ไม่ต้องพิมพ์ใหม่ให้สะกดต่างกัน */
  categories?: string[];
  /** ค่าสวิตช์ AI ที่ผู้ใช้เลือกไว้ครั้งก่อน (อ่านจาก cookie ฝั่งเซิร์ฟเวอร์) */
  aiFormatDefault?: boolean;
  /** โหมดแก้ไขที่ผู้ใช้เลือกไว้ครั้งก่อน (อ่านจาก cookie ฝั่งเซิร์ฟเวอร์) */
  modeDefault?: Mode;
};

/**
 * กรอบของแต่ละส่วนในหน้าแก้ไข — หัวข้อ + คำอธิบายว่าส่วนนี้มีไว้ทำอะไร
 *
 * เดิมทุกอย่างกองอยู่ในการ์ดใบเดียว ชื่อหน้า/ที่อยู่/หมวด/โฟลเดอร์/สวิตช์เผยแพร่
 * ปนกันหมดจนไม่รู้ว่าอันไหนมีผลกับอะไร — แยกเป็นส่วน ๆ ให้ชัดว่ากำลังตั้งเรื่องอะไรอยู่
 */
function Section({
  step,
  title,
  desc,
  icon: Icon,
  children,
  bare = false,
}: {
  step: number;
  title: string;
  desc: string;
  icon: typeof Save;
  children: React.ReactNode;
  /** true = ไม่ต้องมีขอบในของตัวเอง (ใช้กับส่วนเนื้อหาที่มีแถบแท็บเต็มความกว้าง) */
  bare?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <header className="flex items-start gap-3 border-b border-gray-100 px-4 py-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-gray-800">
            <span className="mr-1.5 text-gray-300">{step}</span>
            {title}
          </span>
          <span className="block text-xs text-gray-500">{desc}</span>
        </span>
      </header>
      <div className={bare ? "" : "p-4"}>{children}</div>
    </section>
  );
}

export default function PageEditor({
  page,
  aiReady = false,
  aiFormatDefault = true,
  modeDefault = "ui",
  categories = [],
}: Props) {
  const router = useRouter();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState(page.title);
  const [slug, setSlug] = useState(page.slug);
  const [assetFolder, setAssetFolder] = useState(page.assetFolder);
  const [category, setCategory] = useState(page.category);
  const [content, setContent] = useState(page.body);
  /**
   * เนื้อหาที่บันทึกลงฐานไปแล้วล่าสุด — เอาไว้เทียบว่ายังมีอะไรค้างไม่ได้บันทึกไหม
   *
   * เรื่องนี้สำคัญกว่าที่คิด: หน้าสไลด์บันทึกให้เองทันทีที่พิมพ์เสร็จ แต่หน้าเนื้อหา
   * ต้องกดบันทึกเอง (เพราะตอนบันทึกมีทั้ง AI จัดรูปแบบและการซ่อมโครงสร้าง
   * ซึ่งทำทุกครั้งที่พิมพ์ไม่ได้) — สองหน้าทำงานคนละแบบ ถ้าไม่บอกให้ชัด
   * คนจะพิมพ์แล้วปิดหน้าไปเพราะคิดว่าบันทึกแล้วเหมือนหน้าสไลด์
   */
  const [saved, setSaved] = useState(page.body);
  const [published, setPublished] = useState(page.published);
  const [mode, setMode] = useState<Mode>(modeDefault);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  /** กำลังรอ AI อยู่ — ใช้เปลี่ยนข้อความบนปุ่มและกันปิดหน้าไปก่อนบันทึกเสร็จ */
  const [formatting, setFormatting] = useState(false);

  const changeMode = (next: Mode) => {
    setMode(next);
    remember(MODE_KEY, next);
  };

  /**
   * ให้ AI จัดรูปแบบตอนกดบันทึกไหม — ค่าเริ่มต้นมาจาก cookie ที่ฝั่งเซิร์ฟเวอร์อ่านให้แล้ว
   *
   * เดิมเปิดใหม่ทุกครั้งที่เข้าหน้าแก้ไข ปิดไปแล้วพอกลับมาก็เปิดเองอีก
   * ซึ่งอันตรายกับหน้าที่จัดโครงเสร็จแล้ว (เคยโดน AI ยุบแท็ปเมนูทิ้งมาแล้ว)
   *
   * ใช้ cookie ไม่ใช่ localStorage เพราะเซิร์ฟเวอร์อ่านได้ตั้งแต่ตอน render
   * สวิตช์จึงขึ้นถูกตั้งแต่วินาทีแรก ไม่กระพริบจากเปิดเป็นปิดหลังโหลดเสร็จ
   */
  const [autoFormat, setAutoFormat] = useState(aiFormatDefault);

  const changeAutoFormat = (next: boolean) => {
    setAutoFormat(next);
    remember(AI_FORMAT_KEY, next ? "1" : "0");
  };

  /** เนื้อหามีโครงที่ AI อาจไปยุ่ง — เตือนไว้ก่อนกดบันทึก */
  const hasStructure = /class="(tabs|tab|image-row|ebook)"|<img|<figure/i.test(content);
  /** เนื้อหาก่อน AI จัด — เก็บไว้ให้กดย้อนกลับได้ถ้าไม่ถูกใจ */
  const [beforeAi, setBeforeAi] = useState<string | null>(null);
  /** ปัญหาโครงสร้างในเนื้อหาตอนนี้ — คำนวณสดทุกครั้งที่พิมพ์ ไม่ต้องกดตรวจเอง */
  const problems = structureProblems(content);

  /**
   * กันปิดแท็บ/กดย้อนกลับระหว่างกำลังบันทึก — งานที่ให้ AI จัดใช้เวลาถึงเกือบนาที
   * ปิดหน้าไปตอนนั้นคือเสียทั้งรูปที่เพิ่งแทรกและที่พิมพ์ค้างไว้
   */
  const dirty = content !== saved;

  useEffect(() => {
    // กันทั้งตอนกำลังบันทึก และตอนที่พิมพ์ไว้แล้วยังไม่ได้กดบันทึก
    if (!busy && !dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy, dirty]);

  /**
   * ให้ AI จัดโครงเนื้อหา — คืน HTML ที่จัดแล้ว หรือ null ถ้าทำไม่สำเร็จ
   * ล้มเหลวไม่เป็นไร ยังบันทึกเนื้อหาเดิมต่อได้ ไม่ควรทำให้กดบันทึกไม่ได้เลย
   */
  async function runFormat(html: string): Promise<string | null> {
    const response = await fetch("/api/admin/pages/format/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html, title }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || typeof data.html !== "string") return null;
    return data.html;
  }

  async function save() {
    setBusy(true);
    setStatus(null);

    let body = content;
    let note = "";

    if (autoFormat && aiReady && content.trim()) {
      setFormatting(true);
      setStatus({ kind: "ok", text: "กำลังให้ AI จัดรูปแบบ… อย่าเพิ่งปิดหน้านี้" });
      const formatted = await runFormat(content);
      setFormatting(false);
      if (formatted) {
        setBeforeAi(content);
        setContent(formatted);
        body = formatted;
        note = " · AI จัดรูปแบบให้แล้ว";
      } else {
        note = " · แต่ AI จัดรูปแบบไม่สำเร็จ เก็บของเดิมไว้";
      }
    }

    /*
     * ซ่อมโครงสร้างให้เสมอก่อนบันทึก — ห้ามให้เนื้อหาที่ </div> ไม่สมดุลหลุดขึ้นเว็บจริง
     *
     * เนื้อหาพิมพ์เป็น HTML ดิบ ก๊อปวาง/ลบไม่หมดทีเดียวก็เหลือตัวปิดเกิน แล้วกล่องแม่
     * ถูกปิดก่อนเวลา (หน้าข้อบังคับเคยแท็บหลุดออกนอกกล่องมาแล้ว) ในช่องพิมพ์ดูปกติทุกอย่าง
     * จึงไม่พึ่งให้คนสังเกตเอง — ซ่อมให้ตรงนี้แล้วบอกว่าซ่อมอะไรไป
     */
    const beforeRepair = body;
    const repairNotes = structureProblems(body);
    if (repairNotes.length > 0) {
      body = repairStructure(body);
      if (body !== beforeRepair) note += ` · ซ่อมโครงสร้างให้ (${repairNotes.join(" · ")})`;
    }

    // จัดย่อหน้าให้เป็นระเบียบเดียวกันทุกครั้งที่บันทึก — แตะแค่ช่องว่าง ไม่แตะข้อความ
    body = prettyHtml(body);
    if (body !== beforeRepair) setContent(body);

    const response = await fetch(`/api/admin/pages/${page.id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, slug, content: body, published, assetFolder, category }),
    });
    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      setStatus({ kind: "ok", text: `บันทึกแล้ว${note}` });
      setSaved(body);
      setSlug(data.page.slug);
      setAssetFolder(data.page.assetFolder ?? assetFolder);
      router.refresh();
    } else {
      setStatus({ kind: "error", text: data.error ?? "บันทึกไม่สำเร็จ" });
    }
    setBusy(false);
  }

  /** ย้อนกลับเป็นเนื้อหาก่อน AI จัด แล้วบันทึกทับให้เลย ไม่ต้องกดบันทึกซ้ำ */
  async function undoAi() {
    if (beforeAi === null) return;
    setBusy(true);
    setContent(beforeAi);

    const response = await fetch(`/api/admin/pages/${page.id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, slug, content: beforeAi, published, assetFolder, category }),
    });
    setBeforeAi(null);
    if (response.ok) setSaved(beforeAi);
    setBusy(false);
    setStatus(
      response.ok
        ? { kind: "ok", text: "ย้อนกลับเป็นเนื้อหาก่อน AI จัดแล้ว" }
        : { kind: "error", text: "ย้อนกลับไม่สำเร็จ" },
    );
    router.refresh();
  }

  async function remove() {
    if (!confirm(`ลบหน้า "${title}" ถาวร?\nเนื้อหาที่พิมพ์ไว้จะหายทั้งหมด`)) return;
    setBusy(true);
    await fetch(`/api/admin/pages/${page.id}/`, { method: "DELETE" });
    router.push("/admin/pages/");
  }

  return (
    <div className="space-y-4">
      {/* ---------- 1 · ชื่อและที่อยู่ ---------- */}
      <Section
        step={1}
        icon={Send}
        title="ชื่อหน้าและที่อยู่"
        desc="ชื่อที่ขึ้นหัวหน้าเว็บ และที่อยู่ที่สมาชิกพิมพ์เข้ามา"
      >
        <label className="block text-sm text-gray-600">
          ชื่อหน้า
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-base outline-none focus:border-brand-500"
          />
        </label>

        <label className="mt-3 block text-sm text-gray-600">
          ที่อยู่หน้า
          <span className="ml-1 text-xs text-gray-400">(เปลี่ยนแล้วลิงก์เดิมที่เคยส่งไว้จะเสีย)</span>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm outline-none focus:border-brand-500"
          />
        </label>
      </Section>

      {/* ---------- 2 · เนื้อหา ---------- */}
      <Section
        step={2}
        bare
        icon={MousePointerClick}
        title="เนื้อหาในหน้า"
        desc="พิมพ์ทับบนหน้าเว็บได้เลย ไม่ต้องรู้เรื่องโค้ด"
      >
        {/*
          ชื่อแท็บเป็นภาษาไทยก่อน ป้าย EditUI/EditCode เป็นตัวเล็กห้อยไว้ —
          เจ้าหน้าที่ที่ไม่ได้เรียนคอมพิวเตอร์อ่าน "EditUI" แล้วไม่รู้ว่าคืออะไร
          แต่ชื่อเดิมยังต้องอยู่ เพราะเป็นชื่อที่ใช้เรียกกันในทีมแล้ว
        */}
        <div className="flex border-b border-gray-100">
          {(
            [
              ["ui", "แก้บนหน้าเว็บ", "EditUI", MousePointerClick, "คลิกที่ข้อความบนหน้าเว็บแล้วพิมพ์ทับได้เลย"],
              ["code", "แก้เป็นโค้ด", "EditCode", Code2, "พิมพ์ HTML เอง สำหรับคนที่อ่านโค้ดออก"],
            ] as const
          ).map(([key, label, tag, Icon, hint]) => (
            <button
              key={key}
              onClick={() => changeMode(key)}
              title={hint}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm transition ${
                mode === key
                  ? "border-b-2 border-brand-500 font-medium text-brand-700"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              <span className="text-[10px] font-normal text-gray-400">{tag}</span>
            </button>
          ))}
        </div>

        {/* บอกวิธีใช้ตั้งแต่บรรทัดแรก ไม่ต้องให้เดาเอาเองว่าคลิกตรงไหนได้บ้าง */}
        {mode === "ui" && (
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-gray-100 bg-brand-50/60 px-4 py-2 text-xs text-brand-900">
            <span>คลิกที่ตัวหนังสือแล้วพิมพ์ทับได้เลย</span>
            <span>ชี้ที่เนื้อหาจะมีปุ่มย้าย/ลบขึ้นมาด้านบน</span>
            <span>เพิ่มของใหม่ที่ปุ่ม “เพิ่มเนื้อหา” ล่างสุด</span>
            <span className="font-semibold">แก้เสร็จต้องกดบันทึกด้วย</span>
          </p>
        )}

        {mode === "ui" && (
          <VisualEditor value={content} onChange={setContent} folder={assetFolder} />
        )}

        {mode === "code" && (
          <>
            <ContentToolbar
              textarea={textarea}
              value={content}
              onChange={setContent}
              folder={assetFolder}
            />
            <textarea
              ref={textarea}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={16}
              placeholder="พิมพ์เนื้อหาที่นี่ ใส่แท็ก HTML ได้ เช่น <h2>หัวข้อ</h2> <p>ย่อหน้า</p>"
              // สูงตามจอ (หักหัวเว็บกับแถบปุ่มออก) — จอใหญ่จะได้ใช้พื้นที่คุ้ม ไม่ใช่ช่องเตี้ย ๆ กลางจอโล่ง
              className="min-h-[60vh] w-full resize-y p-4 font-mono text-sm leading-relaxed outline-none"
            />
          </>
        )}

        {/*
          เตือนเมื่อโครงสร้างเพี้ยน — </div> เกินหรือแท็บหลุดออกนอกกล่อง
          อาการนี้หน้าเว็บจะดูเหมือนพัง (ปุ่มแท็บขึ้นไม่ครบ เนื้อหากองใต้หน้า)
          แต่ในช่องพิมพ์ดูปกติ ถ้าไม่บอกไว้ตรงนี้จะไม่มีทางรู้จนกว่าจะเปิดหน้าเว็บจริง
        */}
        {problems.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            <span>โครงสร้างเนื้อหาเพี้ยน: {problems.join(" · ")}</span>
            <button
              type="button"
              onClick={() => {
                setContent(repairStructure(content));
                setStatus({
                  kind: "ok",
                  text: "ซ่อมโครงสร้างให้แล้ว — ข้อความเหมือนเดิมทุกตัวอักษร ตรวจแล้วกดบันทึกด้วย",
                });
              }}
              className="ml-auto rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700"
            >
              ซ่อมโครงสร้างให้
            </button>
          </div>
        )}
      </Section>

      {/* ---------- 3 · ที่เก็บไฟล์และการจัดกลุ่ม ---------- */}
      <Section
        step={3}
        icon={FolderTree}
        title="ที่เก็บไฟล์และการจัดกลุ่ม"
        desc="ตั้งครั้งเดียวตอนสร้างหน้า — ไม่มีผลกับหน้าตาของหน้าเว็บ"
      >
        <details className="group">
          <summary className="cursor-pointer text-sm text-brand-700 transition hover:text-brand-800">
            <span className="group-open:hidden">
              เปิดดู — หมวด “{category || "จัดให้ตามที่อยู่หน้า"}” · โฟลเดอร์ assets/{assetFolder}
            </span>
            <span className="hidden group-open:inline">ย่อกลับ</span>
          </summary>

          <div className="mt-3 border-t border-gray-100 pt-3">
            {/* หมวดไว้จัดกลุ่มในรายการหลังบ้านให้หาเจอง่าย ไม่เกี่ยวกับลำดับหรือหน้าเว็บจริง */}
            <label className="block text-sm text-gray-600">
              หมวดในรายการหลังบ้าน
              <span className="ml-1 text-xs text-gray-400">
                (เว้นว่าง = จัดกลุ่มตามที่อยู่หน้าให้เอง · ไม่มีผลกับหน้าเว็บจริง)
              </span>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                list="page-categories"
                placeholder="เช่น ทำเนียบองค์กร, ระเบียบสหกรณ์"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-base outline-none focus:border-brand-500"
              />
              <datalist id="page-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>

            {/* ไฟล์ที่แนบในหน้านี้ไปอยู่โฟลเดอร์นี้ทั้งหมด — หาไฟล์ของแต่ละหน้าเจอง่ายเวลาเปิดดูใน FTP */}
            <label className="mt-3 block text-sm text-gray-600">
              โฟลเดอร์เก็บไฟล์ของหน้านี้
              <span className="ml-1 text-xs text-gray-400">
                (รูปและ PDF ที่แนบในหน้านี้จะไปอยู่ใน assets/{assetFolder || "pages/…"})
              </span>
              <div className="mt-1 flex items-center gap-2">
                <span className="shrink-0 rounded-lg bg-gray-100 px-2.5 py-2 font-mono text-sm text-gray-500">
                  assets/pages/
                </span>
                <input
                  value={assetFolder.replace(/^pages\//, "")}
                  onChange={(e) => setAssetFolder(`pages/${e.target.value.replace(/^pages\//, "")}`)}
                  placeholder="ชื่อโฟลเดอร์ เช่น about-history"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm outline-none focus:border-brand-500"
                />
              </div>
              <span className="mt-1 block text-xs text-gray-400">
                ใช้ a-z 0-9 และขีดกลางเท่านั้น · เว้นว่างหรือพิมพ์ผิดรูปแบบ ระบบจะตั้งให้จากที่อยู่หน้าเอง
              </span>
            </label>
          </div>
        </details>
      </Section>

      {/* ---------- 4 · AI ช่วยจัดรูปแบบ ---------- */}
      {aiReady && (
        <Section
          step={4}
          icon={Sparkles}
          title="ให้ AI ช่วยจัดรูปแบบ"
          desc="จัดโครงให้อย่างเดียว ไม่แก้ถ้อยคำ — ทำงานตอนกดบันทึก"
        >
          <div
            className={`rounded-xl px-3 py-2.5 ring-1 transition ${
              autoFormat ? "bg-brand-50/70 ring-brand-100" : "bg-gray-50 ring-gray-200"
            }`}
          >
            <Toggle
              checked={autoFormat}
              onChange={changeAutoFormat}
              label="ให้ AI จัดรูปแบบให้ตอนบันทึก"
              hint="จัดย่อหน้า หัวข้อ รายการ และลบแท็กขยะที่ติดมาจาก Word — จัดโครงอย่างเดียว ไม่แก้ถ้อยคำ · ไม่ถูกใจกดย้อนกลับได้"
            />

            <p className="mt-2 pl-11 text-xs text-gray-500">
              <Sparkles className="mr-1 inline h-3.5 w-3.5 text-brand-500" />
              {autoFormat
                ? "เปิดอยู่ — เหมาะกับตอนวางข้อความดิบจาก Word ครั้งแรก"
                : "ปิดอยู่ — บันทึกเนื้อหาตามที่พิมพ์ทุกตัวอักษร"}
              {" · "}
              ระบบจำค่านี้ไว้ให้ เปิดหน้าอื่นก็ยังเป็นแบบเดียวกัน
            </p>

            {autoFormat && hasStructure && (
              <p className="mt-1.5 pl-11 text-xs font-medium text-amber-700">
                หน้านี้มีแท็ปเมนู/รูปที่จัดวางไว้แล้ว — ถ้า AI ทำโครงหาย ระบบจะไม่รับผลนั้น
                แต่ถ้าจัดโครงเสร็จแล้วปิดสวิตช์ไว้จะชัวร์กว่า
              </p>
            )}
          </div>
        </Section>
      )}

      {/* ---------- 5 · เผยแพร่และบันทึก ---------- */}
      <Section
        step={aiReady ? 5 : 4}
        icon={Save}
        title="เผยแพร่และบันทึก"
        desc="หน้านี้ไม่ได้บันทึกให้เอง — แก้เสร็จต้องกดบันทึกทุกครั้ง"
      >
        <label className="flex items-center gap-2.5 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          เผยแพร่หน้านี้บนเว็บไซต์
          <span className="text-xs text-gray-400">(ไม่ติ๊ก = เก็บเป็นฉบับร่าง คนนอกไม่เห็น)</span>
        </label>

        {status && (
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-sm ${
              status.kind === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            }`}
          >
            {status.text}
          </p>
        )}

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={save}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {formatting ? "AI กำลังจัดรูปแบบ… (ไม่เกิน 1 นาที)" : busy ? "กำลังบันทึก…" : "บันทึก"}
          </button>
          {beforeAi !== null && (
            <button
              onClick={undoAi}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm text-gray-600 ring-1 ring-gray-200 transition hover:text-gray-900 disabled:opacity-60"
            >
              <Undo2 className="h-4 w-4" /> ย้อนกลับก่อน AI จัด
            </button>
          )}
          <button
            onClick={remove}
            disabled={busy}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-red-600 transition hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" /> ลบหน้านี้
          </button>
        </div>
      </Section>

      {/*
        แถบติดล่างจอ — โผล่เมื่อมีที่แก้ไว้แล้วยังไม่ได้บันทึก
        พิมพ์อยู่กลางหน้าที่ยาว ๆ แล้วปุ่มบันทึกอยู่ล่างสุดจนมองไม่เห็น คือทางที่งานหาย
        (หน้าสไลด์บันทึกให้เอง หน้านี้ไม่ — ความต่างตรงนี้ต้องเห็นชัด ไม่ใช่ให้จำเอา)
      */}
      {dirty && (
        <div className="sticky bottom-3 z-30 flex flex-wrap items-center gap-3 rounded-xl bg-gray-900/95 px-4 py-3 text-sm text-white shadow-lg">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-300" />
          <span className="min-w-0 flex-1">
            แก้ไว้แล้วแต่ <b>ยังไม่ได้บันทึก</b> — ปิดหน้านี้ตอนนี้สิ่งที่แก้จะหาย
          </span>
          <button
            onClick={save}
            disabled={busy}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 font-medium text-white transition hover:bg-brand-400 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            บันทึกเลย
          </button>
        </div>
      )}
    </div>
  );
}
