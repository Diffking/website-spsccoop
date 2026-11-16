/**
 * อ่านอัลบั้มภาพกิจกรรมจากฐาน — ฝั่งเซิร์ฟเวอร์เท่านั้น
 * ตรรกะปีบัญชี/ตรวจลิงก์อยู่ที่ src/lib/galleryShared.ts
 */

import { db } from "@/lib/db";
import { fiscalRange, fiscalYearOf } from "@/lib/galleryShared";

export type GalleryAlbumView = {
  id: string;
  title: string;
  eventDate: string;
  place: string | null;
  caption: string | null;
  coverUrl: string;
  albumUrl: string;
  photoCount: number | null;
  showOnHome: boolean;
  published: boolean;
};

type Row = {
  id: string;
  title: string;
  eventDate: Date;
  place: string | null;
  caption: string | null;
  coverUrl: string;
  albumUrl: string;
  photoCount: number | null;
  showOnHome: boolean;
  published: boolean;
};

const toView = (r: Row): GalleryAlbumView => ({ ...r, eventDate: r.eventDate.toISOString() });

/** ปีบัญชีปัจจุบัน — หน้า /gallery/ เปิดมาเจอปีนี้เสมอ */
export const currentFiscalYear = () => fiscalYearOf(new Date());

/** อัลบั้มที่เผยแพร่ในปีบัญชีหนึ่ง ใหม่สุดขึ้นก่อน */
export async function getAlbumsOfYear(fy: number): Promise<GalleryAlbumView[]> {
  const { from, to } = fiscalRange(fy);
  const rows = await db.galleryAlbum
    .findMany({
      where: { published: true, eventDate: { gte: from, lt: to } },
      orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
    })
    .catch(() => []);
  return rows.map(toView);
}

/** ปีบัญชีที่มีอัลบั้มเผยแพร่อยู่ (ใหม่ → เก่า) — ทำปุ่มเลือกปีกับ sitemap */
export async function getFiscalYears(): Promise<number[]> {
  const rows = await db.galleryAlbum
    .findMany({ where: { published: true }, select: { eventDate: true } })
    .catch(() => []);
  return [...new Set(rows.map((r) => fiscalYearOf(r.eventDate)))].sort((a, b) => b - a);
}

/** ทุกอัลบั้มสำหรับหลังบ้าน (รวมที่ซ่อนไว้) */
export async function getAlbumsForAdmin(): Promise<GalleryAlbumView[]> {
  const rows = await db.galleryAlbum
    .findMany({ orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }] })
    .catch(() => []);
  return rows.map(toView);
}

/** จำนวนสไลด์ภาพกิจกรรมบนหน้าแรกสูงสุด — มากกว่านี้วนนานจนไม่มีใครดูครบ */
export const HOME_ALBUM_LIMIT = 8;

/** อัลบั้มที่ขึ้นสไลด์หน้าแรก (Phase 2) — เผยแพร่ + ติ๊ก "แสดงบนหน้าแรก" ใหม่สุดขึ้นก่อน */
export async function getHomeAlbums(): Promise<GalleryAlbumView[]> {
  const rows = await db.galleryAlbum
    .findMany({
      where: { published: true, showOnHome: true },
      orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
      take: HOME_ALBUM_LIMIT,
    })
    .catch(() => []);
  return rows.map(toView);
}
