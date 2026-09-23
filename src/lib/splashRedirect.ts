import {
  CRAWLER_UA,
  SPLASH_GRACE_MS,
  splashWindows,
  type SplashContent,
} from "@/content/splash";

/**
 * สคริปต์เด้งไปหน้าวันสำคัญ "ก่อนหน้าแรกจะวาด" — ฝังไว้บนสุดของหน้าแรก
 *
 * ทำไมต้องมี: ตัวเด้งเดิม (SplashGate) เป็น useEffect จึงได้ทำงานหลัง React hydrate
 * หน้าแรกทั้งหน้าเสร็จ (Hero + สไลด์ 4 ตัว + ปฏิทิน + motion) ผู้ใช้เลยเห็นหน้าแรก
 * โผล่มาค้างอยู่ 1-6 วินาทีแล้วค่อยโดนดึงไปหน้าวันสำคัญ ดูเหมือนเว็บรวน
 * สคริปต์ตัวนี้รันตอนเบราว์เซอร์อ่าน HTML มาถึงบรรทัดนี้ คือก่อนวาดและก่อนโหลด JS ก้อนใหญ่
 *
 * ⚠️ เด้งฝั่งเซิร์ฟเวอร์แทนไม่ได้ — lib/mirror.php เก็บคำตอบ 3xx ลงแคชแล้วเล่นซ้ำ
 * ถ้าให้ "/" ตอบ redirect สำเนาบนโฮสต์จะเด้งทุกคนตลอด TTL รวมถึงคนที่เพิ่งกด
 * "เข้าสู่เว็บไซต์" = วนไม่จบ เข้าเว็บไม่ได้เลย · และเซิร์ฟเวอร์ไม่เห็น sessionStorage
 *
 * ⚠️ เงื่อนไขข้างในต้องตรงกับ splashSession.ts เสมอ — ที่นี่เป็นข้อความ JS ฝังใน HTML
 * import ไม่ได้ จึงเป็นที่เดียวในระบบที่ยอมให้เงื่อนไขนี้ซ้ำ แก้ที่โน่นแล้วต้องมาแก้ที่นี่ด้วย
 *
 * คืน null = วันนี้ไม่มีอะไรต้องเด้ง ไม่ต้องใส่สคริปต์ลงหน้าเลย
 */
export function splashRedirectScript(content: SplashContent): string | null {
  const windows = splashWindows(content);
  if (windows.length === 0) return null;

  // โหมด "ทุกครั้ง" เด้งซ้ำได้เมื่อพ้นช่วงผ่อนผันหลังกดเข้าเว็บ · โหมดปกติเข้าแล้วจบ
  const done =
    content.repeat === "always"
      ? `!(e > 0 && Date.now() - e < ${SPLASH_GRACE_MS})`
      : `v === null`;

  return `(function(){try{
if(${CRAWLER_UA}.test(navigator.userAgent))return;
var w=${JSON.stringify(windows)},n=new Date();
var t=n.getFullYear()*10000+(n.getMonth()+1)*100+n.getDate(),ok=0;
for(var i=0;i<w.length;i++)if(t>=w[i][0]&&t<=w[i][1]){ok=1;break}
if(!ok)return;
var v=sessionStorage.getItem("spsc_entered"),e=Number(v);
if(${done})location.replace("/splash/");
}catch(err){}})();`;
}
