/**
 * ตรวจข้อมูลอัลบั้มที่ส่งมาจากหลังบ้าน — ใช้ร่วมทั้งเพิ่ม (POST) และแก้ (PATCH)
 *
 * `full` = ต้องมีช่องบังคับครบ (ตอนเพิ่ม) · ไม่ full = ตรวจเฉพาะช่องที่ส่งมา (ตอนแก้)
 */

import { cleanAlbumUrl, cleanCoverUrl } from "@/lib/galleryShared";

export type AlbumData = {
  title?: string;
  eventDate?: Date;
  place?: string | null;
  caption?: string | null;
  coverUrl?: string;
  albumUrl?: string;
  photoCount?: number | null;
  showOnHome?: boolean;
  published?: boolean;
};

const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export function readAlbumBody(
  body: Record<string, unknown>,
  parseDate: (value: string) => Date | null,
  full: boolean,
): { data: AlbumData } | { error: string } {
  const data: AlbumData = {};
  const has = (key: string) => full || body[key] !== undefined;

  if (has("albumUrl")) {
    const url = cleanAlbumUrl(body.albumUrl);
    if (!url) {
      return {
        error:
          "ลิงก์อัลบั้มต้องขึ้นต้นด้วย https:// และเป็น Google Photos · Google Drive หรือ Facebook เท่านั้น",
      };
    }
    data.albumUrl = url;
  }
  if (has("coverUrl")) {
    const cover = cleanCoverUrl(body.coverUrl);
    if (!cover) return { error: "อัปภาพเด่นก่อน" };
    data.coverUrl = cover;
  }
  if (has("title")) {
    const title = text(body.title, 200);
    if (!title) return { error: "บอกว่าเป็นภาพเกี่ยวกับอะไร" };
    data.title = title;
  }
  if (has("eventDate")) {
    const date = parseDate(String(body.eventDate ?? ""));
    if (!date) return { error: "เลือกวันที่จัดกิจกรรม" };
    data.eventDate = date;
  }
  if (body.place !== undefined) data.place = text(body.place, 200) || null;
  if (body.caption !== undefined) data.caption = text(body.caption, 600) || null;
  if (body.photoCount !== undefined) {
    const n = Math.trunc(Number(body.photoCount));
    data.photoCount = body.photoCount === "" || body.photoCount === null || !(n > 0) ? null : Math.min(n, 99999);
  }
  if (body.showOnHome !== undefined) data.showOnHome = Boolean(body.showOnHome);
  if (body.published !== undefined) data.published = Boolean(body.published);

  return { data };
}
