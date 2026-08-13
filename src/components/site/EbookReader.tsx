"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

/**
 * อ่านเอกสาร PDF แบบหนังสือในเว็บ — กางสองหน้าเหมือนเปิดหนังสือจริง ลากเปลี่ยนหน้าได้
 *
 * pdf.js ดึงไฟล์ทีละช่วง (HTTP range) ผ่าน /api/ebook/<id> ซึ่งอยู่โดเมนเดียวกับเว็บ
 * หน้าแรกจึงขึ้นได้เร็วแม้ไฟล์จะหนาหลายสิบหน้า และคู่หน้าถัดไปถูกเตรียมไว้ล่วงหน้า
 *
 * โหลด pdf.js แบบ dynamic import ตอนคอมโพเนนต์นี้ถูกใช้จริงเท่านั้น
 * ไลบรารีหนักเกือบ 1 MB — ไม่ควรติดไปกับทุกหน้าของเว็บ
 */

type Viewport = { width: number; height: number };
type PdfPage = {
  getViewport: (options: { scale: number }) => Viewport;
  render: (options: {
    canvasContext: CanvasRenderingContext2D;
    viewport: Viewport;
  }) => { promise: Promise<void>; cancel: () => void };
};
type PdfDoc = { numPages: number; getPage: (n: number) => Promise<PdfPage> };

/** ลากไกลกว่านี้ (พิกเซล) ถึงนับว่าตั้งใจเปลี่ยนหน้า — สั้นกว่านี้ปัดนิดเดียวก็เปลี่ยนแล้ว */
const TURN_AT = 90;
/** ความสูงที่ยอมให้หนังสือกินตอนอ่านแบบไม่เต็มจอ */
const NORMAL_MAX_HEIGHT = 0.78;

