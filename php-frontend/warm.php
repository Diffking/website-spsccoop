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

$force = in_array('--force', $argv ?? [], true);
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
