/**
 * survey-edge — Cloudflare Worker หน้าด่านของแบบประเมินที่ survey.spsccoop.org
 *
 * แทนกล่องพัก PHP บนโฮสต์ (เจ้าของเว็บสั่งเลิกใช้ PHP กับแบบประเมิน 26 ต.ค. 2569)
 *
 *   เครื่องสำนักงานเปิด: ส่งต่อทุกคำขอไป ORIGIN (spsccoop.org ผ่านอุโมงค์) ตามปกติ
 *                       + เก็บสำเนาหน้า /s/ /r/ และไฟล์ประกอบไว้ใน D1
 *   เครื่องปิด:         GET  = เสิร์ฟสำเนาที่เก็บไว้ (X-Edge: stale)
 *                       POST identify/submit = ตอบ { offline: true } ให้หน้าจอเปลี่ยนเป็นโหมดฝากคำตอบ
 *                       POST queue = เข้ารหัสด้วยกุญแจสาธารณะ แล้วพักใน D1
 *   เครื่องเปิดอีกครั้ง: เครื่องสำนักงานมาดึงเอง GET /__queue · สั่งลบ POST /__queue/ack (ต้องมีโทเคน)
 *
 * ⚠️ เปิดเฉพาะเส้นทางที่แบบประเมินใช้ (ALLOWED_GET · API) ที่เหลือตอบ 404 — หลังบ้านเข้าทางนี้ไม่ได้
 * ⚠️ Cloudflare อ่านคำตอบที่พักไม่ได้ — Worker มีแค่กุญแจสาธารณะ กุญแจไขอยู่ที่เครื่องสำนักงาน
 *    รูปแบบที่เข้ารหัสต้องตรงกับ openSealed() ใน src/lib/surveyQueue.ts (RSA-OAEP SHA-1 + AES-256-GCM)
 */

interface D1Result<T> { results: T[] }
interface D1Prepared {
  bind(...values: unknown[]): D1Prepared;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
}
interface D1Database { prepare(sql: string): D1Prepared; batch(list: D1Prepared[]): Promise<unknown> }
interface ExecutionContext { waitUntil(p: Promise<unknown>): void }

export interface Env {
  DB: D1Database;
  /** ต้นทางจริง เช่น https://spsccoop.org — ไม่มี / ปิดท้าย */
  ORIGIN: string;
  /** secret — ตรงกับ Setting["surveyQueue"].token บนเครื่องสำนักงาน */
  QUEUE_TOKEN: string;
  /** secret — กุญแจสาธารณะ PEM (spki) ไว้ล็อกคำตอบที่พัก */
  PUBLIC_KEY: string;
}

const ALLOWED_GET = [
  /^\/s\/[a-z0-9]{4,12}\/?$/,
  /^\/r\/[A-Za-z0-9_-]{16,64}\/?$/,
  /^\/_next\/static\/[\w./~-]+$/,
  /^\/uploads\/[\w.-]+$/,
  /^\/(favicon\.ico|icon\.png|apple-icon\.png)$/,
];
const API = /^\/api\/survey\/([a-z0-9]{4,12})\/(identify|submit|queue)\/?$/;
const PAGE = /^\/(s|r)\//;
const MAX_BODY = 64 * 1024;
const MAX_SNAPSHOT = 1_500_000;
const PER_IP_HOUR = 10;
const MAX_ITEMS = 5000;
const ORIGIN_TIMEOUT = 8000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const OFFLINE_HTML = `<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ปิดปรับปรุงชั่วคราว</title><body style="font-family:sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;text-align:center;color:#1e3a5f">
<h1>ระบบปิดปรับปรุงชั่วคราว</h1><p>กรุณาเปิดลิงก์นี้อีกครั้งในเวลาทำการของสหกรณ์</p></body></html>`;

const CLOSED_MSG = "แบบประเมินนี้ปิดรับคำตอบแล้ว ขอบคุณที่ให้ความสนใจ";
const CLOSED_HTML = `<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ปิดรับคำตอบแล้ว</title><body style="font-family:sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;text-align:center;color:#1e3a5f">
<h1>ปิดรับคำตอบแล้ว</h1><p>${CLOSED_MSG}</p></body></html>`;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/__health") return json({ ok: true });
    if (path === "/__queue" || path === "/__queue/ack") return queueApi(request, env, url);

    const api = API.exec(path);
    if (api && request.method === "POST") return handlePost(request, env, path, api[2]);

    if ((request.method === "GET" || request.method === "HEAD") && ALLOWED_GET.some((re) => re.test(path))) {
      return handleGet(request, env, ctx, url);
    }
    return new Response("ไม่พบหน้านี้", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  },
};

