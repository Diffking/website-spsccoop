<?php
/**
 * อุ่นแคช — ไล่ดึงทุกหน้ามาเก็บไว้ล่วงหน้า ตั้ง cron ให้รันคืนละครั้ง
 * ประโยชน์คือถ้าหลังบ้านดับยาว ๆ ทุกหน้ายังมีของในแคชให้เสิร์ฟครบ
 *
 *   php warm.php            อุ่นเฉพาะที่ยังไม่มีหรือหมดอายุ
 *   php warm.php --force    ดึงใหม่ทุกหน้า
 */

declare(strict_types=1);

$config = require __DIR__ . '/config.php';
require __DIR__ . '/lib/mirror.php';

/*
 * เรียกผ่านเว็บได้ด้วย (cron ของโฮสต์บางเจ้าสั่งได้แค่ผ่าน URL) แต่ต้องมีรหัส
 * ไม่งั้นใครก็สั่งให้โฮสต์ไล่ดึงทั้งเว็บรัว ๆ ได้ กลายเป็นช่องกลั่นแกล้ง
 *
 *   php warm.php --force
 *   https://www.spsccoop.com/warm.php?token=รหัส&force=1
 */
if (PHP_SAPI !== 'cli') {
    header('Content-Type: text/plain; charset=utf-8');
    if (!hash_equals((string) $config['purge_token'], (string) ($_GET['token'] ?? ''))) {
        http_response_code(403);
        echo 'รหัสไม่ถูกต้อง';
        exit;
    }
}

$force = in_array('--force', $argv ?? [], true) || !empty($_GET['force']);
/*
 * ตอนอุ่นแคชใช้กติกาคนละชุดกับตอนคนเปิดเว็บ
 *
 * timeout สั้น ๆ มีไว้กันคนอ่านเว็บนั่งรอ แต่ตอนอุ่นไม่มีใครรออยู่ ไฟล์ PDF หลายเมกะไบต์
 * ต้องการเวลามากกว่านั้น · และห้ามใช้กลไก "จำว่าหลังบ้านดับ" เพราะพลาดไฟล์เดียว
 * ที่เหลือทั้งชุดจะถูกข้ามหมดทันที (เจอมาแล้ว: สำเร็จ 32 ไม่สำเร็จ 437)
 */
/** แฟ้มบันทึกว่าอุ่นครั้งล่าสุดเมื่อไหร่ ได้ผลอย่างไร — หลังบ้านเอาไปโชว์ */
$stampFile = $config['cache_dir'] . '/.last-warm.json';

/** อ่านของเดิมไว้ก่อน จะได้ไม่ทับเวลารอบอัตโนมัติล่าสุดตอนเจ้าหน้าที่กดเอง */
$previous = is_file($stampFile)
    ? (array) json_decode((string) file_get_contents($stampFile), true)
    : [];

/*
 * โหมดรายงานสถานะ: ?status=1 — ตอบว่าอุ่นล่าสุดเมื่อไหร่ และตอนนี้เก็บอะไรไว้บ้าง
 * หลังบ้านเรียกมาโชว์ในหน้า "สำเนาหน้าเว็บบนโฮสต์" จะได้ไม่ต้องเดาว่าระบบยังทำงานอยู่ไหม
 */
