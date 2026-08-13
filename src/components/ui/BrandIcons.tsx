/**
 * โลโก้แอปที่ lucide ไม่มีให้ (ถอดไอคอนแบรนด์ออกไปแล้ว) — วาดเป็น svg เอง
 * ใช้ currentColor เหมือนไอคอนตัวอื่น จะได้เปลี่ยนสีตามคลาสที่ครอบอยู่ได้
 */

export function Line({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2.5c5.52 0 10 3.58 10 8 0 1.77-.7 3.37-1.9 4.72-1.74 2-4.6 4.4-5.32 4.9-.7.5-1.6 1.16-1.86.4-.2-.6.14-1.2-.2-1.6-.24-.28-.7-.3-1.1-.32C6.4 18.2 2 14.7 2 10.5c0-4.42 4.48-8 10-8Zm-4.6 5.6a.5.5 0 0 0-.5.5v3.8a.5.5 0 0 0 .5.5h2.3a.5.5 0 0 0 0-1H7.9V8.6a.5.5 0 0 0-.5-.5Zm3.7 0a.5.5 0 0 0-.5.5v3.8a.5.5 0 0 0 1 0V8.6a.5.5 0 0 0-.5-.5Zm2 0a.5.5 0 0 0-.5.5v3.8a.5.5 0 0 0 1 0v-2.3l1.78 2.53c.2.28.62.24.76-.07a.5.5 0 0 0 .06-.24V8.6a.5.5 0 0 0-1 0v2.32L13.4 8.36a.5.5 0 0 0-.3-.25.5.5 0 0 0-.1-.01Zm4.9 0a.5.5 0 0 0-.5.5v3.8a.5.5 0 0 0 .5.5h2.3a.5.5 0 0 0 0-1h-1.8v-.9h1.8a.5.5 0 0 0 0-1h-1.8v-.9h1.8a.5.5 0 0 0 0-1H18Z" />
    </svg>
  );
}

export function Facebook({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.19 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.52 1.5-3.91 3.78-3.91 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.44 2.9h-2.34V22c4.78-.75 8.44-4.92 8.44-9.94z" />
    </svg>
  );
}

export function QrCode({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 21h1M21 14h-1" />
    </svg>
  );
}
