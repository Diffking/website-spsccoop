<?php
/**
 * กล่องพักคำตอบแบบประเมิน — ให้สมาชิกส่งคำตอบได้ตอนเครื่องสำนักงานปิด
 *
 *   เครื่องปิด:  POST /api/survey/<code>/queue/ ส่งต่อไม่ได้ → ล็อกด้วยกุญแจของหลังบ้าน → พักใน MySQL
 *   เครื่องเปิด: ทยอยส่งรายการที่พักไว้ไปหลังบ้าน (หลังตอบหน้าเว็บให้คนอ่านเสร็จ / ตอนอุ่นแคช)
 *               หลังบ้านรับแล้ว (2xx) = ลบทิ้ง · ปฏิเสธถาวร (4xx) = เก็บไว้ไม่ส่งซ้ำ · ล่ม = ลองใหม่ทีหลัง
 *
 * **โฮสต์อ่านคำตอบที่พักไว้ไม่ได้** — มีแค่กุญแจสาธารณะ (ล็อกได้อย่างเดียว) กุญแจไขอยู่ที่หลังบ้าน
 * เข้ารหัสเนื้อหาด้วย AES-256-GCM แล้วล็อกกุญแจ AES ด้วย RSA-OAEP (ดู src/lib/surveyQueue.ts)
 *
 * ⚠️ ทิศทางเดียวที่ไฟล์นี้ยิงคือ โฮสต์ → หลังบ้าน (ผ่าน Cloudflare) ไม่เพิ่มทางให้ไอพีสำนักงานแตะโฮสต์
 *
 * ค่าตั้งอยู่ใน config.php → 'survey_queue' (คัดลอกได้จากหลังบ้าน → แบบประเมิน) ไม่ตั้ง = ปิดตัวเอง
 */

declare(strict_types=1);

final class SurveyQueue
{
    /** เพดานกันขยะ — ตอนเครื่องปิดไม่มีหลังบ้านมาช่วยกรอง */
    private const PER_IP_HOUR = 10;
    private const MAX_ITEMS = 5000;
    private const MAX_BODY = 65536;

    private ?PDO $pdo = null;

    public function __construct(private array $config)
    {
    }

    private function q(): array
    {
        return (array) ($this->config['survey_queue'] ?? []);
    }

    public function enabled(): bool
    {
        $q = $this->q();
        return !empty($q['token']) && !empty($q['public_key']) && !empty($q['db']['name']);
    }

    public static function isQueuePath(string $path): bool
    {
        return (bool) preg_match('#^/api/survey/[a-z0-9]{4,12}/queue/?$#', $path);
    }

    /** ป้าย "มีของค้างในกล่อง" — เช็คไฟล์แทนการต่อ MySQL ทุกครั้งที่มีคนเปิดหน้าเว็บ */
    private function mark(): string
    {
        return rtrim((string) $this->config['cache_dir'], '/') . '/.survey-queue';
    }