/* ------------------------------------------------------------ ส่งต่อไปต้นทาง */

function originHeaders(request: Request, url: URL): Headers {
  const h = new Headers();
  for (const name of ["content-type", "user-agent", "accept", "accept-language"]) {
    const v = request.headers.get(name);
    if (v) h.set(name, v);
  }
  // บอกหลังบ้านว่าคนอ่านเปิดโดเมนไหน ไอพีอะไร (หลักเดียวกับตัวมิเรอร์ PHP) — ใช้นับกันยิงรัว
  h.set("x-public-host", url.host);
  h.set("x-visitor-ip", request.headers.get("cf-connecting-ip") ?? "unknown");
  return h;
}

/**
 * จำว่าต้นทางเพิ่งล่ม — ระหว่างนี้ไม่ต้องลองต่อให้คนรอจนหมดเวลาทุกคำขอ (หลักเดียวกับ down_ttl ของมิเรอร์ PHP เดิม)
 * เจอจริงตอนทดสอบ: หน้าหนึ่งเรียกสคริปต์ 10 ไฟล์ แต่ละไฟล์รอต้นทาง 8 วินาที หน้าเลยไม่ทันเริ่มทำงาน
 * เก็บในหน่วยความจำของ isolate — คนละ isolate ก็แค่ลองใหม่เองหนึ่งครั้ง ไม่เสียหาย
 */
let originDownUntil = 0;
const DOWN_TTL = 60_000;

/** ส่งไปต้นทาง — คืน null ถ้าต่อไม่ได้ / หมดเวลา / ต้นทางล่ม (5xx รวม 52x/530 ของ Cloudflare) */
async function toOrigin(env: Env, request: Request, url: URL, body?: string): Promise<Response | null> {
  // เส้นทางของเครื่องสำนักงาน (__queue) ไม่ผ่านที่นี่ · คำขอ warm มาจากเครื่องสำนักงานเอง = ต้นทางเปิดแน่ ๆ
  if (Date.now() < originDownUntil && !request.headers.get("x-edge-warm")) return null;
  const res = await toOriginRaw(env, request, url, body);
  if (res === null) originDownUntil = Date.now() + DOWN_TTL;
  else originDownUntil = 0;
  return res;
}

async function toOriginRaw(env: Env, request: Request, url: URL, body?: string): Promise<Response | null> {
  try {
    const res = await fetch(`${env.ORIGIN}${url.pathname}${url.search}`, {
      method: request.method,
      headers: originHeaders(request, url),
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(ORIGIN_TIMEOUT),
    });
    if (res.status >= 500) return null;
    // ต้นทางพาไปที่อยู่ที่มี / ปิดท้าย — เปลี่ยนโดเมนในหัว location เป็นโดเมนของ Worker
    const loc = res.headers.get("location");
    if (loc?.startsWith(env.ORIGIN)) {
      const h = new Headers(res.headers);
      h.set("location", loc.slice(env.ORIGIN.length) || "/");
      return new Response(res.body, { status: res.status, headers: h });
    }
    return res;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ GET */

async function handleGet(request: Request, env: Env, ctx: ExecutionContext, url: URL): Promise<Response> {
  const path = url.pathname + url.search;
  const warm = await tokenOk(request.headers.get("x-edge-warm"), env);

  // ไฟล์ /_next/static มีรหัสเนื้อหาในชื่อ ไม่มีวันเปลี่ยน — มีสำเนาแล้วเสิร์ฟเลย ไม่ต้องถามต้นทาง
  if (url.pathname.startsWith("/_next/static/")) {
    const hit = await snapshot(env, path, request.method, "cache");
    if (hit) return hit;
  }

  const res = await toOrigin(env, request, url);

  if (res) {
    // ต้นทางบอกว่าไม่มีแล้ว (ยกเลิกลิงก์กรรมการ · ร่าง) — ลบสำเนาทิ้ง ตอนเครื่องปิดจะได้ไม่เสิร์ฟของที่ถูกถอน
    if (res.status === 404 && PAGE.test(url.pathname)) {
      ctx.waitUntil(env.DB.prepare("DELETE FROM pages WHERE path = ?").bind(path).run());
      return res;
    }
    if (res.status !== 200) return res;

    const type = res.headers.get("content-type") ?? "application/octet-stream";
    const buf = await res.arrayBuffer();
    if (buf.byteLength <= MAX_SNAPSHOT) {
      const store = saveSnapshot(env, path, type, buf, PAGE.test(url.pathname), warm);
      // warm = เก็บไฟล์ประกอบหน้าทั้งหมดด้วย ไม่ต้องรอให้มีคนเปิดก่อน
      const assets = warm && type.includes("html") ? warmAssets(env, request, url, new TextDecoder().decode(buf)) : null;
      if (warm) await Promise.all([store, assets]);
      else ctx.waitUntil(store);
    }
    const headers = new Headers(res.headers);
    headers.set("x-edge", "live");
    return new Response(request.method === "HEAD" ? null : buf, { status: 200, headers });
  }

  // ต้นทางล่ม — เสิร์ฟสำเนา · เว้นแต่สำเนาเป็นฟอร์มที่เลยเวลาปิดรับไปแล้ว
  const code = /^\/s\/([a-z0-9]{4,12})\/?$/.exec(url.pathname)?.[1];
  if (code && (await closedBySnapshot(env, code))) {
    return new Response(request.method === "HEAD" ? null : CLOSED_HTML, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "x-edge": "closed", "cache-control": "no-store" },
    });
  }
  const stale = await snapshot(env, path, request.method, "stale");
  if (stale) return stale;
  if (PAGE.test(url.pathname)) {
    return new Response(OFFLINE_HTML, { status: 503, headers: { "content-type": "text/html; charset=utf-8", "retry-after": "600" } });
  }
  return new Response("", { status: 503 });
}

