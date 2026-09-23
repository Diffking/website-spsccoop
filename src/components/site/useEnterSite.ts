"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { markEntered } from "@/lib/splashSession";

/**
 * "เข้าสู่เว็บไซต์" จากหน้าวันสำคัญ — จำว่าเข้าแล้ว แล้วค่อยไปหน้าแรก
 *
 * ปุ่มกับตัวนับถอยหลังต้องทำสองอย่างนี้เหมือนกันเป๊ะ · ถ้าตัวนับลืมจำว่าเข้าแล้ว
 * พอถึงหน้าแรกมันจะโดนเด้งกลับมาหน้าวันสำคัญอีก วนไม่จบ
 */
export function useEnterSite(): () => void {
  const router = useRouter();
  return useCallback(() => {
    markEntered();
    router.push("/");
  }, [router]);
}
