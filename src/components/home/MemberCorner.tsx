import Reveal from "@/components/ui/Reveal";
import Icon from "@/components/ui/Icon";
import MaybeLink from "@/components/ui/MaybeLink";
import type { Item } from "@/lib/homeItems";

export default function MemberCorner({ links, bg = "bg-white" }: { links: Item[]; bg?: string }) {
  return (
    <section className={`${bg} pb-12`}>
      <div className="mx-auto max-w-6xl px-4">
        <Reveal>
          {/*
            ไล่สีฟ้า → เขียว จากซ้ายไปขวา แวะฟ้าอมเขียว (teal) ตรงกลาง
            ถ้าไล่ฟ้าไปเขียวตรง ๆ ช่วงกลางจะออกเทาหม่น เพราะสองสีนี้อยู่คนละฝั่งของวงล้อสี

            ปลายขวาใช้เขียวเข้ม (emerald-700) ไม่ใช่เขียวสด — ตัวหนังสือกับปุ่มเป็นสีขาว
            พื้นเขียวสดสว่างเกินไปจนตัวขาวจม อ่านไม่ออก
          */}
          <div className="grid items-center gap-6 rounded-2xl bg-gradient-to-r from-brand-600 via-teal-600 to-emerald-700 p-7 text-white shadow-lg md:grid-cols-[1fr_auto]">
            <div>
              <h3 className="text-2xl font-bold">แนะนำสมาชิก</h3>
              <p className="mt-1 max-w-md text-sm text-white/85">
                ความรู้สำหรับการเป็นสมาชิกสหกรณ์ การเข้าถึงบริการต่าง ๆ และสิทธิประโยชน์ที่คุณจะได้รับจากการเป็นสมาชิก
              </p>
            </div>
            {/*
              เรียงชิดขวาเสมอ ไม่ใช่ตาราง 3 ช่องตายตัว — เหลือปุ่มไม่ครบ 3
              ช่องที่ว่างจะค้างอยู่ทางขวา ทำให้ปุ่มดูลอยไม่ชิดขอบการ์ด
              จอแคบขึ้นบรรทัดใหม่ได้ และวางชิดซ้ายแทนเพราะบล็อกนี้เต็มความกว้าง
            */}
            <div className="flex flex-wrap justify-start gap-3 md:justify-end">
              {links.map((m) => (
                <MaybeLink
                  key={m.id}
                  href={m.href}
                  // กว้างเท่ากันทุกปุ่ม ไม่ยืดตามความยาวชื่อ จะได้ดูเป็นชุดเดียวกัน
                  className="flex w-24 flex-col items-center gap-2 rounded-xl bg-white/20 px-3 py-3 text-center text-xs font-medium ring-1 ring-white/25 backdrop-blur transition hover:bg-white/30"
                >
                  {/* ปุ่มพวกนี้อยู่ฝั่งขวาซึ่งเป็นช่วงเขียวเข้ม ใช้เขียวเข้มด้วยจะเป็นชุดเดียวกัน */}
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-emerald-700">
                    <Icon name={m.icon ?? "BookOpen"} className="h-5 w-5" />
                  </span>
                  <span className="line-clamp-2" title={m.title}>
                    {m.title}
                  </span>
                </MaybeLink>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
