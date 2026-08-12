/**
 * อัปไฟล์พร้อมรายงานความคืบหน้า 0-100
 *
 * ใช้ XMLHttpRequest ไม่ใช่ fetch เพราะ fetch บอกความคืบหน้า "ขาส่ง" ไม่ได้
 * ไฟล์ประกาศเป็นสิบ MB ถ้าไม่มีตัวเลขให้ดู ผู้ใช้จะไม่รู้ว่าค้างหรือกำลังไป
 *
 * ส่งเสร็จแล้วยังไม่จบ — ฝั่งเซิร์ฟเวอร์ต้องบีบ PDF / ย่อรูป / ส่งขึ้น FTP ต่ออีก
 * จึงแยกเป็นสองช่วง: "upload" (มีเปอร์เซ็นต์) แล้วต่อด้วย "process" (รอผล)
 */

export type UploadPhase = "upload" | "process" | "ai" | "done" | "error";

export type UploadResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function uploadWithProgress<T>(
  url: string,
  form: FormData,
  onProgress: (percent: number, phase: UploadPhase) => void,
): Promise<UploadResult<T>> {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    request.open("POST", url);

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      // กันไม่ให้ขึ้น 100 ตั้งแต่ตอนยังไม่ได้คำตอบ — 100 เก็บไว้ใช้ตอนสำเร็จจริง
      const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
      onProgress(percent, "upload");
    };

    request.upload.onload = () => onProgress(99, "process");

    request.onload = () => {
      let data: unknown = null;
      try {
        data = JSON.parse(request.responseText);
      } catch {
        data = null;
      }

      if (request.status >= 200 && request.status < 300) {
        onProgress(100, "done");
        resolve({ ok: true, data: data as T });
        return;
      }
      const error =
        (data as { error?: string } | null)?.error ?? `อัปโหลดไม่สำเร็จ (${request.status})`;
      onProgress(0, "error");
      resolve({ ok: false, error });
    };

    request.onerror = () => {
      onProgress(0, "error");
      resolve({ ok: false, error: "เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง" });
    };
    request.onabort = () => {
      onProgress(0, "error");
      resolve({ ok: false, error: "ยกเลิกการอัปโหลดแล้ว" });
    };

    request.send(form);
  });
}
