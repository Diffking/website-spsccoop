"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  Save,
  X,
  Sparkles,
  FileUp,
  FileText,
  ExternalLink,
} from "lucide-react";
import {
  KINDS,
  KIND_FOLDER,
  KIND_LABEL,
  KIND_PREFIX,
  announcementLine,
  type Kind,
} from "@/lib/announcementKinds";

export type AnnouncementRow = {
  id: string;
  number: string;
  title: string;
  kind: Kind;
  /** ป้ายพิเศษหน้าหัวข้อ เช่น "ด่วน" — ว่าง = ไม่ติดป้าย */
  badge: string | null;
  publishedAt: string; // YYYY-MM-DD
  fileUrl: string | null;
  published: boolean;
};

const empty = {
  number: "",
  title: "",
  publishedAt: "",
  fileUrl: "",
  kind: "ANNOUNCEMENT" as Kind,
  badge: "",
};

/** คำที่ใช้บ่อย — กดแล้วเติมให้ ไม่ได้บังคับ พิมพ์เองก็ได้ */
const BADGE_PRESETS = ["ด่วน", "ใหม่", "สำคัญ", "ขยายเวลา", "แก้ไข"];

/** วันที่แบบไทย เช่น 30 มิ.ย. 2569 */
function thaiDate(iso: string): string {
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${months[m - 1]} ${y + 543}`;
}

export default function AnnouncementsManager({
  items,
  aiReady,
}: {
  items: AnnouncementRow[];
  aiReady: boolean;
}) {
  const router = useRouter();
  const filePicker = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<"" | "upload" | "ai">("");
  const [note, setNote] = useState("");
  /** แท็บที่กำลังดู — เพิ่มรายการใหม่จะเข้าหมวดนี้ให้เลย ไม่ต้องมาเลือกซ้ำ */
  const [tab, setTab] = useState<Kind>("ANNOUNCEMENT");
  const [form, setForm] = useState(empty);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function send(url: string, method: string, body?: unknown) {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "ดำเนินการไม่สำเร็จ");
      return false;
    }
    setError("");
    return true;
  }

  /**
   * อัปไฟล์ประกาศ (PDF หรือรูป) แล้วให้ AI อ่านต่อทันที — แบบเดียวกับแบนเนอร์สไลด์
   * AI เติมให้เฉพาะช่องที่ยังว่าง จะได้ไม่ทับสิ่งที่เจ้าหน้าที่พิมพ์ไว้เองแล้ว
   */
  async function handleFile(file: File) {
    setError("");
    setNote("");
    setUploading("upload");

    const upload = new FormData();
    upload.append("file", file);
    // แยกโฟลเดอร์ตามหมวด จะได้หาไฟล์เจอเวลาเข้าไปดูใน FTP ตรง ๆ
    upload.append("folder", KIND_FOLDER[form.kind]);
    const uploaded = await fetch("/api/admin/upload/", { method: "POST", body: upload });
    const uploadData = await uploaded.json().catch(() => ({}));

    if (!uploaded.ok) {
      setUploading("");
      setError(uploadData.error ?? "อัปโหลดไม่สำเร็จ");
      return;
    }
    setForm((f) => ({ ...f, fileUrl: uploadData.url }));
    setNote(`แนบไฟล์แล้ว · ${(uploadData.storedBytes / 1024).toFixed(0)} KB`);

    if (!aiReady) {
      setUploading("");
      return;
    }

    setUploading("ai");
    const read = new FormData();
    read.append("file", file);
    read.append("target", "announcement");
    const response = await fetch("/api/admin/ai/read-image/", { method: "POST", body: read });
    const data = await response.json().catch(() => ({}));
    setUploading("");

    if (!response.ok) {
      setError(data.error ?? "AI อ่านไฟล์ไม่สำเร็จ — กรอกเองได้");
      return;
    }
    const draft = data.data as { number?: string; title?: string; publishedAt?: string } | undefined;
    setForm((f) => ({
      ...f,
      number: f.number.trim() || (draft?.number ?? ""),
      title: f.title.trim() || (draft?.title ?? ""),
      publishedAt: f.publishedAt || (draft?.publishedAt ?? ""),
    }));
    const missing = [
      !draft?.number && "เลขที่",
      !draft?.publishedAt && "วันที่",
    ].filter(Boolean);
    setNote(
      missing.length > 0
        ? `AI อ่านให้แล้ว แต่ในเอกสารไม่ได้ระบุ${missing.join("และ")} — ใส่เองด้วย`
        : "AI อ่านให้แล้ว — ตรวจให้ครบก่อนกดบันทึก",
    );
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy("add");
    if (await send("/api/admin/announcements/", "POST", form)) {
      setForm(empty);
      setAdding(false);
      setNote("");
      router.refresh();
    }
    setBusy("");
  }

  async function saveEdit(id: string) {
    setBusy(id);
    if (await send(`/api/admin/announcements/${id}/`, "PATCH", form)) {
      setEditingId("");
      setForm(empty);
      router.refresh();
    }
    setBusy("");
  }

  async function toggle(item: AnnouncementRow) {
    setBusy(item.id);
    await send(`/api/admin/announcements/${item.id}/`, "PATCH", { published: !item.published });
    setBusy("");
    router.refresh();
  }

  async function remove(item: AnnouncementRow) {
    if (!confirm(`ลบ${KIND_PREFIX[item.kind]} ${item.number} "${item.title}" ?`)) return;
    setBusy(item.id);
    await send(`/api/admin/announcements/${item.id}/`, "DELETE");
    setBusy("");
    router.refresh();
  }

  const shown = items.filter((i) => i.kind === tab);

  const fields = (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setForm((f) => ({ ...f, kind: k }))}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              form.kind === k
                ? "bg-brand-600 text-white shadow"
                : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
            }`}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={form.number}
          onChange={(e) => setForm({ ...form, number: e.target.value })}
          placeholder="เลขที่ เช่น 19/2569"
          className="w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        <input
          type="date"
          value={form.publishedAt}
          onChange={(e) => setForm({ ...form, publishedAt: e.target.value })}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
      </div>
      <input
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        placeholder={`ชื่อเรื่อง${KIND_LABEL[form.kind]}`}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
      />

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={form.badge}
            onChange={(e) => setForm({ ...form, badge: e.target.value })}
            maxLength={16}
            placeholder="ป้ายพิเศษ (เว้นว่าง = ไม่ติดป้าย)"
            className="w-56 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
          {form.badge.trim() ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
              ตัวอย่าง
              <span className="rounded-full bg-accent-red px-2 py-0.5 text-[11px] font-bold text-white">
                {form.badge}
              </span>
            </span>
          ) : (
            BADGE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setForm({ ...form, badge: preset })}
                className="rounded-full bg-white px-2.5 py-1 text-xs text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-50"
              >
                {preset}
              </button>
            ))
          )}
          {form.badge.trim() && (
            <button
              type="button"
              onClick={() => setForm({ ...form, badge: "" })}
              className="rounded-lg p-1 text-gray-400 transition hover:text-red-500"
              title="เอาป้ายออก"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-400">
          ป้ายนี้ขึ้นหน้าหัวข้อในการ์ดหน้าแรก — คนละอันกับป้ายในข่าววิ่ง
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-gray-300 p-3">
        <input
          ref={filePicker}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => filePicker.current?.click()}
            disabled={uploading !== ""}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-60"
          >
            {uploading !== "" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : aiReady ? (
              <Sparkles className="h-4 w-4" />
            ) : (
              <FileUp className="h-4 w-4" />
            )}
            {uploading === "upload"
              ? "กำลังอัปโหลด..."
              : uploading === "ai"
                ? "AI กำลังอ่านเอกสาร..."
                : "อัปไฟล์ประกาศ (PDF)"}
          </button>
          <span className="text-xs text-gray-500">
            {aiReady
              ? "อัปแล้ว AI จะอ่านเลขที่ ชื่อเรื่อง และวันที่ให้ — ตรวจก่อนบันทึกเสมอ"
              : "แนบไฟล์ให้สมาชิกกดอ่านฉบับเต็มจากหน้าแรกได้"}
          </span>
        </div>

        {note && <p className="mt-2 text-xs text-emerald-600">{note}</p>}

        {form.fileUrl && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
            <FileText className="h-3.5 w-3.5 shrink-0 text-brand-500" />
            <a
              href={form.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1 truncate hover:text-brand-600 hover:underline"
            >
              {form.fileUrl}
            </a>
            <button
              type="button"
              onClick={() => {
                setForm((f) => ({ ...f, fileUrl: "" }));
                setNote("");
              }}
              className="shrink-0 rounded p-0.5 text-gray-400 transition hover:text-red-500"
              title="เอาไฟล์ออก"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </p>
        )}
      </div>

      <input
        value={form.fileUrl}
        onChange={(e) => setForm({ ...form, fileUrl: e.target.value })}
        placeholder="หรือวางลิงก์ไฟล์เอง (เว้นว่างได้)"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs outline-none focus:border-brand-500"
      />
    </div>
  );

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <h2 className="font-semibold text-gray-800">ประกาศ / จดหมายข่าว / รายงานกิจการ</h2>
      <p className="mt-0.5 text-xs text-gray-500">
        สามหมวดนี้ขึ้นเป็นสามแท็บบนการ์ดหน้าแรก และถูกดึงไปวิ่งในข่าววิ่งด้วย
      </p>

      {/* แท็บกรอง — ตัวเลขคือจำนวนที่มีในหมวดนั้น */}
      <div className="mt-3 flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k}
            onClick={() => {
              setTab(k);
              setEditingId("");
              setAdding(false);
              setForm({ ...empty, kind: k });
            }}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${
              tab === k ? "bg-brand-500 text-white shadow" : "bg-brand-50 text-brand-600 hover:bg-brand-100"
            }`}
          >
            {KIND_LABEL[k]}
            <span
              className={`rounded-full px-1.5 text-xs tabular-nums ${
                tab === k ? "bg-white/25" : "bg-white/70 text-brand-500"
              }`}
            >
              {items.filter((i) => i.kind === k).length}
            </span>
          </button>
        ))}
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {adding ? (
        <form onSubmit={create} className="mt-3 rounded-xl bg-gray-50 p-3">
          {fields}
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={busy === "add"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {busy === "add" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              เพิ่ม{KIND_LABEL[form.kind]}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setForm(empty);
              }}
              className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
            >
              ยกเลิก
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => {
            setAdding(true);
            setForm({ ...empty, kind: tab });
            setEditingId("");
          }}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> เพิ่ม{KIND_LABEL[tab]}
        </button>
      )}

      <ul className="mt-3 divide-y divide-gray-100">
        {shown.length === 0 && (
          <li className="py-6 text-center text-sm text-gray-400">ยังไม่มี{KIND_LABEL[tab]}</li>
        )}
        {shown.map((item) =>
          editingId === item.id ? (
            <li key={item.id} className="py-3">
              <div className="rounded-xl bg-gray-50 p-3">
                {fields}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => saveEdit(item.id)}
                    disabled={busy === item.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {busy === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    บันทึก
                  </button>
                  <button
                    onClick={() => setEditingId("")}
                    className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
                  >
                    <X className="h-4 w-4" /> ยกเลิก
                  </button>
                </div>
              </div>
            </li>
          ) : (
            <li key={item.id} className="flex items-start gap-2 py-2.5">
              <button
                onClick={() => {
                  setEditingId(item.id);
                  setAdding(false);
                  setForm({
                    number: item.number,
                    title: item.title,
                    publishedAt: item.publishedAt,
                    fileUrl: item.fileUrl ?? "",
                    kind: item.kind,
                    badge: item.badge ?? "",
                  });
                }}
                className="min-w-0 flex-1 text-left"
              >
                <span
                  className={`block truncate text-sm ${
                    item.published ? "text-gray-700" : "text-gray-400 line-through"
                  }`}
                >
                  {item.badge && (
                    <span className="mr-1.5 inline-block rounded-full bg-accent-red px-2 py-0.5 align-middle text-[11px] font-bold text-white">
                      {item.badge}
                    </span>
                  )}
                  {announcementLine(item.kind, item.number, item.title)}
                </span>
                <span className="flex items-center gap-2 text-xs text-gray-400">
                  {thaiDate(item.publishedAt)}
                  {item.fileUrl && (
                    <span className="inline-flex items-center gap-1 text-brand-600">
                      <ExternalLink className="h-3 w-3" /> มีไฟล์แนบ
                    </span>
                  )}
                </span>
              </button>
              <button
                onClick={() => toggle(item)}
                disabled={busy === item.id}
                title={item.published ? "ซ่อนจากหน้าเว็บ" : "แสดงบนหน้าเว็บ"}
                className="shrink-0 rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
              >
                {item.published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
              <button
                onClick={() => remove(item)}
                disabled={busy === item.id}
                className="shrink-0 rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
