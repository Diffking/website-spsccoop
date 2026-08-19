import Link from "next/link";
import { MapPin, Phone, Mail, Clock, Users, ExternalLink, Navigation, Printer } from "lucide-react";
import { getItems } from "@/lib/homeItems";
import { getBrand } from "@/lib/nav";
import { getOfficeHours, getSiteInfo } from "@/lib/settings";
import { describeClosedDays, describeOfficeHours } from "@/lib/officeHours";

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.19 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.52 1.5-3.91 3.78-3.91 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.44 2.9h-2.34V22c4.78-.75 8.44-4.92 8.44-9.94z" />
    </svg>
  );
}

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M21.58 7.19a2.5 2.5 0 0 0-1.76-1.77C18.25 5 12 5 12 5s-6.25 0-7.82.42A2.5 2.5 0 0 0 2.42 7.2 26.1 26.1 0 0 0 2 12a26.1 26.1 0 0 0 .42 4.81 2.5 2.5 0 0 0 1.76 1.77C5.75 19 12 19 12 19s6.25 0 7.82-.42a2.5 2.5 0 0 0 1.76-1.77A26.1 26.1 0 0 0 22 12a26.1 26.1 0 0 0-.42-4.81ZM10 15.02V8.98L15.2 12 10 15.02Z" />
    </svg>
  );
}

// ที่อยู่/เบอร์/เวลาทำการ มาจากตาราง Setting ที่แก้ได้ที่ /admin/home
export default async function Footer() {
  const [info, agencyLinks, brand, hours] = await Promise.all([
    getSiteInfo(),
    getItems("footerLinks"),
    getBrand(),
    getOfficeHours(),
  ]);
  const closed = describeClosedDays(hours);
  return (
    <footer className="mt-auto bg-brand-800 text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-4">
        {/* สมาชิก */}
        <div>
          <p className="text-sm font-semibold text-white/80">สถิติผู้เข้าชม</p>
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-white/10 p-4">
            <Users className="h-8 w-8 text-brand-200" />
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {info.memberCount} <span className="text-sm font-normal">ครั้ง</span>
              </p>
              <p className="text-xs text-white/70">จำนวนผู้เยี่ยมชมภายในปีบัญชี</p>
            </div>
          </div>
          {(info.facebook || info.youtube) && (
            <div className="mt-4 flex items-center gap-2">
              {info.facebook && (
                <a
                  href={info.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="inline-grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20"
                >
                  <FacebookIcon className="h-4 w-4" />
                </a>
              )}
              {info.youtube && (
                <a
                  href={info.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="YouTube"
                  className="inline-grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20"
                >
                  <YouTubeIcon className="h-5 w-5" />
                </a>
              )}
            </div>
          )}
        </div>

        {/* ติดต่อ */}
        <div>
          <p className="mb-3 text-sm font-semibold text-white/80">ติดต่อเรา</p>
          <ul className="space-y-2.5 text-sm text-white/80">
            <li className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {info.address}</li>
            <li className="flex gap-2"><Phone className="h-4 w-4 shrink-0" /> {info.phone}</li>
            {/* แฟกซ์ใช้ไอคอนเครื่องแฟกซ์ ไม่ใช่หูโทรศัพท์ซ้ำกับเบอร์ด้านบน */}
            <li className="flex gap-2"><Printer className="h-4 w-4 shrink-0" /> {info.fax}</li>
            <li className="flex gap-2"><Mail className="h-4 w-4 shrink-0" /> {info.email}</li>
          </ul>

          {/* ทางเข้าหน้าติดต่อเรา — แผนที่ เส้นทาง และเลขที่บัญชีอยู่ในนั้นทั้งหมด */}
          <Link
            href="/about/contact/"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-200 transition hover:text-white"
          >
            <Navigation className="h-4 w-4" /> แผนที่ เส้นทาง และเลขที่บัญชี
          </Link>
        </div>

        {/* เวลาทำการ */}
        <div>
          <p className="mb-3 text-sm font-semibold text-white/80">เวลาทำการ</p>
          {/* ข้อความสร้างจากวัน/เวลาที่ตั้งไว้ที่หลังบ้าน ไม่ต้องพิมพ์เอง จะได้ไม่หลุดไม่ตรงกับป้ายบนหัวเว็บ */}
          <p className="flex gap-2 text-sm text-white/80">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" /> {describeOfficeHours(hours)}
          </p>
          {closed && (
            <p className="mt-1.5 pl-6 text-xs text-white/60">{closed} และวันหยุดสหกรณ์ — ปิดทำการ</p>
          )}
        </div>

        {/* ลิงก์หน่วยงาน */}
        <div>
          <p className="mb-3 text-sm font-semibold text-white/80">หน่วยงานสนับสนุนกำกับดูแล</p>
          <ul className="space-y-2 text-sm text-white/80">
            {agencyLinks.map((l) => (
              <li key={l.id}>
                {l.href && l.href !== "#" ? (
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 hover:text-white"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> {l.title}
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" /> {l.title}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 bg-brand-900 py-4 text-center text-xs text-white/60">
        © {new Date().getFullYear()} {brand.name} · สงวนลิขสิทธิ์
      </div>
    </footer>
  );
}
