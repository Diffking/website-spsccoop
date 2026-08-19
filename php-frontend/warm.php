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
if ($json !== false) {
    $data = json_decode($json, true);
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

echo "อุ่นแคชแล้ว: สำเร็จ $ok · ข้าม $skip · ไม่สำเร็จ $fail (ทั้งหมด " . count($paths) . " หน้า)\n";
