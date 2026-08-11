"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * แจ้งระบบว่ามีคนเปิดหน้านี้ — ยิงครั้งเดียวต่อการเปลี่ยนหน้า
 * ล้มเหลวก็เงียบ ไม่ให้กระทบผู้ใช้
 */
export default function PageTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/track/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
      signal: controller.signal,
      keepalive: true,
    }).catch(() => {});
    return () => controller.abort();
  }, [pathname]);

  return null;
}
