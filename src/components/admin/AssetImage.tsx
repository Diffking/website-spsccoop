"use client";

import { useState } from "react";

/**
 * รูปในหลังบ้านที่ถอยไปใช้สำเนาในเครื่องเองเมื่อโหลดจากที่อยู่เดิมไม่ได้
 *
 * ไฟล์ที่อัปไว้ถูกเก็บสองที่เสมอ (uploads/ ของเครื่องนี้ + โดเมน assets) แต่ที่บันทึกลงฐาน
 * เป็นที่อยู่ของโดเมน assets — วันไหนโดเมนนั้นล่ม รูปตัวอย่างในหลังบ้านจะแตกหมด
 * ทั้งที่ไฟล์ยังอยู่ครบ ทำให้ดูเหมือน "อัปโหลดไม่ขึ้น" ทั้งที่อัปสำเร็จแล้ว
 *
 * ฝั่งหน้าเว็บมี localAsset() ทำหน้าที่นี้อยู่แล้ว แต่ทำงานได้เฉพาะฝั่งเซิร์ฟเวอร์
 * (ต้องอ่าน ASSETS_BASE_URL) หลังบ้านเป็นคอมโพเนนต์ฝั่งเบราว์เซอร์จึงใช้วิธีนี้แทน:
 * รอให้โหลดพลาดก่อน แล้วค่อยลองสำเนาในเครื่อง — ไม่ต้องรู้ชื่อโดเมนล่วงหน้า
 */
export default function AssetImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState(src);

  return (
    // รูปจากหลังบ้าน ไม่รู้ขนาดล่วงหน้า จึงใช้ <img> ธรรมดา
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      className={className}
      onError={() => {
        const name = url.split("?")[0].split("/").pop();
        const local = name ? `/uploads/${name}` : "";
        // ลองครั้งเดียวพอ ถ้าสำเนาในเครื่องก็ไม่มีก็ปล่อยให้รูปแตกตามจริง
        if (local && url !== local) setUrl(local);
      }}
    />
  );
}
