"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2, Loader2, Eye, Pencil, Sparkles, Undo2 } from "lucide-react";
import ContentToolbar from "@/components/admin/ContentToolbar";
import PageContent from "@/components/site/PageContent";
import { localAssetsInHtml } from "@/lib/assetFallback";
import Toggle from "@/components/ui/Toggle";

/** จำสวิตช์ AI ไว้ในเครื่องคนใช้ ไม่ใช่ในฐาน — เป็นความชอบส่วนตัวของแต่ละคน ไม่ใช่ค่าของเว็บ */
const AI_FORMAT_KEY = "spsc_page_ai_format";

type Props = {
  page: {
    id: string;
    slug: string;
    title: string;
    body: string;
    published: boolean;
    /** โฟลเดอร์เก็บไฟล์แนบของหน้านี้ใต้ assets/ */
    assetFolder: string;
  };
  /** ตั้งคีย์ AI ไว้ไหม — ไม่ได้ตั้งก็ซ่อนสวิตช์จัดรูปแบบไปเลย */
  aiReady?: boolean;
  /** ค่าสวิตช์ AI ที่ผู้ใช้เลือกไว้ครั้งก่อน (อ่านจาก cookie ฝั่งเซิร์ฟเวอร์) */
  aiFormatDefault?: boolean;
};

export default function PageEditor({ page, aiReady = false, aiFormatDefault = true }: Props) {
  const router = useRouter();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState(page.title);
  const [slug, setSlug] = useState(page.slug);
  const [assetFolder, setAssetFolder] = useState(page.assetFolder);
  const [content, setContent] = useState(page.body);
  const [published, setPublished] = useState(page.published);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  /** กำลังรอ AI อยู่ — ใช้เปลี่ยนข้อความบนปุ่มและกันปิดหน้าไปก่อนบันทึกเสร็จ */
  const [formatting, setFormatting] = useState(false);
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
    // เก็บไว้ 1 ปี — เป็นความชอบของคนใช้ ไม่ใช่ค่าของเว็บ จึงไม่เก็บลงฐาน
    document.cookie = `${AI_FORMAT_KEY}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  };

  /** เนื้อหามีโครงที่ AI อาจไปยุ่ง — เตือนไว้ก่อนกดบันทึก */
  const hasStructure = /class="(tabs|tab|image-row|ebook)"|<img|<figure/i.test(content);
  /** เนื้อหาก่อน AI จัด — เก็บไว้ให้กดย้อนกลับได้ถ้าไม่ถูกใจ */
  const [beforeAi, setBeforeAi] = useState<string | null>(null);

  /**
   * กันปิดแท็บ/กดย้อนกลับระหว่างกำลังบันทึก — งานที่ให้ AI จัดใช้เวลาถึงเกือบนาที
   * ปิดหน้าไปตอนนั้นคือเสียทั้งรูปที่เพิ่งแทรกและที่พิมพ์ค้างไว้
   */
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

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

    const response = await fetch(`/api/admin/pages/${page.id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, slug, content: body, published, assetFolder }),
    });
    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      setStatus({ kind: "ok", text: `บันทึกแล้ว${note}` });
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
      body: JSON.stringify({ title, slug, content: beforeAi, published, assetFolder }),
    });
    setBeforeAi(null);
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
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
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
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm outline-none focus:border-brand-500"
          />
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

        <label className="mt-4 flex items-center gap-2.5 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          เผยแพร่หน้านี้บนเว็บไซต์
          <span className="text-xs text-gray-400">(ไม่ติ๊ก = เก็บเป็นฉบับร่าง คนนอกไม่เห็น)</span>
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <div className="flex border-b border-gray-100">
          {(
            [
              ["edit", "แก้ไข", Pencil],
              ["preview", "ดูตัวอย่าง", Eye],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm transition ${
                tab === key
                  ? "border-b-2 border-brand-500 font-medium text-brand-700"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        {tab === "edit" ? (
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
        ) : (
          /*
           * ใช้คอมโพเนนต์ตัวเดียวกับหน้าเว็บจริง — เดิมพรีวิววาด HTML ดิบ ๆ
           * แท็ปเมนูจึงไม่ขึ้นเป็นแท็บให้กด เห็นเป็นก้อนเรียงกันเฉย ๆ ไม่ตรงกับของจริง
           */
          <PageContent html={localAssetsInHtml(content)} className="min-h-[60vh] p-4" />
        )}
      </div>

      {status && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            status.kind === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {status.text}
        </p>
      )}

      {aiReady && (
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
      )}

      <div className="flex items-center gap-2">
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
    </div>
  );
}
