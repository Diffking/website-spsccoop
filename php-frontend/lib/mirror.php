<?php

// ไฟล์นี้เป็นไลบรารี ไม่ได้ให้เปิดตรง ๆ
if (PHP_SAPI !== 'cli' && realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === __FILE__) {
    http_response_code(404);
    exit;
}
/**
 * ตัวมิเรอร์เว็บ — ดึงหน้าเว็บที่หลังบ้านสร้างเสร็จแล้วมาเก็บไว้ แล้วเสิร์ฟจากของที่เก็บ
 *
 * จุดสำคัญคือ "หลังบ้านดับ เว็บต้องไม่ดับ" — ถ้าดึงของใหม่ไม่ได้ ให้เสิร์ฟของเก่าที่เก็บไว้
 * ต่อไปเรื่อย ๆ คนอ่านเว็บจะไม่รู้เลยว่าเครื่องที่สำนักงานปิดอยู่
 *
 * ไม่ได้วาดหน้าเว็บเองสักบรรทัด — รับ HTML ที่เสร็จแล้วมาเสิร์ฟต่อ
 * ของใหม่ที่เพิ่มในหลังบ้านจึงตามมาเองโดยไม่ต้องแก้ไฟล์นี้
 */

final class Mirror
{
    public function __construct(private array $config)
    {
        if (!is_dir($this->config['cache_dir'])) {
            @mkdir($this->config['cache_dir'], 0775, true);
        }
    }

    /** ที่อยู่ที่ขอมา รวมพารามิเตอร์ท้าย URL (ต่างพารามิเตอร์ = คนละหน้า) */
    public function path(): string
    {
        $uri = $_SERVER['REQUEST_URI'] ?? '/';
        return '/' . ltrim($uri, '/');
    }

    /** ที่อยู่นี้ห้ามส่งต่อไหม */
    public function blocked(string $path): bool
    {
        foreach ($this->config['blocked'] as $prefix) {
            if (str_starts_with($path, $prefix)) {
                return true;
            }
        }
        return false;
    }

    /** ไฟล์แนบ/รูป/ไฟล์ประกอบเว็บ — เก็บได้นานกว่าหน้าเว็บ */
    public function isAsset(string $path): bool
    {
        // ตัดพารามิเตอร์ท้ายที่อยู่ก่อนดูนามสกุล — Next ต่อรหัสรุ่นไว้ เช่น /icon.png?9a3f
        $path = strtok($path, '?') ?: $path;

        return str_starts_with($path, '/uploads/')
            || str_starts_with($path, '/_next/')
            || str_starts_with($path, '/api/pdf')
            || str_starts_with($path, '/api/ebook')
            || preg_match('#\.(ico|png|jpe?g|webp|gif|svg|css|js|woff2?|pdf)$#i', $path) === 1;
    }

    /**
     * ที่อยู่สำรองของไฟล์เดียวกัน — ใช้ตอนหลังบ้านปิดแล้วยังไม่เคยเก็บที่อยู่นี้ไว้
     *
     * ตัวอ่านหนังสือในเว็บสร้างที่อยู่ /api/pdf/?src=/uploads/xxx.pdf ขึ้นมาตอนกดอ่าน
     * ที่อยู่นี้ไม่ปรากฏใน HTML ตัวอุ่นแคชจึงมองไม่เห็นและเก็บไว้ไม่ได้
     * แต่ไฟล์ตัวเดียวกันถูกเก็บไว้แล้วในชื่อ /uploads/xxx.pdf — ยกตัวนั้นให้แทนได้เลย
     * (ไม่ต้องเก็บซ้ำสองชุดให้เปลืองพื้นที่โฮสต์)
     */
    public function aliasOf(string $path): ?string
    {
        if (!str_starts_with($path, '/api/pdf')) {
            return null;
        }
        $query = parse_url($path, PHP_URL_QUERY);
        if (!is_string($query)) {
            return null;
        }
        parse_str($query, $params);
        $src = (string) ($params['src'] ?? '');
        return str_starts_with($src, '/uploads/') ? $src : null;
    }

    private function key(string $path): string
    {
        return $this->config['cache_dir'] . '/' . sha1($path);
    }

    /** อ่านของในแคช — ไม่มีคืน null */
    public function cached(string $path): ?array
    {
        $meta = $this->key($path) . '.json';
        $body = $this->key($path) . '.bin';
        if (!is_file($meta) || !is_file($body)) {
            return null;
        }
        $info = json_decode((string) file_get_contents($meta), true);
        if (!is_array($info)) {
            return null;
        }
        $info['file'] = $body;
        $info['age'] = time() - ($info['time'] ?? 0);
        return $info;
    }

