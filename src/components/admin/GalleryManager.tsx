"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Eye, EyeOff, ImagePlus, Pencil, Trash2, X } from "lucide-react";
import ThaiDatePicker from "@/components/admin/ThaiDatePicker";
import { uploadWithProgress } from "@/lib/uploadClient";
import {
  ALBUM_HOSTS,
  GALLERY_FOLDER,
  GALLERY_MAX_EDGE,
  albumDateLabel,
  cleanAlbumUrl,
  dateValue,
  fiscalYearOf,
} from "@/lib/galleryShared";
import type { GalleryAlbumView } from "@/lib/gallery";

type Draft = {
  albumUrl: string;
  coverUrl: string;
  title: string;
  eventDate: string;
  place: string;
  caption: string;
  photoCount: string;
  published: boolean;
};

const EMPTY: Draft = {
  albumUrl: "",
  coverUrl: "",
  title: "",
  eventDate: "",
  place: "",
  caption: "",
  photoCount: "",
  published: true,
};

const fromAlbum = (a: GalleryAlbumView): Draft => ({
  albumUrl: a.albumUrl,
  coverUrl: a.coverUrl,
  title: a.title,
  eventDate: dateValue(a.eventDate),
  place: a.place ?? "",
  caption: a.caption ?? "",
  photoCount: a.photoCount ? String(a.photoCount) : "",
  published: a.published,
});

const input =
  "min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

/**
 * หลังบ้าน → ภาพกิจกรรม
 *
 * ฟอร์มเรียงตามลำดับที่ทำจริง: วางลิงก์อัลบั้ม → อัปภาพเด่น 1 ภาพ → กรอกรายละเอียด → บันทึก
 * ฟอร์มเดียวใช้ทั้งเพิ่มใหม่และแก้ของเดิม (กดดินสอที่รายการแล้วฟอร์มเปลี่ยนเป็นโหมดแก้)
 */
