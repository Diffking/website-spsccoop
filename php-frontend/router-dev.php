<?php
/**
 * ใช้เฉพาะตอนทดสอบในเครื่องด้วย php -S เท่านั้น
 * (บนโฮสต์จริงใช้ .htaccess ทำหน้าที่นี้ ไม่ต้องอัปไฟล์นี้ขึ้นไป)
 *
 * ไฟล์ที่มีอยู่จริง เช่น purge.php ให้เซิร์ฟเวอร์จัดการเอง ที่เหลือส่งเข้า index.php
 */
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
$file = __DIR__ . $path;
if ($path !== '/' && is_file($file)) {
    return false;
}
require __DIR__ . '/index.php';
