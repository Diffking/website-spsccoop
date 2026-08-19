<?php
/**
 * ล้างแคชของหน้าที่เพิ่งแก้ — หลังบ้านเรียกไฟล์นี้หลังกดบันทึก
 * เนื้อหาใหม่จะขึ้นเว็บทันทีโดยไม่ต้องรอหมดอายุ
 *
 *   POST /purge.php   {"token":"...","paths":["/about/history/","/"]}
 *   POST /purge.php   {"token":"...","all":true}
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

if (!empty($body['all'])) {
    echo json_encode(['purged' => $mirror->purgeAll()], JSON_UNESCAPED_UNICODE);
    exit;
}

$done = 0;
foreach ((array) ($body['paths'] ?? []) as $path) {
    if (is_string($path) && $path !== '' && $mirror->purge($path)) {
        $done++;
    }
}
echo json_encode(['purged' => $done], JSON_UNESCAPED_UNICODE);
