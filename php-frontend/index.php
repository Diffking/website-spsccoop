<?php
/**
 * ประตูหน้าเว็บบนโฮสต์ — ทุกคำขอเข้ามาที่ไฟล์นี้ (ดู .htaccess)
 *
 * ลำดับการทำงาน: ของในแคชยังสดใช้เลย → หมดอายุไปเอาของใหม่ →
 * หลังบ้านไม่ตอบก็ใช้ของเก่าต่อ → ไม่เคยมีของเลยค่อยขึ้นหน้าแจ้งปรับปรุง
 */

declare(strict_types=1);

$config = require __DIR__ . '/config.php';
require __DIR__ . '/lib/mirror.php';
require __DIR__ . '/lib/queue.php';

$mirror = new Mirror($config);
$queue = new SurveyQueue($config);
$path = $mirror->path();

// หลังบ้านไม่ให้ผ่านทางนี้เด็ดขาด
if ($mirror->blocked($path)) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'ไม่พบหน้านี้';
    exit;
}

/*
 * คำขอที่ไม่ใช่การอ่าน (เช่น นับสถิติผู้เข้าชม) ส่งต่อให้หลังบ้านตรง ๆ ไม่เก็บแคช
 * หลังบ้านดับก็ตอบ 204 ให้จบ ๆ ไป หน้าเว็บจะได้ไม่ค้างรอ
 */
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    /*
     * บอกหลังบ้านว่าใครเป็นคนกดจริง
     *
     * คำขอเดินทางสองต่อ (เบราว์เซอร์ → โฮสต์นี้ → หลังบ้าน) หลังบ้านจึงเห็นแต่ไอพีของโฮสต์
     * ไม่บอกไป คนทั้งเว็บจะถูกนับรวมเป็นคนเดียวกัน ยอด "จำนวนคน" ค้างที่ 1 คนต่อวัน
     * ส่วน x-public-host บอกว่าคนอ่านเปิดโดเมนไหนอยู่ — หลังบ้านนับเฉพาะโดเมนสาธารณะ
     *
     * ล้างอักขระแปลกออกก่อนส่ง ค่าพวกนี้มาจากคำขอของคนนอก ถ้ามีขึ้นบรรทัดใหม่ปนมา
     * จะกลายเป็นการแทรกหัวคำขอปลอมเข้าไปในคำขอที่เราส่งต่อ
     */
    $visitorIp = preg_replace('/[^0-9a-fA-F.:]/', '', (string) ($_SERVER['REMOTE_ADDR'] ?? ''));
    $visitorAgent = substr(preg_replace('/[^\x20-\x7E]/', '', (string) ($_SERVER['HTTP_USER_AGENT'] ?? '')), 0, 200);
    $contentType = preg_replace('/[^\x20-\x7E]/', '', (string) ($_SERVER['CONTENT_TYPE'] ?? '')) ?: 'application/json';
    $input = (string) file_get_contents('php://input');

    /*
     * ฝากคำตอบแบบประเมิน — หลังบ้านไม่พร้อม (เครื่องสำนักงานปิด) ให้พักไว้ในกล่องแทน
     * แล้วตอบสมาชิกว่า "ได้รับแล้ว" · เพิ่งรู้ว่าหลังบ้านดับ (ป้าย down) ไม่ต้องลองส่งให้รอ 5 วินาที
     * ดู lib/queue.php
     */
    $queueable = SurveyQueue::isQueuePath($path) && $queue->enabled();
    $reply = static function (int $code, array $body): void {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($body, JSON_UNESCAPED_UNICODE);
        exit;
    };
    if ($queueable && $mirror->backendDown()) {
        [$code, $body] = $queue->store($path, $input, $visitorIp);
        $reply($code, $body);
    }

    $ch = curl_init($config['backend'] . $path);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $input,
        CURLOPT_USERAGENT => $visitorAgent === '' ? 'unknown' : $visitorAgent,
        CURLOPT_HTTPHEADER => [
            'Content-Type: ' . $contentType,
            'X-Public-Host: ' . ($config['public_host'] ?? 'www.spsccoop.com'),
            'X-Visitor-Ip: ' . ($visitorIp === '' ? 'unknown' : $visitorIp),
        ],
        CURLOPT_TIMEOUT => 5,
    ]);
    $out = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);

    /*
     * ส่งไม่ถึง หรือได้ 5xx กลับมา (เครื่องปิด Cloudflare ตอบ 530/502 เป็นหน้า HTML) — พักไว้แทน
     * หลังบ้านเองไม่ตอบ 5xx กับคำตอบที่ฝาก (ดู route queue) จึงไม่มีทางพักซ้ำของที่รับไปแล้ว
     */
    if ($queueable && ($out === false || $code === 0 || $code >= 500)) {
        [$qcode, $qbody] = $queue->store($path, $input, $visitorIp);
        $reply($qcode, $qbody);
    }

    http_response_code($code ?: 204);
    header('Content-Type: application/json; charset=utf-8');
    echo $out === false ? '' : $out;
    exit;
}

$ttl = $mirror->isAsset($path) ? $config['ttl_asset'] : $config['ttl_page'];
$cached = $mirror->cached($path);

// ไม่เคยเก็บที่อยู่นี้ไว้ แต่ไฟล์เดียวกันอาจถูกเก็บไว้ในอีกชื่อหนึ่ง (ดู aliasOf)
if ($cached === null) {
    $alias = $mirror->aliasOf($path);
    if ($alias !== null) {
        $cached = $mirror->cached($alias);
    }
}

// ยังสดอยู่ ใช้ได้เลย ไม่ต้องรบกวนหลังบ้าน
if ($cached !== null && $cached['age'] < $ttl) {
    $mirror->send($cached, 'hit');
    exit;
}

$fresh = $mirror->fetch($path);
if ($fresh !== null) {
    $mirror->send($fresh, $cached === null ? 'miss' : 'refresh');
    /*
     * หลังบ้านตอบได้ = เครื่องสำนักงานเปิดแล้ว — ส่งคำตอบแบบประเมินที่พักไว้ตามไป
     * ปิดการเชื่อมต่อกับคนอ่านก่อน (PHP-FPM) จะได้ไม่ต้องรอ · ไม่มีของค้าง = ไม่แตะ MySQL เลย
     */
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    }
    $queue->flush(10);
    exit;
}

// หลังบ้านไม่ตอบ — ของเก่ายังดีกว่าไม่มีอะไรเลย
if ($cached !== null) {
    $mirror->send($cached, 'stale');
    exit;
}

// ไม่เคยเก็บหน้านี้ไว้เลย และหลังบ้านก็ไม่ตอบ
http_response_code(503);
header('Content-Type: text/html; charset=utf-8');
header('Retry-After: 300');
readfile(__DIR__ . '/offline.html');