/** อ่านสำเนาจาก D1 เป็น Response — ไม่มี = null */
async function snapshot(env: Env, path: string, method: string, state: "stale" | "cache"): Promise<Response | null> {
  const snap = await env.DB.prepare("SELECT content_type, body FROM pages WHERE path = ?")
    .bind(path)
    .first<{ content_type: string; body: ArrayBuffer | number[] }>();
  if (!snap) return null;
  // D1 คืนคอลัมน์ BLOB เป็นอาร์เรย์ตัวเลข ไม่ใช่ ArrayBuffer — ส่งตรง ๆ แล้วได้เนื้อหาว่าง (เจอตอนทดสอบ 26 ต.ค. 2569)
  const bytes = snap.body instanceof ArrayBuffer ? new Uint8Array(snap.body) : Uint8Array.from(snap.body);
  return new Response(method === "HEAD" ? null : bytes, {
    status: 200,
    headers: {
      "content-type": snap.content_type,
      "x-edge": state,
      // ไฟล์ static ให้เบราว์เซอร์จำได้นาน (ชื่อเปลี่ยนเมื่อเนื้อหาเปลี่ยน) · หน้าเว็บห้ามจำ
      "cache-control": state === "cache" ? "public, max-age=31536000, immutable" : "no-store",
    },
  });
}

/**
 * Worker ไม่รู้วันปิดรับเอง — อ่านจาก <meta name="survey-closes"> ที่หน้า /s/<code>/ ฝังไว้ (มิลลิวินาที)
 * ในสำเนาล่าสุด · เลยเวลาแล้ว = ปิดรับ ไม่งั้นสมาชิกตอบหลังปิด หน้าจอบอกว่าได้รับ แล้วถูกปฏิเสธทีหลังเงียบ ๆ
 * ไม่มีสำเนา / ไม่มีวันปิด = ไม่รู้ ถือว่ายังเปิด (เครื่องสำนักงานตัดสินซ้ำตอนดึงอยู่แล้ว)
 */
async function closedBySnapshot(env: Env, code: string): Promise<boolean> {
  const snap = await env.DB.prepare("SELECT body FROM pages WHERE path = ? OR path = ? LIMIT 1")
    .bind(`/s/${code}/`, `/s/${code}`)
    .first<{ body: ArrayBuffer | number[] }>();
  if (!snap) return false;
  const bytes = snap.body instanceof ArrayBuffer ? new Uint8Array(snap.body) : Uint8Array.from(snap.body);
  const at = /<meta name="survey-closes" content="(\d+)"/.exec(new TextDecoder().decode(bytes))?.[1];
  return at !== undefined && Date.now() >= Number(at);
}

