<?php
/**
 * ล้างแคชของหน้าที่เพิ่งแก้ — หลังบ้านเรียกไฟล์นี้หลังกดบันทึก
 * เนื้อหาใหม่จะขึ้นเว็บทันทีโดยไม่ต้องรอหมดอายุ
 *
 *   POST /purge.php   {"token":"...","paths":["/about/history/","/"]}
 *   POST /purge.php   {"token":"...","all":true}         ล้างเฉพาะหน้าเว็บ
 *   POST /purge.php   {"token":"...","everything":true}  ล้างรูปกับไฟล์แนบด้วย
 */

declare(strict_types=1);

$config = require __DIR__ . '/config.php';
require __DIR__ . '/lib/mirror.php';

header('Content-Type: application/json; charset=utf-8');

$body = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($body) || !hash_equals((string) $config['purge_token'], (string) ($body['token'] ?? ''))) {
    http_response_code(403);
    echo json_encode(['error' => 'รหัสไม่ถูกต้อง'], JSON_UNESCAPED_UNICODE);
    exit;
}

$mirror = new Mirror($config);

// everything = ล้างรูปกับไฟล์แนบด้วย (ใช้เฉพาะตอนอยากเริ่มใหม่หมดจริง ๆ)
if (!empty($body['all']) || !empty($body['everything'])) {
    echo json_encode(
        ['purged' => $mirror->purgeAll(empty($body['everything']))],
        JSON_UNESCAPED_UNICODE
    );
    exit;
}

$done = 0;
foreach ((array) ($body['paths'] ?? []) as $path) {
    if (is_string($path) && $path !== '' && $mirror->purge($path)) {
        $done++;
    }
}
echo json_encode(['purged' => $done], JSON_UNESCAPED_UNICODE);