if (!empty($_GET['status'])) {
    $pages = $files = 0;
    $bytes = 0;
    foreach (glob($config['cache_dir'] . '/*.json') ?: [] as $meta) {
        $info = json_decode((string) file_get_contents($meta), true);
        $body = substr($meta, 0, -5) . '.bin';
        $files++;
        $bytes += (int) @filesize($body);
        if (str_contains((string) ($info['type'] ?? ''), 'html')) {
            $pages++;
        }
    }
    $last = is_file($stampFile)
        ? json_decode((string) file_get_contents($stampFile), true)
        : null;

    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'ok' => true,
        'last' => is_array($last) ? $last : null,
        'cache' => ['pages' => $pages, 'items' => $files, 'bytes' => $bytes],
        'now' => time(),
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

/*
 * ใครสั่งอุ่นรอบนี้ — ตัวตั้งเวลาที่เดินทุกชั่วโมง หรือเจ้าหน้าที่กดปุ่มเอง
 * ต้องแยกให้ออก ไม่งั้นหลังบ้านจะบอกไม่ได้ว่า "ระบบอัตโนมัติยังเดินอยู่ไหม"
 * (กดเองรัวๆ แล้วเห็นเวลาขยับ ไม่ได้แปลว่าตัวตั้งเวลายังทำงาน)
 */
$by = ($_GET['by'] ?? '') === 'auto' ? 'auto' : (PHP_SAPI === 'cli' ? 'auto' : 'manual');

$startedAt = microtime(true);
$config['timeout'] = (int) ($config['warm_timeout'] ?? 120);
$config['down_ttl'] = 0;

$mirror = new Mirror($config);

// รายชื่อหน้ามาจากหลังบ้านโดยตรง จะได้ไม่ต้องมาไล่แก้ไฟล์นี้ทุกครั้งที่เพิ่มหน้า
$listUrl = $config['backend'] . '/api/public/pages';
$json = @file_get_contents($listUrl);
$paths = ['/'];
$data = [];
if ($json !== false) {
    $data = (array) json_decode($json, true);
    foreach ((array) ($data['paths'] ?? []) as $p) {
        if (is_string($p)) {
            $paths[] = $p;
        }
    }
}
$paths = array_values(array_unique($paths));

$ok = $fail = $skip = 0;
foreach ($paths as $path) {
    $cached = $mirror->cached($path);
    if (!$force && $cached !== null && $cached['age'] < $config['ttl_page']) {
        $skip++;
        continue;
    }
    if ($mirror->fetch($path) !== null) {
        $ok++;
    } else {
        $fail++;
    }
}

echo "อุ่นหน้าเว็บ: สำเร็จ $ok · ข้าม $skip · ไม่สำเร็จ $fail (ทั้งหมด " . count($paths) . " หน้า)
";

if (empty($config['warm_assets'])) {
    file_put_contents($stampFile, json_encode([
        'time' => time(),
        'seconds' => round(microtime(true) - $startedAt, 1),
        'pages' => ['ok' => $ok, 'skip' => $skip, 'fail' => $fail, 'total' => count($paths)],
        'assets' => null,
        'bytes' => 0,
        'by' => $by,
        'auto_time' => $by === 'auto' ? time() : ($previous['auto_time'] ?? null),
    ], JSON_UNESCAPED_UNICODE));
    exit;
}

/*
 * อุ่นของที่หน้าเว็บต้องใช้ด้วย — รูป ไฟล์แนบ ไฟล์ประกอบเว็บ (สคริปต์/สไตล์)
 *
 * ถ้าอุ่นแต่ตัวหน้า พอเครื่องที่สำนักงานปิด คนเปิดเว็บจะได้หน้าที่รูปแตกและปุ่มกดไม่ทำงาน
 * เพราะของพวกนั้นยังต้องวิ่งไปเอาจากหลังบ้านอยู่
 *
 * ที่อยู่ของพวกนี้อ่านเอาจาก HTML ที่เพิ่งอุ่นไว้ ไม่ต้องมีใครมาไล่พิมพ์รายการเอง
 */
$assets = [];
foreach ($paths as $path) {
    $item = $mirror->cached($path);
    if ($item === null || !str_contains((string) $item['type'], 'html')) {
        continue;
    }
    $html = (string) file_get_contents($item['file']);
    if (preg_match_all('~(?:href|src)="(/[^"#]+)"~i', $html, $m)) {
        foreach ($m[1] as $url) {
            $url = html_entity_decode($url, ENT_QUOTES | ENT_HTML5, 'UTF-8');
            if ($mirror->isAsset($url)) {
                $assets[$url] = true;
            }
        }
    }
}
/*
 * ของที่หลังบ้านบอกมาเองว่าต้องเก็บด้วย (ตัวถอดรหัส PDF ของตัวอ่านหนังสือ)
 * พวกนี้ไม่ได้เขียนไว้ใน HTML หน้าไหน หาจากการอ่าน HTML อย่างเดียวไม่เจอ
 */
foreach ((array) ($data['assets'] ?? []) as $extra) {
    if (is_string($extra) && str_starts_with($extra, '/')) {
        $assets[$extra] = true;
    }
}

$assets = array_keys($assets);

$budget = (int) ($config['warm_budget_mb'] ?? 500) * 1048576;
$aOk = $aFail = $aSkip = 0;
$seen = [];
$bytes = 0;
foreach ($assets as $url) {
    if ($bytes >= $budget) {
        break;
    }
    $cached = $mirror->cached($url);
    if (!$force && $cached !== null && $cached['age'] < $config['ttl_asset']) {
        $aSkip++;
        continue;
    }
    $got = $mirror->fetch($url);
    if ($got === null) {
        $aFail++;
        continue;
    }
    $aOk++;
    $bytes += (int) @filesize($got['file']);

    /*
     * หลังบ้านตอบว่า "ที่อยู่จริงอยู่ตรงนี้" (เช่น /api/pdf → /api/pdf/) ต้องตามไปอุ่นด้วย
     * ไม่งั้นตอนเครื่องที่สำนักงานปิด เบราว์เซอร์ตามที่อยู่ไปแล้วเจอของว่าง เปิดไฟล์ไม่ได้
     */
    $hop = (string) ($got['extra']['location'] ?? '');
    if ($got['status'] >= 300 && $got['status'] < 400 && str_starts_with($hop, '/')
        && !isset($seen[$hop])) {
        $seen[$hop] = true;
        $next = $mirror->fetch($hop);
        if ($next !== null) {
            $aOk++;
            $bytes += (int) @filesize($next['file']);
        }
    }
}

printf(
    "อุ่นไฟล์ประกอบ: สำเร็จ %d · ข้าม %d · ไม่สำเร็จ %d (เจอ %d รายการ · โหลดมา %.1f MB)
",
    $aOk, $aSkip, $aFail, count($assets), $bytes / 1048576
);

file_put_contents($stampFile, json_encode([
    'time' => time(),
    'seconds' => round(microtime(true) - $startedAt, 1),
    'pages' => ['ok' => $ok, 'skip' => $skip, 'fail' => $fail, 'total' => count($paths)],
    'assets' => ['ok' => $aOk, 'skip' => $aSkip, 'fail' => $aFail, 'total' => count($assets)],
    'bytes' => $bytes,
    'by' => $by,
    'auto_time' => $by === 'auto' ? time() : ($previous['auto_time'] ?? null),
], JSON_UNESCAPED_UNICODE));