/**
 * เก็บสำเนา — ไฟล์ /_next/static ชื่อมีรหัสเนื้อหา ไม่เปลี่ยน เก็บครั้งเดียวพอ
 * หน้า /s/ /r/ เขียนใหม่ทุก 5 นาที (หรือทันทีตอนเครื่องสำนักงานสั่ง warm) — ประหยัดโควตาเขียนของ D1
 */
async function saveSnapshot(env: Env, path: string, type: string, body: ArrayBuffer, page: boolean, force: boolean) {
  const now = Math.floor(Date.now() / 1000);
  const old = await env.DB.prepare("SELECT updated_at FROM pages WHERE path = ?").bind(path).first<{ updated_at: number }>();
  if (old && (!page || (!force && now - old.updated_at < 300))) return;
  await env.DB.prepare(
    "INSERT INTO pages (path, content_type, body, updated_at) VALUES (?, ?, ?, ?) " +
      "ON CONFLICT(path) DO UPDATE SET content_type = excluded.content_type, body = excluded.body, updated_at = excluded.updated_at",
  )
    .bind(path, type, body, now)
    .run();
}

/** ไล่เก็บไฟล์ /_next/static ที่หน้านี้เรียกใช้ — ตอนเครื่องปิดหน้าจะได้มีสคริปต์/สไตล์ครบ */
async function warmAssets(env: Env, request: Request, url: URL, html: string) {
  const found = [...new Set(html.match(/\/_next\/static\/[\w./~-]+/g) ?? [])].slice(0, 80);
  for (const asset of found) {
    const have = await env.DB.prepare("SELECT 1 AS x FROM pages WHERE path = ?").bind(asset).first();
    if (have) continue;
    const assetUrl = new URL(asset, url);
    const res = await toOrigin(env, new Request(assetUrl, { headers: request.headers }), assetUrl);
    if (!res || res.status !== 200) continue;
    const buf = await res.arrayBuffer();
    if (buf.byteLength <= MAX_SNAPSHOT) {
      await saveSnapshot(env, asset, res.headers.get("content-type") ?? "application/octet-stream", buf, false, false);
    }
  }
}

/* ----------------------------------------------------------------- POST */

async function handlePost(request: Request, env: Env, path: string, kind: string): Promise<Response> {
  const body = await request.text();
  if (body.length > MAX_BODY) return json({ error: "ข้อมูลใหญ่เกินไป" }, 413);

  const res = await toOrigin(env, request, new URL(request.url), body);
  if (res) return res;

  const code = API.exec(path)?.[1];
  if (code && (await closedBySnapshot(env, code))) return json({ error: CLOSED_MSG }, 409);

  if (kind !== "queue") {
    // ให้หน้าจอเปลี่ยนเป็นโหมด "ฝากคำตอบ" (กรอกเบอร์ + ชื่อ) — ดู post() ใน SurveyForm.tsx
    return json({ error: "ระบบยืนยันตัวตนปิดชั่วคราว", offline: true }, 503);
  }
  return storeQueued(env, request, path, body);
}

