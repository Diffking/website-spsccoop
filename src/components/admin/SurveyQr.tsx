"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, Loader2 } from "lucide-react";

/**
 * QR ของลิงก์แบบประเมิน — วาดบนเบราว์เซอร์ ไม่ต้องเก็บไฟล์ไว้ที่ไหน
 *
 * ใช้ระดับแก้ผิด H (กู้ได้ ~30%) เพราะเอาโลโก้ไปแปะทับกลาง QR
 * โลโก้กินพื้นที่ราว 20% ยังสแกนติดสบาย ๆ แม้พิมพ์บนกระดาษแล้วยับ
 *
 * โลโก้โหลดไม่ขึ้น (เช่น ไม่ได้ตั้งโลโก้ไว้) ก็ได้ QR เปล่า ไม่พัง
 */
export async function qrPng(url: string, logoUrl: string | null, size = 1024): Promise<string> {
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, url, { errorCorrectionLevel: "H", margin: 2, width: size });
  if (!logoUrl) return canvas.toDataURL("image/png");

  try {
    const img = new Image();
    img.src = logoUrl;
    await img.decode();
    const ctx = canvas.getContext("2d")!;
    const box = Math.round(size * 0.22);
    const x = (size - box) / 2;
    // ฉากขาวมนรองโลโก้ — ให้ตัวสแกนแยกโลโก้ออกจากจุด QR ได้ชัด
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(x - box * 0.08, x - box * 0.08, box * 1.16, box * 1.16, box * 0.2);
    ctx.fill();
    ctx.drawImage(img, x, x, box, box);
  } catch {
    // โลโก้เสีย = ใช้ QR เปล่า
  }
  return canvas.toDataURL("image/png");
}

function download(href: string, name: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
}

/** รูป QR + ปุ่มดาวน์โหลด (ไม่ใส่ showButtons = รูปอย่างเดียว ใช้ในโปสเตอร์) */
export default function SurveyQr({
  url,
  logoUrl,
  fileName,
  className = "h-44 w-44",
  showButtons = true,
}: {
  url: string;
  logoUrl: string | null;
  fileName: string;
  className?: string;
  showButtons?: boolean;
}) {
  const [png, setPng] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    qrPng(url, logoUrl).then((data) => {
      if (alive) setPng(data);
    });
    return () => {
      alive = false;
    };
  }, [url, logoUrl]);

  async function downloadSvg() {
    // SVG ไม่มีโลโก้ (ใส่รูปซ้อนใน SVG แล้วบางโปรแกรมเปิดไม่ขึ้น) · ขยายเท่าไหร่ก็คม เหมาะกับงานพิมพ์ใหญ่
    const svg = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 2 });
    download(URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })), `${fileName}.svg`);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`${className} grid place-items-center rounded-xl bg-white ring-1 ring-gray-200`}>
        {png ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL ที่วาดเอง ไม่ต้องผ่านตัวย่อรูป
          <img src={png} alt={`QR ของ ${url}`} className="h-full w-full rounded-xl" />
        ) : (
          <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
        )}
      </div>
      {showButtons && (
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={!png}
            onClick={() => png && download(png, `${fileName}.png`)}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-50 hover:text-brand-700 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> PNG
          </button>
          <button
            type="button"
            onClick={downloadSvg}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-50 hover:text-brand-700"
          >
            <Download className="h-3.5 w-3.5" /> SVG
          </button>
        </div>
      )}
    </div>
  );
}