    private function db(): PDO
    {
        if ($this->pdo) {
            return $this->pdo;
        }
        $d = $this->q()['db'];
        $this->pdo = new PDO(
            sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $d['host'] ?? 'localhost', $d['name']),
            (string) ($d['user'] ?? ''),
            (string) ($d['pass'] ?? ''),
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 3],
        );
        $this->pdo->exec(
            'CREATE TABLE IF NOT EXISTS survey_queue (
                id CHAR(32) NOT NULL PRIMARY KEY,
                path VARCHAR(255) NOT NULL,
                sealed MEDIUMTEXT NOT NULL,
                ip_hash CHAR(64) NOT NULL,
                queued_at INT NOT NULL,
                tries INT NOT NULL DEFAULT 0,
                next_try INT NOT NULL DEFAULT 0,
                dead TINYINT NOT NULL DEFAULT 0,
                last_error VARCHAR(255) NULL,
                KEY due (dead, next_try),
                KEY ip (ip_hash, queued_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );
        return $this->pdo;
    }

    /** ล็อกเนื้อหาด้วยกุญแจสาธารณะของหลังบ้าน — คืน null ถ้าทำไม่ได้ */
    private function seal(string $plain): ?array
    {
        $key = random_bytes(32);
        $iv = random_bytes(12);
        $tag = '';
        $data = openssl_encrypt($plain, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
        $locked = '';
        if ($data === false || !openssl_public_encrypt($key, $locked, (string) $this->q()['public_key'], OPENSSL_PKCS1_OAEP_PADDING)) {
            return null;
        }
        return [
            'k' => base64_encode($locked),
            'iv' => base64_encode($iv),
            'tag' => base64_encode($tag),
            'data' => base64_encode($data),
        ];
    }

    /**
     * พักคำตอบหนึ่งรายการ — คืน [รหัส HTTP, ข้อความตอบสมาชิก]
     * ไม่ตรวจคำตอบที่นี่ (โฮสต์อ่านแบบประเมินไม่ออก) หลังบ้านตรวจเองตอนรับ
     */
    public function store(string $path, string $body, string $ip): array
    {
        if (strlen($body) === 0 || strlen($body) > self::MAX_BODY || json_decode($body) === null) {
            return [400, ['error' => 'ข้อมูลไม่ถูกต้อง']];
        }
        try {
            $db = $this->db();
            $ipHash = hash('sha256', $ip . '|' . $this->q()['token']);   // ไม่เก็บไอพีจริง

            $st = $db->prepare('SELECT COUNT(*) FROM survey_queue WHERE ip_hash = ? AND queued_at > ?');
            $st->execute([$ipHash, time() - 3600]);
            if ((int) $st->fetchColumn() >= self::PER_IP_HOUR) {
                return [429, ['error' => 'ส่งหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่']];
            }
            if ((int) $db->query('SELECT COUNT(*) FROM survey_queue WHERE dead = 0')->fetchColumn() >= self::MAX_ITEMS) {
                return [503, ['error' => 'ระบบรับคำตอบเต็มชั่วคราว กรุณาลองใหม่ในเวลาทำการ']];
            }

            $sealed = $this->seal($body);
            if ($sealed === null) {
                return [503, ['error' => 'ระบบรับคำตอบขัดข้อง กรุณาลองใหม่ในเวลาทำการ']];
            }
            $db->prepare('INSERT INTO survey_queue (id, path, sealed, ip_hash, queued_at) VALUES (?, ?, ?, ?, ?)')
                ->execute([bin2hex(random_bytes(16)), $path, json_encode($sealed), $ipHash, time()]);
            @touch($this->mark());
            return [200, ['ok' => true, 'queued' => true, 'host' => true]];
        } catch (Throwable $e) {
            error_log('survey_queue store: ' . $e->getMessage());
            return [503, ['error' => 'ระบบรับคำตอบขัดข้อง กรุณาลองใหม่ในเวลาทำการ']];
        }
    }

    /**
     * ส่งรายการที่พักไว้ไปหลังบ้าน — เรียกได้บ่อย จะทำงานจริงเมื่อมีของค้างและห่างจากรอบก่อนเกิน 60 วินาที
     * คืนสรุป [ส่งแล้ว, ค้าง] หรือ null ถ้าไม่ได้ทำ
     */
    public function flush(int $limit = 20, bool $force = false): ?array
    {
        // force (ตอนอุ่นแคช) ไม่เชื่อป้าย — เผื่อป้ายหายไปกับการล้างโฟลเดอร์ cache แล้วของค้างในกล่องตลอดไป
        if (!$this->enabled() || (!$force && !is_file($this->mark()))) {
            return null;
        }
        $lock = fopen($this->mark() . '.lock', 'c');
        if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) {
            return null;   // อีกคำขอกำลังส่งอยู่
        }
        $stamp = $this->mark() . '.last';
        if (!$force && is_file($stamp) && time() - (int) filemtime($stamp) < 60) {
            flock($lock, LOCK_UN);
            return null;
        }
        @touch($stamp);

        $sent = 0;
        try {
            $db = $this->db();
            $st = $db->prepare('SELECT id, path, sealed, queued_at, tries FROM survey_queue WHERE dead = 0 AND next_try <= ? ORDER BY queued_at LIMIT ' . (int) $limit);
            $st->execute([time()]);
            foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $ch = curl_init($this->config['backend'] . $row['path']);
                curl_setopt_array($ch, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_POST => true,
                    CURLOPT_POSTFIELDS => json_encode(['sealed' => json_decode($row['sealed'], true)]),
                    CURLOPT_TIMEOUT => 8,
                    CURLOPT_CONNECTTIMEOUT => 5,
                    CURLOPT_USERAGENT => 'spsccoop-mirror/1.0 survey-queue',
                    CURLOPT_HTTPHEADER => [
                        'Content-Type: application/json',
                        'X-Queue-Token: ' . $this->q()['token'],
                        'X-Queue-Id: ' . $row['id'],
                        'X-Queued-At: ' . $row['queued_at'],
                    ],
                ]);
                $out = curl_exec($ch);
                $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
                curl_close($ch);

                if ($code >= 200 && $code < 300) {
                    $db->prepare('DELETE FROM survey_queue WHERE id = ?')->execute([$row['id']]);
                    $sent++;
                } elseif ($code >= 400 && $code < 500 && $code !== 429) {
                    // หลังบ้านปฏิเสธถาวร (ปิดรับแล้ว · ข้อมูลไม่ครบ) ส่งซ้ำก็ไม่ผ่าน — เก็บไว้ดูย้อนหลัง
                    $db->prepare('UPDATE survey_queue SET dead = 1, last_error = ? WHERE id = ?')
                        ->execute([substr((string) $out, 0, 250), $row['id']]);
                } else {
                    $tries = (int) $row['tries'] + 1;
                    $db->prepare('UPDATE survey_queue SET tries = ?, next_try = ?, last_error = ? WHERE id = ?')
                        ->execute([$tries, time() + min(3600, 60 * (2 ** min($tries, 6))), 'HTTP ' . $code, $row['id']]);
                    if ($code === 0 || $code >= 500) {
                        break;   // หลังบ้านยังไม่พร้อม ไม่ต้องลองรายการที่เหลือในรอบนี้
                    }
                }
            }
            $left = (int) $db->query('SELECT COUNT(*) FROM survey_queue WHERE dead = 0')->fetchColumn();
            if ($left === 0) {
                @unlink($this->mark());
            }
            return [$sent, $left];
        } catch (Throwable $e) {
            error_log('survey_queue flush: ' . $e->getMessage());
            return null;
        } finally {
            flock($lock, LOCK_UN);
        }
    }
}