    /** แฟ้มที่ใช้จำว่า "เพิ่งลองแล้วหลังบ้านไม่ตอบ" */
    private function downMark(): string
    {
        return $this->config['cache_dir'] . '/.backend-down';
    }

    /**
     * หลังบ้านดับอยู่หรือเปล่า (เท่าที่เพิ่งลองมา)
     *
     * เครื่องที่สำนักงานเปิดแค่เวลาทำการ กลางคืนกับเสาร์อาทิตย์จึงติดต่อไม่ได้เป็นปกติ
     * ถ้าปล่อยให้ทุกคำขอไปลองต่อเอง คนอ่านเว็บตอนกลางคืนจะต้องรอครบ timeout ทุกหน้า
     * จำไว้สักพักว่าดับอยู่ แล้วยกของในแคชให้เลย — เร็วเหมือนหลังบ้านเปิดอยู่
     */
    public function backendDown(): bool
    {
        $mark = $this->downMark();
        if (!is_file($mark)) {
            return false;
        }
        if (time() - (int) filemtime($mark) < (int) ($this->config['down_ttl'] ?? 60)) {
            return true;
        }
        @unlink($mark);   // ครบเวลาแล้ว ลองใหม่ได้
        return false;
    }

    /** ไปเอาของใหม่จากหลังบ้าน — ไม่สำเร็จคืน null (ให้คนเรียกไปใช้ของเก่า) */
    public function fetch(string $path): ?array
    {
        // เพิ่งลองแล้วไม่ตอบ ไม่ต้องลองซ้ำให้คนอ่านเว็บรอ
        if ($this->backendDown()) {
            return null;
        }

        $url = $this->config['backend'] . $path;
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HEADER => true,
            CURLOPT_TIMEOUT => $this->config['timeout'],
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_ENCODING => '',
            // บอกหลังบ้านว่าใครขอมา เผื่อต้องไล่ปัญหาย้อนหลัง
            CURLOPT_USERAGENT => 'spsccoop-mirror/1.0',
            /*
             * บอกหลังบ้านว่าหน้านี้จะถูกเอาไปเสิร์ฟในนามโดเมนไหน
             *
             * เราไปดึงจาก spsccoop.org แต่คนที่อ่านจริงเปิด www.spsccoop.com อยู่
             * ถ้าไม่บอก หลังบ้านจะนึกว่านี่คือโดเมนสำรอง แล้วติดป้ายห้ามกูเกิลเก็บมาให้ทั้งเว็บ
             */
            CURLOPT_HTTPHEADER => [
                'Accept-Language: th',
                'X-Public-Host: ' . ($this->config['public_host'] ?? 'www.spsccoop.com'),
            ],
        ]);
        $raw = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        curl_close($ch);

        if ($raw === false || $status === 0) {
            @touch($this->downMark());   // จำไว้ว่าดับ คำขอถัดไปจะได้ไม่ต้องรอ
            return null;
        }
        @unlink($this->downMark());      // ตอบแล้ว = กลับมาแล้ว
        // หลังบ้านตอบว่าไม่มีหน้านี้/พัง — ไม่เอามาทับของเก่าที่ยังใช้ได้
        if ($status >= 500) {
            return null;
        }

        $head = substr($raw, 0, $headerSize);
        $body = substr($raw, $headerSize);
        $type = 'text/html; charset=utf-8';
        if (preg_match('/^content-type:\s*(.+)$/im', $head, $m)) {
            $type = trim($m[1]);
        }

        /*
         * หัวอื่นที่ต้องส่งต่อด้วย ไม่งั้นบางอย่างพัง:
         * location — หลังบ้านตอบ 308 พาไปที่อยู่ที่มี / ปิดท้าย (ตัวอ่าน PDF เจอเข้าไปเปิดไฟล์ไม่ได้เลย)
         * content-disposition — ชื่อไฟล์ตอนกดดาวน์โหลด
         */
        $extra = [];
        foreach (['location', 'content-disposition'] as $name) {
            if (preg_match('/^' . $name . ':\s*(.+)$/im', $head, $m)) {
                $extra[$name] = trim($m[1]);
            }
        }

        $info = ['status' => $status, 'type' => $type, 'time' => time(), 'extra' => $extra];
        file_put_contents($this->key($path) . '.bin', $body);
        file_put_contents($this->key($path) . '.json', json_encode($info, JSON_UNESCAPED_UNICODE));

        $info['file'] = $this->key($path) . '.bin';
        $info['age'] = 0;
        return $info;
    }

    /** ส่งของที่มีให้เบราว์เซอร์ รองรับขอเป็นช่วง (ตัวอ่าน PDF ใช้) */
    public function send(array $item, string $state): void
    {
        $size = (int) filesize($item['file']);
        header('Content-Type: ' . $item['type']);
        header('X-Mirror: ' . $state);

        /*
         * บอกเบราว์เซอร์ให้ชัดว่าเก็บของไว้เองได้แค่ไหน
         *
         * ไม่บอกอะไรเลย เบราว์เซอร์จะเดาเอง (มักเดาจาก Last-Modified แล้วเก็บไว้เป็นชั่วโมง)
         * เจ้าหน้าที่แก้เนื้อหาแล้วสำเนาบนโฮสต์ใหม่แล้วก็จริง แต่เครื่องคนอ่านยังโชว์ของเก่า
         * แล้วสรุปว่าระบบไม่อัปเดต — เจอมาแล้ว
         *
         * หน้าเว็บ: ให้ถามใหม่ทุกครั้ง (ถามมาก็ตอบจากสำเนาบนโฮสต์ ไม่ได้ไปกวนเครื่องที่สำนักงาน)
         * รูป/ไฟล์แนบ/ไฟล์ประกอบ: ชื่อไฟล์เป็นรหัสไม่ซ้ำอยู่แล้ว เปลี่ยนไฟล์ = เปลี่ยนชื่อ
         *   เก็บไว้ยาว ๆ ได้ เว็บจะได้เร็วและไม่กินเน็ตของโฮสต์
         */
        if (str_contains((string) $item['type'], 'html')) {
            header('Cache-Control: no-cache, must-revalidate');
        } else {
            header('Cache-Control: public, max-age=604800');
        }
        header('Accept-Ranges: bytes');

        foreach ((array) ($item['extra'] ?? []) as $name => $value) {
            header(ucfirst($name) . ': ' . $value);
        }

        // คำตอบประเภทพาไปที่อยู่อื่น ไม่มีเนื้อหาให้ส่ง จบตรงนี้
        if ($item['status'] >= 300 && $item['status'] < 400) {
            http_response_code($item['status']);
            return;
        }

        $range = $_SERVER['HTTP_RANGE'] ?? '';
        if ($range !== '' && preg_match('/bytes=(\d*)-(\d*)/', $range, $m)) {
            $start = $m[1] === '' ? 0 : (int) $m[1];
            $end = $m[2] === '' ? $size - 1 : min((int) $m[2], $size - 1);
            if ($start > $end) {
                http_response_code(416);
                header("Content-Range: bytes */$size");
                return;
            }
            http_response_code(206);
            header("Content-Range: bytes $start-$end/$size");
            header('Content-Length: ' . ($end - $start + 1));
            $fh = fopen($item['file'], 'rb');
            fseek($fh, $start);
            echo fread($fh, $end - $start + 1);
            fclose($fh);
            return;
        }

        http_response_code($item['status']);
        header('Content-Length: ' . $size);
        readfile($item['file']);
    }

    /** ลบของในแคชของที่อยู่นี้ */
    public function purge(string $path): bool
    {
        $ok = false;
        foreach (['.json', '.bin'] as $ext) {
            $file = $this->key($path) . $ext;
            if (is_file($file)) {
                $ok = @unlink($file) || $ok;
            }
        }
        return $ok;
    }

    /**
     * ลบสำเนาหน้าเว็บทั้งหมด — ใช้ตอนหลังบ้านแก้ของที่กระทบทุกหน้า (เมนู หัวเว็บ ค่าตั้ง)
     *
     * ปกติเว้นรูปกับไฟล์แนบไว้ ($pagesOnly) เพราะของพวกนั้นแทบไม่เปลี่ยน แต่รวมกันเป็นสิบ ๆ MB
     * ลบทิ้งทีก็ต้องโหลดใหม่หมดทั้งที่เนื้อไฟล์เหมือนเดิม — เปลืองทั้งเวลาและเน็ตของโฮสต์
     */
    public function purgeAll(bool $pagesOnly = true): int
    {
        $count = 0;
        foreach (glob($this->config['cache_dir'] . '/*.json') ?: [] as $meta) {
            if ($pagesOnly) {
                $info = json_decode((string) file_get_contents($meta), true);
                if (!str_contains((string) ($info['type'] ?? ''), 'html')) {
                    continue;
                }
            }
            @unlink(substr($meta, 0, -5) . '.bin');
            if (@unlink($meta)) {
                $count++;
            }
        }
        return $count;
    }
}