export default function EbookReader({ src, title }: { src: string; title: string }) {
  const stage = useRef<HTMLDivElement>(null);
  const leftCanvas = useRef<HTMLCanvasElement>(null);
  const rightCanvas = useRef<HTMLCanvasElement>(null);
  const doc = useRef<PdfDoc | null>(null);
  const tasks = useRef<Record<"left" | "right", { cancel: () => void } | null>>({
    left: null,
    right: null,
  });

  const [pages, setPages] = useState(0);
  /** สัดส่วนหน้ากระดาษของเล่มนี้ (กว้าง/สูง) — ได้จากการเช็คหน้าแรกก่อนวาด */
  const [ratio, setRatio] = useState(0);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [wide, setWide] = useState(false);
  /** ผู้อ่านสั่งเปิดสองหน้าไหม — จริงจะกางได้ก็ต่อเมื่อจอกว้างพอและหน้าเป็นแนวตั้ง */
  const [wantSpread, setWantSpread] = useState(true);
  const [roomy, setRoomy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  /** ระยะที่กำลังลางอยู่ (บวก = ลากไปขวา = ย้อนกลับ) */
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);

  /**
   * เช็คหน้าก่อนว่าจะกางสองหน้าได้ไหม
   * เอกสารแนวนอน (สแกนมาทั้งแผ่นคู่อยู่แล้ว) กางอีกจะเล็กจนอ่านไม่ออก
   */
  const spread = wantSpread && roomy && ratio > 0 && ratio < 1 && pages > 1;

  // เปิดเอกสาร + เช็คขนาดหน้าแรก
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
        const first = await loaded.getPage(1);
        if (cancelled) return;
        const size = first.getViewport({ scale: 1 });
        setRatio(size.width / size.height);
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

  /** จอกว้างพอจะกางสองหน้าไหม — ดูจากกรอบจริง ไม่ใช่ความกว้างจอ (เต็มจอ/ไม่เต็มจอกว้างไม่เท่ากัน) */
  useEffect(() => {
    const check = () => setRoomy((stage.current?.clientWidth ?? 0) >= 880);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [wide]);

  /** คู่หน้าที่กำลังเปิดอยู่ — หน้าปกอยู่เดี่ยว ๆ ที่เหลือจับคู่ (2,3) (4,5) เหมือนหนังสือจริง */
  const openPages = useMemo(() => {
    if (!spread) return [page];
    if (page === 1) return [1];
    const left = page % 2 === 0 ? page : page - 1;
    return left + 1 <= pages ? [left, left + 1] : [left];
  }, [spread, page, pages]);

  const draw = useCallback(async () => {
    const pdf = doc.current;
    const box = stage.current;
    if (!pdf || !box || openPages.length === 0) return;

    setLoading(true);
    tasks.current.left?.cancel();
    tasks.current.right?.cancel();

    try {
      const first = await pdf.getPage(openPages[0]);
      const base = first.getViewport({ scale: 1 });

      /*
       * ย่อให้พอดีกรอบทั้งกว้างและสูง — เดิมพอดีแค่ความกว้าง หน้าแนวตั้งจึงล้นลงไปข้างล่าง
       * ต้องเลื่อนหาเอง ซึ่งไม่เหมือนอ่านหนังสือ
       */
      const usableW = box.clientWidth - 32 - (openPages.length > 1 ? 8 : 0);
      /*
       * แบบไม่เต็มจอ ต้องหักส่วนที่อยู่เหนือกรอบ (หัวเว็บ ชื่อเรื่อง แถบเครื่องมือ) ออกก่อน
       * คิดจากความสูงจอเฉย ๆ ไม่พอ — หน้ากระดาษจะยาวเลยขอบจอลงไป ต้องเลื่อนหาเอง
       */
      const top = box.getBoundingClientRect().top;
      const usableH = wide
        ? box.clientHeight - 32
        : Math.min(
            Math.max(window.innerHeight - Math.max(top, 0) - 96, 380),
            window.innerHeight * NORMAL_MAX_HEIGHT,
          );
      const fit = Math.min(
        usableW / (base.width * openPages.length),
        usableH / base.height,
      );
      const scale = Math.max(0.15, fit * zoom);

      const targets = [leftCanvas.current, rightCanvas.current] as const;
      const ratioPx = Math.min(window.devicePixelRatio || 1, 2);

      for (const [i, n] of openPages.entries()) {
        const target = targets[i];
        if (!target) continue;

        const p = i === 0 ? first : await pdf.getPage(n);
        const viewport = p.getViewport({ scale });

        target.width = Math.floor(viewport.width * ratioPx);
        target.height = Math.floor(viewport.height * ratioPx);
        target.style.width = `${Math.floor(viewport.width)}px`;
        target.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = target.getContext("2d");
        if (!ctx) continue;
        ctx.setTransform(ratioPx, 0, 0, ratioPx, 0, 0);

        const render = p.render({ canvasContext: ctx, viewport });
        tasks.current[i === 0 ? "left" : "right"] = render;
        await render.promise;
      }

      // เตรียมคู่หน้าถัดไปไว้ในแคชของ pdf.js กดเปลี่ยนแล้วจะขึ้นทันที
      const after = openPages[openPages.length - 1] + 1;
      if (after <= pdf.numPages) void pdf.getPage(after);
    } catch (e) {
      // ยกเลิกกลางคันเพราะผู้อ่านเปลี่ยนหน้าเร็ว ไม่ใช่ข้อผิดพลาดจริง
      if ((e as { name?: string })?.name !== "RenderingCancelledException") {
        console.error("วาดหน้าเอกสารไม่สำเร็จ:", e);
      }
    } finally {
      setLoading(false);
    }
  }, [openPages, zoom, wide]);

  useEffect(() => {
    if (pages > 0) void draw();
  }, [pages, draw]);

  // ปรับขนาดจอแล้ววาดใหม่ให้พอดีกรอบ
  useEffect(() => {
    if (pages === 0) return;
    let timer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void draw(), 200);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(timer);
    };
  }, [pages, draw]);

  const step = openPages.length > 1 ? 2 : 1;
  const next = useCallback(
    () => setPage((p) => Math.min(pages || 1, p === 1 && spread ? 2 : p + step)),
    [pages, spread, step],
  );
  const prev = useCallback(
    () => setPage((p) => (spread ? (p <= 2 ? 1 : p - 2) : Math.max(1, p - 1))),
    [spread],
  );

  // ปุ่มลูกศรซ้าย/ขวาเปลี่ยนหน้าได้เหมือนอ่านหนังสือ
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "Escape") setWide(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  /* ---------------------- ลากเปลี่ยนหน้า (เมาส์ + นิ้ว) ---------------------- */

  const dragFrom = useRef(0);
  /**
   * สถานะการลากเก็บใน ref ไม่ใช่ state — pointerdown/move/up อาจมาในจังหวะเดียวกัน
   * ถ้าอ่านจาก state ที่ยังไม่ทันอัปเดต จะกลายเป็นว่าไม่เคยเริ่มลากเลยแล้วเปลี่ยนหน้าไม่ได้
   */
  const holding = useRef(false);
  const moved = useRef(0);

  function onPointerDown(e: React.PointerEvent) {
    // ซูมอยู่ = ผู้อ่านกำลังเลื่อนดูรายละเอียดในหน้า อย่าไปแย่งเป็นการเปลี่ยนหน้า
    if (zoom > 1) return;
    dragFrom.current = e.clientX;
    moved.current = 0;
    holding.current = true;
    setDragging(true);
    // จับ pointer ไว้กับกรอบ ลากเลยขอบออกไปแล้วยังนับต่อ — บางเบราว์เซอร์ไม่ให้จับ ก็ไม่เป็นไร
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!holding.current) return;
    const raw = e.clientX - dragFrom.current;
    // ลากเลยหน้าแรก/หน้าสุดท้ายให้ฝืดไว้ จะได้รู้สึกว่าสุดเล่มแล้ว
    const atEdge =
      (raw > 0 && page <= 1) || (raw < 0 && openPages[openPages.length - 1] >= pages);
    moved.current = atEdge ? raw * 0.25 : raw;
    setDx(moved.current);
  }

  function endDrag() {
    if (!holding.current) return;
    holding.current = false;
    setDragging(false);
    if (moved.current <= -TURN_AT) next();
    else if (moved.current >= TURN_AT) prev();
    moved.current = 0;
    setDx(0);
  }

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
  const label = openPages.length > 1 ? `${openPages[0]}–${openPages[1]}` : `${openPages[0]}`;

  return (
    <div className={wide ? "fixed inset-0 z-[60] flex flex-col bg-gray-900/95 p-3" : ""}>
      {/* แถบเครื่องมือ */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={prev} disabled={page <= 1} aria-label="หน้าก่อนหน้า" className={button}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="rounded-full bg-white px-3 py-1.5 text-sm tabular-nums text-gray-600 shadow-sm ring-1 ring-black/5">
            หน้า {label} / {pages || "…"}
          </span>
          <button
            onClick={next}
            disabled={pages === 0 || openPages[openPages.length - 1] >= pages}
            aria-label="หน้าถัดไป"
            className={button}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {roomy && ratio > 0 && ratio < 1 && pages > 1 && (
            <button
              onClick={() => setWantSpread((v) => !v)}
              aria-label={wantSpread ? "อ่านทีละหน้า" : "กางสองหน้า"}
              title={wantSpread ? "อ่านทีละหน้า" : "กางสองหน้าเหมือนหนังสือ"}
              className={`${button} ${wantSpread ? "text-brand-600" : ""}`}
            >
              {wantSpread ? <BookOpen className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
            </button>
          )}
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
          <a href={src} download aria-label="ดาวน์โหลดไฟล์" title="ดาวน์โหลดไฟล์" className={button}>
            <Download className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* กรอบหนังสือ — ลากซ้าย/ขวาเพื่อเปลี่ยนหน้า */}
      <div
        ref={stage}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ perspective: "1800px", touchAction: zoom > 1 ? "auto" : "pan-y" }}
        className={`relative grid select-none place-items-center overflow-auto rounded-2xl bg-gray-100 p-4 ring-1 ring-black/5 ${
          wide ? "flex-1" : "min-h-[420px]"
        } ${zoom > 1 ? "cursor-auto" : dragging ? "cursor-grabbing" : "cursor-grab"}`}
      >
        {loading && (
          <span className="absolute inset-0 z-10 grid place-items-center bg-gray-100/70">
            <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
          </span>
        )}

        {/*
          เอียงตามแรงลากนิดหน่อยให้รู้สึกเหมือนจับกระดาษ ไม่ใช่แค่เลื่อนภาพ
          ปล่อยแล้วดีดกลับเอง (transition ทำงานเฉพาะตอนไม่ได้ลาก ไม่งั้นจะหน่วงตามนิ้วช้า ๆ)
        */}
        <div
          style={{
            transform: `translateX(${dx}px) rotateY(${dx * -0.025}deg)`,
            transition: dragging ? "none" : "transform 260ms cubic-bezier(.22,1,.36,1)",
          }}
          className="flex items-stretch"
        >
          <canvas
            ref={leftCanvas}
            aria-label={title}
            className={`bg-white shadow-xl ${
              openPages.length > 1 ? "rounded-l-lg" : "rounded-lg"
            }`}
          />
          {openPages.length > 1 && (
            <>
              {/* สันหนังสือ — เงาบาง ๆ ตรงกลางให้ดูเหมือนกระดาษพับเข้าเล่ม */}
              <span className="w-2 shrink-0 bg-gradient-to-r from-black/20 via-black/5 to-black/20" />
              <canvas ref={rightCanvas} aria-hidden="true" className="rounded-r-lg bg-white shadow-xl" />
            </>
          )}
        </div>

        {pages > 1 && (
          <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-[11px] text-white">
            ลากซ้าย-ขวา หรือกดลูกศร เพื่อเปลี่ยนหน้า
          </span>
        )}
      </div>

      {/* เลื่อนข้ามหน้า — เล่มหนา ๆ ใช้แถบเลื่อน เล่มบางใช้ปุ่มตัวเลข */}
      {pages > 1 && (
        <div className="mt-3">
          {pages > 24 ? (
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={pages}
                value={page}
                onChange={(e) => setPage(Number(e.target.value))}
                aria-label="เลื่อนไปหน้าที่ต้องการ"
                className="w-full accent-brand-600"
              />
              <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs tabular-nums text-gray-500 shadow-sm ring-1 ring-black/5">
                {page}/{pages}
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-1.5">
              {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`h-7 min-w-7 rounded-lg px-2 text-xs tabular-nums transition ${
                    openPages.includes(n)
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
      )}
    </div>
  );
}
