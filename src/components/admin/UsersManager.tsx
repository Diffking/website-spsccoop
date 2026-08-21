"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, Save, X, ShieldCheck, UserCheck, UserX, KeyRound, Eye, Unlink } from "lucide-react";
import AreaPicker from "@/components/admin/AreaPicker";
import { AREAS, pageAreaCategory } from "@/lib/permissions";

export type UserRow = {
  id: string;
  username: string;
  name: string;
  phone: string | null;
  role: "ADMIN" | "EDITOR";
  /** ส่วนของเว็บที่คนนี้ดูแล — ว่าง = ทั้งเว็บ (ดู src/lib/permissions.ts) */
  areas: string[];
  /** ตั้งรหัสผ่านเองแล้วหรือยัง — ยัง = ยังใช้เลข 4 ตัวท้ายเบอร์โทรอยู่ */
  ownPassword: boolean;
  /** ผูกบัญชี LINE แล้วหรือยัง — ผูกแล้ว = เข้าระบบด้วย LINE ไม่ใช่รหัสผ่าน */
  lineLinked: boolean;
  active: boolean;
  lastLoginAt: string | null;
};

const empty = {
  username: "",
  name: "",
  phone: "",
  role: "EDITOR" as "ADMIN" | "EDITOR",
  areas: [] as string[],
};

/** สรุปหน้าที่รับผิดชอบเป็นข้อความสั้น ๆ ให้อ่านจากรายการได้เลย ไม่ต้องกดเข้าไปดู */
function areaSummary(user: UserRow): string {
  if (user.role === "ADMIN") return "ผู้ดูแลระบบ — ทั้งเว็บ";
  if (user.areas.length === 0) return "ดูแลทั้งเว็บ";

  const labels = user.areas.map((key) => {
    const category = pageAreaCategory(key);
    if (category) return category;
    return AREAS.find((a) => a.key === key)?.label ?? key;
  });
  return labels.join(" · ");
}

