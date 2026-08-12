import Link from "next/link";
import type { ReactNode } from "react";

/**
 * ลิงก์ที่กดได้เมื่อมีปลายทางจริงเท่านั้น
 *
 * เนื้อหาหน้าแรกมาจากหลังบ้าน บางรายการยังไม่มีหน้าปลายทาง — ถ้าเรนเดอร์เป็น <a href="#">
 * ผู้ใช้จะกดแล้วไม่มีอะไรเกิดขึ้น (หน้าแรกเคยมีแบบนี้ 23 จุด) เว้นว่างไว้ให้เป็นข้อความธรรมดาดีกว่า
 */
export default function MaybeLink({
  href,
  className,
  children,
}: {
  href: string | null | undefined;
  className?: string;
  children: ReactNode;
}) {
  const real = href && href !== "#" ? href : null;
  if (!real) return <div className={className}>{children}</div>;
  return (
    <Link href={real} className={className}>
      {children}
    </Link>
  );
}
