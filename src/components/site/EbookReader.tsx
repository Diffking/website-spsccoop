"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

/**
 * อ่านเอกสาร PDF แบบหนังสือในเว็บ — พลิกทีละหน้า ไม่ต้องโหลดทั้งเล่มก่อน
 *
 * pdf.js ดึงไฟล์ทีละช่วง (HTTP range) ผ่าน /api/ebook/<id> ซึ่งอยู่โดเมนเดียวกับเว็บ
 * หน้าแรกจึงขึ้นได้เร็วแม้ไฟล์จะหนาหลายสิบหน้า และหน้าถัดไปถูกวาดล่วงหน้าไว้ก่อนหนึ่งหน้า
 *
 * โหลด pdf.js แบบ dynamic import ตอนคอมโพเนนต์นี้ถูกใช้จริงเท่านั้น
 * ไลบรารีหนักเกือบ 1 MB — ไม่ควรติดไปกับทุกหน้าของเว็บ
 */

type PdfPage = {
  getViewport: (options: { scale: number }) => { width: number; height: number };
  render: (options: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }) => { promise: Promise<void>; cancel: () => void };
};
type PdfDoc = { numPages: number; getPage: (n: number) => Promise<PdfPage> };

export default function EbookReader({ src, title }: { src: string; title: string }) {
  const holder = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const doc = useRef<PdfDoc | null>(null);
  const task = useRef<{ cancel: () => void } | null>(null);

  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [wide, setWide] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // เปิดเอกสาร
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const loaded = await pdfjs.getDocument({
          url: src,
          // เอกสารไทยหลายฉบับไม่ฝังฟอนต์มาด้วย ไม่ชี้สองอันนี้ให้ ตัวหนังสือจะหายทั้งหน้า
          cMapUrl: "/pdfjs/cmaps/",
          cMapPacked: true,
          standardFontDataUrl: "/pdfjs/standard_fonts/",
          // ประกาศที่สแกนมามักบีบอัดภาพแบบ JBIG2 / JPEG2000 ซึ่งถอดรหัสด้วย wasm
          // ไม่ชี้ที่อยู่ไว้ จะได้หน้าเปล่าทั้งที่ไฟล์ไม่ได้เสีย
          wasmUrl: "/pdfjs/wasm/",
        }).promise;
        if (cancelled) return;
        doc.current = loaded as unknown as PdfDoc;
        setPages(loaded.numPages);
      } catch (e) {
        console.error("เปิดเอกสารไม่สำเร็จ:", e);
        if (!cancelled) setError("เปิดเอกสารไม่สำเร็จ ลองดาวน์โหลดไฟล์ไปอ่านแทนได้");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src]);

  const draw = useCallback(
    async (n: number) => {
      const pdf = doc.current;
      const target = canvas.current;
      const box = holder.current;
      if (!pdf || !target || !box) return;

      setLoading(true);
      task.current?.cancel();

      try {
        const p = await pdf.getPage(n);
        // พอดีความกว้างกรอบก่อน แล้วค่อยคูณระดับซูมที่ผู้อ่านตั้งไว้
        const base = p.getViewport({ scale: 1 });
        const fit = (box.clientWidth - 24) / base.width;
        const viewport = p.getViewport({ scale: Math.max(0.2, fit * zoom) });

        // จอความละเอียดสูงต้องวาดใหญ่กว่าที่แสดง ไม่งั้นตัวหนังสือแตก
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        target.width = Math.floor(viewport.width * ratio);
        target.height = Math.floor(viewport.height * ratio);
        target.style.width = `${Math.floor(viewport.width)}px`;
        target.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = target.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

        const render = p.render({ canvasContext: ctx, viewport });
        task.current = render;
        await render.promise;

        // วาดหน้าถัดไปทิ้งไว้ในแคชของ pdf.js กดเปลี่ยนหน้าแล้วจะขึ้นทันที
        if (n < pdf.numPages) void pdf.getPage(n + 1);
      } catch (e) {
        // ยกเลิกกลางคันเพราะผู้อ่านกดเปลี่ยนหน้าเร็ว ไม่ใช่ข้อผิดพลาดจริง
        if ((e as { name?: string })?.name !== "RenderingCancelledException") {
          console.error("วาดหน้าเอกสารไม่สำเร็จ:", e);
        }
      } finally {
        setLoading(false);
      }
    },
    [zoom],
  );

  useEffect(() => {
    if (pages > 0) void draw(page);
  }, [pages, page, draw]);

  // ปรับขนาดจอแล้ววาดใหม่ให้พอดีกรอบ
  useEffect(() => {
    if (pages === 0) return;
    let timer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void draw(page), 200);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(timer);
    };
  }, [pages, page, draw]);

  // ปุ่มลูกศรซ้าย/ขวาเปลี่ยนหน้าได้เหมือนอ่านหนังสือ
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setPage((p) => Math.min(pages, p + 1));
      if (e.key === "ArrowLeft") setPage((p) => Math.max(1, p - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pages]);

  if (error) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
        <p className="text-sm text-gray-600">{error}</p>
        <a
          href={src}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          <Download className="h-4 w-4" /> ดาวน์โหลดไฟล์
        </a>
      </div>
    );
  }

  const button =
    "grid h-9 w-9 place-items-center rounded-full bg-white text-gray-600 shadow-sm ring-1 ring-black/5 transition hover:text-brand-600 disabled:opacity-30";

  return (
    <div className={wide ? "fixed inset-0 z-[60] flex flex-col bg-gray-900/95 p-3" : ""}>
      {/* แถบเครื่องมือ */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            aria-label="หน้าก่อนหน้า"
            className={button}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span
            className={`rounded-full bg-white px-3 py-1.5 text-sm tabular-nums shadow-sm ring-1 ring-black/5 ${
              wide ? "text-gray-700" : "text-gray-600"
            }`}
          >
            หน้า {page} / {pages || "…"}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pages || 1, p + 1))}
            disabled={pages === 0 || page >= pages}
            aria-label="หน้าถัดไป"
            className={button}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(1)))}
            disabled={zoom <= 0.6}
            aria-label="ย่อ"
            className={button}
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(3, +(z + 0.2).toFixed(1)))}
            disabled={zoom >= 3}
            aria-label="ขยาย"
            className={button}
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={() => setWide((v) => !v)}
            aria-label={wide ? "ออกจากเต็มจอ" : "อ่านเต็มจอ"}
            className={button}
          >
            {wide ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <a
            href={src}
            download
            aria-label="ดาวน์โหลดไฟล์"
            title="ดาวน์โหลดไฟล์"
            className={button}
          >
            <Download className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* กรอบหน้ากระดาษ */}
      <div
        ref={holder}
        className={`relative grid place-items-center overflow-auto rounded-2xl bg-gray-100 p-3 ring-1 ring-black/5 ${
          wide ? "flex-1" : "min-h-[60vh]"
        }`}
      >
        {loading && (
          <span className="absolute inset-0 z-10 grid place-items-center bg-gray-100/70">
            <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
          </span>
        )}
        <canvas ref={canvas} aria-label={title} className="rounded-lg bg-white shadow-lg" />
      </div>

      {/* แถบเลขหน้าแบบกดข้าม */}
      {pages > 1 && (
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => setPage(n)}
              className={`h-7 min-w-7 rounded-lg px-2 text-xs tabular-nums transition ${
                n === page
                  ? "bg-brand-600 font-semibold text-white"
                  : "bg-white text-gray-500 ring-1 ring-black/5 hover:text-brand-600"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