export default function UsersManager({
  users,
  meId,
  pageCategories,
}: {
  users: UserRow[];
  meId: string;
  pageCategories: string[];
}) {
  const router = useRouter();
  const [form, setForm] = useState(empty);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function send(url: string, method: string, body?: unknown) {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error ?? "ดำเนินการไม่สำเร็จ");
      return null;
    }
    setError("");
    return data;
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy("add");
    const data = await send("/api/admin/users/", "POST", form);
    if (data) {
      setNotice(`เพิ่ม ${form.username} แล้ว — รหัสผ่านคือ ${data.password}`);
      setForm(empty);
      setAdding(false);
      router.refresh();
    }
    setBusy("");
  }

  async function saveEdit(id: string) {
    setBusy(id);
    const data = await send(`/api/admin/users/${id}/`, "PATCH", {
      name: form.name,
      phone: form.phone,
      role: form.role,
      areas: form.areas,
    });
    if (data) {
      setNotice(data.password ? `บันทึกแล้ว — รหัสผ่านใหม่คือ ${data.password}` : "บันทึกแล้ว");
      setEditingId("");
      setForm(empty);
      router.refresh();
    }
    setBusy("");
  }

  async function toggleActive(user: UserRow) {
    setBusy(user.id);
    await send(`/api/admin/users/${user.id}/`, "PATCH", { active: !user.active });
    setBusy("");
    router.refresh();
  }

  async function remove(user: UserRow) {
    if (!confirm(`ลบผู้ใช้ ${user.username} (${user.name}) ถาวร?`)) return;
    setBusy(user.id);
    await send(`/api/admin/users/${user.id}/`, "DELETE");
    setBusy("");
    router.refresh();
  }

  /**
   * เปิดหลังบ้านในมุมมองของคนนี้ — ดูว่าเขาเห็นเมนูอะไร เข้าหน้าไหนได้บ้าง
   * มุมมองนี้แก้อะไรไม่ได้เลย และหน้าผู้ใช้งานก็จะปิดตามไปด้วย (เขาไม่ใช่ ADMIN)
   * ออกจากมุมมองได้ที่แถบสีเหลืองด้านบน
   */
  /**
   * ตั้งรหัสใหม่จากเบอร์โทรให้คนที่ลืมรหัส
   *
   * ADMIN ตั้งรหัสให้คนอื่นโดยตรงไม่ได้ (จะได้ไม่มีใครรู้รหัสของคนอื่น) — ทำได้แค่
   * ดีดกลับไปเป็นรหัสตั้งต้น แล้วบอกเจ้าตัวไปตั้งใหม่เองที่เมนู "บัญชีของฉัน"
   */
  async function resetPassword(user: UserRow) {
    if (!confirm(`ตั้งรหัสใหม่ให้ ${user.name} เป็นเลข 4 ตัวท้ายเบอร์โทร?`)) return;
    setBusy(user.id);
    const data = await send(`/api/admin/users/${user.id}/`, "PATCH", { resetPassword: true });
    setBusy("");
    if (data?.password) {
      setNotice(`ตั้งรหัสใหม่ให้ ${user.username} แล้ว — รหัสคือ ${data.password} · บอกให้เจ้าตัวไปตั้งรหัสของตัวเองที่เมนู “บัญชีของฉัน”`);
      router.refresh();
    }
  }

  /*
   * ADMIN ปลดการผูก LINE ให้คนอื่น — ทางรอดเดียวเวลาเจ้าหน้าที่ทำบัญชี LINE หาย
   * หรือเปลี่ยนเบอร์จนเข้า LINE เดิมไม่ได้ ไม่งั้นจะเข้าระบบไม่ได้ตลอดไป
   * ปลดแล้วเขากลับไปเข้าด้วยรหัสผ่านได้ตามเดิม แล้วค่อยผูกใหม่เอง
   */
  async function unlinkLine(user: UserRow) {
    if (!confirm(`ปลดการผูก LINE ของ ${user.name}?
เขาจะกลับไปเข้าระบบด้วยรหัสผ่าน แล้วผูก LINE ใหม่เองได้`)) return;
    setBusy(user.id);
    const data = await send(`/api/admin/users/${user.id}/`, "PATCH", { unlinkLine: true });
    setBusy("");
    if (!data) return;
    setNotice(`ปลดการผูก LINE ของ ${user.username} แล้ว — บอกให้เขาเข้าด้วยรหัสผ่านแล้วไปผูกใหม่ที่เมนู “บัญชีของฉัน”`);
    router.refresh();
  }

  async function viewAs(user: UserRow) {
    setBusy(user.id);
    const data = await send("/api/admin/view-as/", "POST", { userId: user.id });
    setBusy("");
    if (!data) return;
    router.replace("/admin/");
    router.refresh();
  }

  const phoneHint = (() => {
    const digits = form.phone.replace(/\D/g, "");
    return digits.length >= 4 ? `รหัสผ่านจะเป็น ${digits.slice(-4)}` : "ใส่เบอร์ให้ครบเพื่อออกรหัสผ่าน";
  })();

  return (
    <div className="space-y-4">
      {notice && (
        <p className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice("")} className="shrink-0 text-emerald-600">
            <X className="h-4 w-4" />
          </button>
        </p>
      )}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {adding ? (
        <form onSubmit={create} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <p className="font-medium text-gray-800">เพิ่มผู้ใช้</p>
          <div className="mt-3 space-y-2">
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="รหัสผู้ใช้ เช่น 07337"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="ชื่อ-สกุล"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="เบอร์โทร เช่น 081-234-5678"
              inputMode="tel"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
            <p className="text-xs text-gray-500">{phoneHint}</p>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as "ADMIN" | "EDITOR" })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            >
              <option value="EDITOR">ผู้แก้ไขเนื้อหา</option>
              <option value="ADMIN">ผู้ดูแลระบบ (จัดการผู้ใช้ได้)</option>
            </select>
            {/* ผู้ดูแลระบบเข้าได้ทุกที่อยู่แล้ว ไม่ต้องมาเลือกส่วน */}
            {form.role === "EDITOR" && (
              <AreaPicker
                value={form.areas}
                onChange={(areas) => setForm({ ...form, areas })}
                pageCategories={pageCategories}
              />
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={busy === "add"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {busy === "add" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              เพิ่ม
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
            setForm(empty);
            setEditingId("");
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> เพิ่มผู้ใช้
        </button>
      )}

      <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        {users.map((user) =>
          editingId === user.id ? (
            <li key={user.id} className="space-y-2 p-4">
              <p className="font-mono text-sm text-gray-500">{user.username}</p>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="ชื่อ-สกุล"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="เบอร์โทร"
                inputMode="tel"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
              <p className="text-xs text-gray-500">{phoneHint}</p>
              {user.id !== meId && (
                <>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as "ADMIN" | "EDITOR" })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                  >
                    <option value="EDITOR">ผู้แก้ไขเนื้อหา</option>
                    <option value="ADMIN">ผู้ดูแลระบบ</option>
                  </select>
                  {form.role === "EDITOR" && (
                    <AreaPicker
                      value={form.areas}
                      onChange={(areas) => setForm({ ...form, areas })}
                      pageCategories={pageCategories}
                    />
                  )}
                </>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => saveEdit(user.id)}
                  disabled={busy === user.id}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {busy === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  บันทึก
                </button>
                <button
                  onClick={() => setEditingId("")}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
                >
                  <X className="h-4 w-4" /> ยกเลิก
                </button>
              </div>
            </li>
          ) : (
            <li key={user.id} className="flex items-center gap-2 px-4 py-3">
              <button
                onClick={() => {
                  setEditingId(user.id);
                  setAdding(false);
                  setForm({
                    username: user.username,
                    name: user.name,
                    phone: user.phone ?? "",
                    role: user.role,
                    areas: user.areas,
                  });
                }}
                className="min-w-0 flex-1 text-left"
              >
                <span className="flex items-center gap-1.5">
                  <span className={`truncate font-medium ${user.active ? "text-gray-800" : "text-gray-400"}`}>
                    {user.name}
                  </span>
                  {user.role === "ADMIN" && (
                    <ShieldCheck className="h-4 w-4 shrink-0 text-brand-500" aria-label="ผู้ดูแลระบบ" />
                  )}
                  {user.id === meId && <span className="shrink-0 text-xs text-gray-400">(คุณ)</span>}
                </span>
                <span className="block truncate font-mono text-xs text-gray-400">
                  {user.username} · {user.phone ?? "ยังไม่มีเบอร์"}
                </span>
                <span className="block truncate text-xs text-gray-500">{areaSummary(user)}</span>
                <span className="mt-0.5 flex flex-wrap gap-1">
                  {user.lineLinked ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-800 ring-1 ring-emerald-200">
                      <ShieldCheck className="h-3 w-3" /> เข้าระบบด้วย LINE
                    </span>
                  ) : (
                    !user.ownPassword && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800 ring-1 ring-amber-200">
                        <KeyRound className="h-3 w-3" /> ยังใช้รหัสตั้งต้นจากเบอร์โทร
                      </span>
                    )
                  )}
                </span>
              </button>

              {user.id !== meId && (
                <>
                  {user.lineLinked && (
                    <button
                      onClick={() => unlinkLine(user)}
                      disabled={busy === user.id}
                      title={`ปลดการผูก LINE ของ ${user.name} (ใช้ตอนเขาทำบัญชี LINE หาย)`}
                      className="shrink-0 rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                    >
                      <Unlink className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => resetPassword(user)}
                    disabled={busy === user.id}
                    title={`ตั้งรหัสใหม่จากเบอร์โทรให้ ${user.name} (ใช้ตอนเขาลืมรหัส)`}
                    className="shrink-0 rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                  >
                    <KeyRound className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => viewAs(user)}
                    disabled={busy === user.id}
                    title={`เปิดหลังบ้านในมุมมองของ ${user.name} — ดูอย่างเดียว`}
                    className="shrink-0 rounded-lg p-2 text-gray-400 transition hover:bg-amber-50 hover:text-amber-700"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => toggleActive(user)}
                    disabled={busy === user.id}
                    title={user.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                    className="shrink-0 rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                  >
                    {user.active ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => remove(user)}
                    disabled={busy === user.id}
                    className="shrink-0 rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </li>
          ),
        )}
      </ul>

      <p className="rounded-lg bg-gray-100 px-3 py-2.5 text-xs leading-relaxed text-gray-600">
        <Eye className="mr-1 inline h-3.5 w-3.5" />
        ปุ่มรูปตาข้างชื่อ = เปิดหลังบ้านในมุมมองของคนนั้น เพื่อดูว่าเขาเห็นเมนูอะไรบ้าง ·
        มุมมองนั้นแก้อะไรไม่ได้เลย กดออกได้ที่แถบสีเหลืองด้านบน
      </p>

      <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800">
        <KeyRound className="mr-1 inline h-3.5 w-3.5" />
        <b>รหัสตั้งต้น = เลข 4 ตัวท้ายเบอร์โทร</b> ใช้ตอนเพิ่งสร้างบัญชีเท่านั้น —
        ทุกคนควรไปตั้งรหัสของตัวเองที่เมนู “บัญชีของฉัน” เพราะเลข 4 หลักเดาได้ง่าย ·
        คนที่ตั้งรหัสเองแล้ว แก้เบอร์โทรจะไม่ทำให้รหัสหาย ·
        ระบบเก็บรหัสแบบเข้ารหัสไว้ ไม่มีใครดูรหัสของคนอื่นได้ ลืมรหัสให้กดปุ่มรูปกุญแจเพื่อตั้งรหัสใหม่จากเบอร์
      </p>
    </div>
  );
}
