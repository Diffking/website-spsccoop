"use client";

/**
 * สวิตช์เปิด/ปิด — ใช้แทน checkbox ตรงที่ผลของมันเห็นได้ทันทีบนหน้าเว็บ
 * (checkbox สื่อว่า "ติ๊กไว้แล้วค่อยกดบันทึก" ส่วนสวิตช์สื่อว่า "กดแล้วเปลี่ยนเลย")
 */
export default function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-2.5 text-left disabled:opacity-50"
    >
      <span
        className={`mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${
          checked ? "bg-brand-600" : "bg-gray-300"
        }`}
      >
        <span
          className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-gray-700">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-gray-500">{hint}</span>}
      </span>
    </button>
  );
}
