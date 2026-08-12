import { MapPin, Phone, Mail, Clock, Users, ExternalLink } from "lucide-react";
import { site } from "@/data/home";
import { getItems } from "@/lib/homeItems";
import { getSiteInfo } from "@/lib/settings";

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.19 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.52 1.5-3.91 3.78-3.91 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.44 2.9h-2.34V22c4.78-.75 8.44-4.92 8.44-9.94z" />
    </svg>
  );
}

// ที่อยู่/เบอร์/เวลาทำการ มาจากตาราง Setting ที่แก้ได้ที่ /admin/home
export default async function Footer() {
  const [info, agencyLinks] = await Promise.all([getSiteInfo(), getItems("footerLinks")]);
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
          {info.facebook && (
            <a
              href={info.facebook}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="mt-4 inline-grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20"
            >
              <FacebookIcon className="h-4 w-4" />
            </a>
          )}
        </div>

        {/* ติดต่อ */}
        <div>
          <p className="mb-3 text-sm font-semibold text-white/80">ติดต่อเรา</p>
          <ul className="space-y-2.5 text-sm text-white/80">
            <li className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {info.address}</li>
            <li className="flex gap-2"><Phone className="h-4 w-4 shrink-0" /> {info.phone}</li>
            <li className="flex gap-2"><Phone className="h-4 w-4 shrink-0" /> {info.fax}</li>
            <li className="flex gap-2"><Mail className="h-4 w-4 shrink-0" /> {info.email}</li>
          </ul>
        </div>

        {/* เวลาทำการ */}
        <div>
          <p className="mb-3 text-sm font-semibold text-white/80">เวลาทำการ</p>
          <p className="flex gap-2 text-sm text-white/80">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" /> {info.officeHours}
          </p>
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
        © {new Date().getFullYear()} {site.name} · สงวนลิขสิทธิ์
      </div>
    </footer>
  );
}