async function storeQueued(env: Env, request: Request, path: string, body: string): Promise<Response> {
  try {
    JSON.parse(body);
  } catch {
    return json({ error: "ข้อมูลไม่ถูกต้อง" }, 400);
  }
  if (!(await configured(env))) return json({ error: "ระบบรับคำตอบยังไม่พร้อม กรุณาลองใหม่ในเวลาทำการ" }, 503);

  const now = Math.floor(Date.now() / 1000);
  // ไม่เก็บไอพีจริง — เก็บแฮชรวมโทเคน ใช้นับกันขยะอย่างเดียว
  const ipHash = await sha256Hex(`${request.headers.get("cf-connecting-ip") ?? "unknown"}|${env.QUEUE_TOKEN}`);

  const byIp = await env.DB.prepare("SELECT COUNT(*) AS n FROM queue WHERE ip_hash = ? AND queued_at > ?").bind(ipHash, now - 3600).first<{ n: number }>();
  if ((byIp?.n ?? 0) >= PER_IP_HOUR) return json({ error: "ส่งหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่" }, 429);
  const total = await env.DB.prepare("SELECT COUNT(*) AS n FROM queue WHERE dead = 0").first<{ n: number }>();
  if ((total?.n ?? 0) >= MAX_ITEMS) return json({ error: "ระบบรับคำตอบเต็มชั่วคราว กรุณาลองใหม่ในเวลาทำการ" }, 503);

  const sealed = await seal(body, env.PUBLIC_KEY);
  await env.DB.prepare("INSERT INTO queue (id, path, sealed, ip_hash, queued_at) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID().replace(/-/g, ""), path, JSON.stringify(sealed), ipHash, now)
    .run();
  return json({ ok: true, queued: true, host: true });
}

/* ------------------------------------------------- ให้เครื่องสำนักงานมาดึง */

async function queueApi(request: Request, env: Env, url: URL): Promise<Response> {
  if (!(await configured(env)) || !(await tokenOk(request.headers.get("x-queue-token"), env))) {
    return new Response("ไม่พบหน้านี้", { status: 404 });
  }
  if (url.pathname === "/__queue" && request.method === "GET") {
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit")) || 100));
    const rows = await env.DB.prepare("SELECT id, path, sealed, queued_at FROM queue WHERE dead = 0 ORDER BY queued_at LIMIT ?")
      .bind(limit)
      .all<{ id: string; path: string; sealed: string; queued_at: number }>();
    return json({ items: rows.results.map((r) => ({ id: r.id, path: r.path, sealed: r.sealed, queuedAt: r.queued_at })) });
  }
  if (url.pathname === "/__queue/ack" && request.method === "POST") {
    const body = (await request.json().catch(() => ({}))) as { done?: unknown; dead?: unknown };
    const done = Array.isArray(body.done) ? body.done.filter((x): x is string => typeof x === "string").slice(0, 500) : [];
    const dead = Array.isArray(body.dead) ? (body.dead as { id?: unknown; error?: unknown }[]).slice(0, 500) : [];
    const ops: D1Prepared[] = [
      ...done.map((id) => env.DB.prepare("DELETE FROM queue WHERE id = ?").bind(id)),
      ...dead
        .filter((d) => typeof d.id === "string")
        .map((d) => env.DB.prepare("UPDATE queue SET dead = 1, last_error = ? WHERE id = ?").bind(String(d.error ?? "").slice(0, 250), d.id)),
    ];
    // รายการเสีย (สแปม · ส่งหลังปิดรับ) เก็บไว้ดูย้อนหลัง 30 วันแล้วลบเอง — ไม่ให้กล่องโตไม่จบ
    ops.push(env.DB.prepare("DELETE FROM queue WHERE dead = 1 AND queued_at < ?").bind(Math.floor(Date.now() / 1000) - 30 * 86400));
    await env.DB.batch(ops);
    return json({ ok: true, done: done.length, dead: dead.length });
  }
  return new Response("ไม่พบหน้านี้", { status: 404 });
}

/* -------------------------------------------------------------- กุญแจ */

/** ตั้ง secret ครบแล้วหรือยัง — โทเคนสั้น/ว่าง = ไม่เปิดทั้งกล่อง (กันลืมตั้งแล้วใครก็ดึงได้) */
async function configured(env: Env): Promise<boolean> {
  return typeof env.QUEUE_TOKEN === "string" && env.QUEUE_TOKEN.length >= 24 && typeof env.PUBLIC_KEY === "string" && env.PUBLIC_KEY.includes("PUBLIC KEY");
}

/** เทียบโทเคนแบบเวลาคงที่ */
async function tokenOk(given: string | null, env: Env): Promise<boolean> {
  if (!given || !(await configured(env))) return false;
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(env.QUEUE_TOKEN);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** base64 ทีละก้อน — กระจายอาร์เรย์ใหญ่ ๆ เข้า fromCharCode ทีเดียวเกินเพดานอาร์กิวเมนต์ได้ */
function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function sha256Hex(text: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return [...d].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** ล็อกเนื้อหา — AES-256-GCM แล้วล็อกกุญแจ AES ด้วย RSA-OAEP (SHA-1) · tag แยกช่องตามที่ openSealed() อ่าน */
async function seal(plain: string, pem: string) {
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")), (c) => c.charCodeAt(0));
  const rsa = await crypto.subtle.importKey("spki", der, { name: "RSA-OAEP", hash: "SHA-1" }, false, ["encrypt"]);
  const aes = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", aes));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const out = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, tagLength: 128 }, aes, new TextEncoder().encode(plain)));
  const k = new Uint8Array(await crypto.subtle.encrypt({ name: "RSA-OAEP" }, rsa, raw));
  return { k: b64(k), iv: b64(iv), tag: b64(out.slice(out.length - 16)), data: b64(out.slice(0, out.length - 16)) };
}