export default function GalleryManager({ items }: { items: GalleryAlbumView[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [uploading, setUploading] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const set = (next: Partial<Draft>) => setDraft((d) => ({ ...d, ...next }));
  const linkOk = draft.albumUrl.trim() === "" || cleanAlbumUrl(draft.albumUrl) !== null;
  const ready =
    cleanAlbumUrl(draft.albumUrl) !== null &&
    draft.coverUrl !== "" &&
    draft.title.trim() !== "" &&
    draft.eventDate !== "";

  async function upload(file: File) {
    setStatus(null);
    setUploading(0);
    const form = new FormData();
    form.append("file", file);
    form.append("folder", GALLERY_FOLDER);
    form.append("maxEdge", String(GALLERY_MAX_EDGE));
    const result = await uploadWithProgress<{ url: string }>("/api/admin/upload/", form, (p) =>
      setUploading(p),
    );
    setUploading(null);
    if (!result.ok) {
      setStatus({ kind: "error", text: result.error });
      return;
    }
    set({ coverUrl: result.data.url });
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    const res = await fetch(editing ? `/api/admin/gallery/${editing}/` : "/api/admin/gallery/", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    }).catch(() => null);
    setSaving(false);
    const data = (await res?.json().catch(() => ({}))) as { error?: string };
    if (!res?.ok) {
      setStatus({ kind: "error", text: data.error ?? "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" });
      return;
    }
    setStatus({ kind: "ok", text: editing ? "บันทึกการแก้ไขแล้ว" : "เพิ่มอัลบั้มแล้ว" });
    setDraft(EMPTY);
    setEditing(null);
    router.refresh();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/gallery/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (!res?.ok) setStatus({ kind: "error", text: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" });
    router.refresh();
  }

  async function remove(a: GalleryAlbumView) {
    if (!window.confirm(`ลบอัลบั้ม “${a.title}” ออกจากหน้าเว็บ?\n(อัลบั้มเต็มบน Google ไม่ถูกลบ)`)) return;
    const res = await fetch(`/api/admin/gallery/${a.id}/`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) setStatus({ kind: "error", text: "ลบไม่สำเร็จ ลองใหม่อีกครั้ง" });
    if (editing === a.id) {
      setEditing(null);
      setDraft(EMPTY);
    }
    router.refresh();
  }

  function startEdit(a: GalleryAlbumView) {
    setEditing(a.id);
    setDraft(fromAlbum(a));
    setStatus(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // จัดกลุ่มตามปีบัญชี ให้เห็นว่าอัลบั้มไปขึ้นหน้าปีไหน
  const groups = new Map<number, GalleryAlbumView[]>();
  for (const a of items) {
    const fy = fiscalYearOf(new Date(a.eventDate));
    groups.set(fy, [...(groups.get(fy) ?? []), a]);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-bold text-gray-800">{editing ? "แก้ไขอัลบั้ม" : "เพิ่มอัลบั้มใหม่"}</h2>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setDraft(EMPTY);
              }}
              className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm text-gray-600 hover:bg-gray-100"
            >
              <X className="h-4 w-4" /> ยกเลิกการแก้ไข
            </button>
          )}
        </div>

        <div className="space-y-5">
          <div>
            <label htmlFor="g-link" className="mb-1.5 block text-sm font-semibold text-gray-700">
              1. ลิงก์อัลบั้มเต็ม
            </label>
            <input
              id="g-link"
              value={draft.albumUrl}
              onChange={(e) => set({ albumUrl: e.target.value })}
              placeholder="https://photos.app.goo.gl/…"
              className={`${input} ${linkOk ? "" : "border-red-400 focus:border-red-500 focus:ring-red-100"}`}
            />
            <p className={`mt-1 text-xs ${linkOk ? "text-gray-500" : "text-red-600"}`}>
              {linkOk
                ? "Google Photos · Google Drive · Facebook — ตั้งอัลบั้มเป็น “ทุกคนที่มีลิงก์ดูได้” ก่อน ไม่งั้นสมาชิกกดแล้วเจอหน้าขอสิทธิ์"
                : `ใช้ได้เฉพาะลิงก์ https:// ของ ${ALBUM_HOSTS.filter((h) => !h.includes("www.") && !h.startsWith("m.") && !h.startsWith("web.")).join(" · ")}`}
            </p>
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">2. ภาพเด่น 1 ภาพ</span>
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative grid aspect-[4/3] w-48 place-items-center overflow-hidden rounded-xl bg-brand-50 ring-1 ring-brand-100">
                {draft.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={draft.coverUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus className="h-8 w-8 text-brand-300" aria-hidden="true" />
                )}
                {uploading !== null && (
                  <span className="absolute inset-0 grid place-items-center bg-white/80 text-sm font-semibold text-brand-700">
                    กำลังอัป {uploading}%
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
                  <ImagePlus className="h-4 w-4" />
                  {draft.coverUrl ? "เปลี่ยนภาพ" : "เลือกภาพ"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={uploading !== null}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void upload(file);
                    }}
                  />
                </label>
                <p className="text-xs text-gray-500">
                  ย่อให้เองเหลือด้านยาว {GALLERY_MAX_EDGE}px · หน้าเว็บตัดขอบให้เต็มกรอบ 4:3 — เลือกภาพที่จุดสำคัญอยู่กลางภาพ
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="g-title" className="mb-1.5 block text-sm font-semibold text-gray-700">
                3. เป็นภาพเกี่ยวกับอะไร
              </label>
              <input
                id="g-title"
                value={draft.title}
                onChange={(e) => set({ title: e.target.value })}
                placeholder="เช่น ประชุมใหญ่สามัญประจำปี 2570"
                className={input}
              />
            </div>
            <div>
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">4. วันไหน</span>
              <ThaiDatePicker value={draft.eventDate} onChange={(v) => set({ eventDate: v })} />
              {draft.eventDate && (
                <p className="mt-1 text-xs text-gray-500">
                  ขึ้นหน้าปีบัญชี {fiscalYearOf(new Date(`${draft.eventDate}T00:00:00+07:00`))}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="g-place" className="mb-1.5 block text-sm font-semibold text-gray-700">
                5. ที่ไหน
              </label>
              <input
                id="g-place"
                value={draft.place}
                onChange={(e) => set({ place: e.target.value })}
                placeholder="เช่น ห้องประชุมทวีสุข ชั้น 3"
                className={input}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="g-cap" className="mb-1.5 block text-sm font-semibold text-gray-700">
                6. รายละเอียดสั้น ๆ <span className="font-normal text-gray-400">(ไม่บังคับ)</span>
              </label>
              <textarea
                id="g-cap"
                rows={3}
                value={draft.caption}
                onChange={(e) => set({ caption: e.target.value })}
                placeholder="เช่น สมาชิกร่วมประชุม · มอบรางวัลสมาชิกดีเด่น"
                className={`${input} py-2`}
              />
            </div>
            <div>
              <label htmlFor="g-count" className="mb-1.5 block text-sm font-semibold text-gray-700">
                จำนวนภาพในอัลบั้ม <span className="font-normal text-gray-400">(ไม่บังคับ)</span>
              </label>
              <input
                id="g-count"
                inputMode="numeric"
                value={draft.photoCount}
                onChange={(e) => set({ photoCount: e.target.value.replace(/\D/g, "").slice(0, 5) })}
                className={input}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 pt-4">
            <label className="mr-auto inline-flex min-h-11 items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={draft.published}
                onChange={(e) => set({ published: e.target.checked })}
                className="h-5 w-5"
              />
              เผยแพร่บนหน้าเว็บ
            </label>
            {status && (
              <span className={`text-sm ${status.kind === "ok" ? "text-emerald-700" : "text-red-600"}`}>
                {status.text}
              </span>
            )}
            <button
              type="button"
              onClick={() => void save()}
              disabled={!ready || saving || uploading !== null}
              className="inline-flex min-h-11 items-center rounded-full bg-brand-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {saving ? "กำลังบันทึก…" : editing ? "บันทึกการแก้ไข" : "บันทึกอัลบั้ม"}
            </button>
          </div>
        </div>
      </section>

      {items.length === 0 ? (
        <p className="rounded-2xl bg-white px-5 py-10 text-center text-sm text-gray-500 ring-1 ring-black/5">
          ยังไม่มีอัลบั้ม — เพิ่มอัลบั้มแรกจากฟอร์มด้านบน
        </p>
      ) : (
        [...groups.entries()].map(([fy, list]) => (
          <section key={fy}>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-700">
              ปีบัญชี {fy}
              <span className="font-normal text-gray-400">{list.length} อัลบั้ม</span>
              <a
                href={`/gallery/${fy}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-xs font-normal text-brand-700 hover:underline"
              >
                ดูหน้าเว็บ <ExternalLink className="h-3 w-3" />
              </a>
            </h2>
            <ul className="grid grid-cols-1 gap-2">
              {list.map((a) => (
                <li
                  key={a.id}
                  className={`flex min-w-0 items-center gap-3 rounded-xl bg-white p-2 pr-3 ring-1 ${
                    editing === a.id ? "ring-2 ring-brand-400" : "ring-black/5"
                  } ${a.published ? "" : "opacity-60"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.coverUrl} alt="" className="h-14 w-20 shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-800">{a.title}</p>
                    <p className="truncate text-xs text-gray-500">
                      {albumDateLabel(new Date(a.eventDate))}
                      {a.place ? ` · ${a.place}` : ""}
                      {a.published ? "" : " · ซ่อนอยู่"}
                    </p>
                  </div>
                  <a
                    href={a.albumUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="เปิดอัลบั้มเต็ม"
                    title="เปิดอัลบั้มเต็ม"
                    className="grid h-11 w-11 place-items-center rounded-full text-gray-500 hover:bg-gray-100"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => void patch(a.id, { published: !a.published })}
                    aria-label={a.published ? "ซ่อนจากหน้าเว็บ" : "เผยแพร่"}
                    title={a.published ? "ซ่อนจากหน้าเว็บ" : "เผยแพร่"}
                    className="grid h-11 w-11 place-items-center rounded-full text-gray-500 hover:bg-gray-100"
                  >
                    {a.published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(a)}
                    aria-label="แก้ไข"
                    title="แก้ไข"
                    className="grid h-11 w-11 place-items-center rounded-full text-gray-500 hover:bg-gray-100"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(a)}
                    aria-label="ลบ"
                    title="ลบ"
                    className="grid h-11 w-11 place-items-center rounded-full text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
