import type { Metadata } from "next";
import Image from "next/image";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import Reveal from "@/components/ui/Reveal";
import ScrollProgress from "@/components/ui/ScrollProgress";
import BackToTop from "@/components/ui/BackToTop";

import c01 from "@/data/asset/committee_15_images/committee-01.png";
import c02 from "@/data/asset/committee_15_images/committee-02.png";
import c03 from "@/data/asset/committee_15_images/committee-03.png";
import c04 from "@/data/asset/committee_15_images/committee-04.png";
import c05 from "@/data/asset/committee_15_images/committee-05.png";
import c06 from "@/data/asset/committee_15_images/committee-06.png";
import c07 from "@/data/asset/committee_15_images/committee-07.png";
import c08 from "@/data/asset/committee_15_images/committee-08.png";
import c09 from "@/data/asset/committee_15_images/committee-09.png";
import c10 from "@/data/asset/committee_15_images/committee-10.png";
import c11 from "@/data/asset/committee_15_images/committee-11.png";
import c12 from "@/data/asset/committee_15_images/committee-12.png";
import c13 from "@/data/asset/committee_15_images/committee-13.png";
import c14 from "@/data/asset/committee_15_images/committee-14.jpg";
import c15 from "@/data/asset/committee_15_images/committee-15.png";

// เรียงตามลำดับบนภาพ 01→15 (ซ้าย→ขวา บน→ล่าง) — ชื่อ/ตำแหน่งอยู่บนภาพ, name ใช้เป็น alt
const members: { img: typeof c01; name: string }[] = [
  { img: c01, name: "ประธานกรรมการ – จำลอง แก้วพิทยานนท์" },
  { img: c02, name: "รองประธานกรรมการ – ชวนหลุ๊ดหล๊ะ" },
  { img: c03, name: "กรรมการ – สมชาย ประดิษฐ์อำนวย" },
  { img: c04, name: "ประธานกรรมการเงินกู้ – เป็น รักเกิด" },
  { img: c05, name: "เหรัญญิก – อนุชา ซุ้นสุวรรณ" },
  { img: c06, name: "ประธานกรรมการศึกษา – บุญญิสา เมืองทอง" },
  { img: c07, name: "เลขานุการ – ภานุมาศ สุขขัง" },
  { img: c08, name: "กรรมการเงินกู้ – เจริญ จิโรภาส" },
  { img: c09, name: "กรรมการเงินกู้ – อำนาจ ทองผอม" },
  { img: c10, name: "กรรมการศึกษา – สุธน หนูสังข์" },
  { img: c11, name: "กรรมการศึกษา – ชญานนท์ สุวรรณชัย" },
  { img: c12, name: "กรรมการเงินกู้ – พิเชษฐ์ สุขทร" },
  { img: c13, name: "กรรมการ – สมศักดิ์ สินโน" },
  { img: c14, name: "กรรมการศึกษา – สุพัตศร มากทอง" },
  { img: c15, name: "กรรมการศึกษา – เกตย์สิรี พันธอุบล" },
];

// Footer อ่านข้อมูลติดต่อจากฐาน — prerender ตอน build ไม่ได้ (ยังไม่มี DATABASE_URL)
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "คณะกรรมการดำเนินการ ชุดที่ 45",
  description: "ทำเนียบคณะกรรมการดำเนินการ ชุดที่ 45 ของสหกรณ์ออมทรัพย์สาธารณสุขสงขลา จำกัด",
};

export default function BoardPage() {
  return (
    <>
      <ScrollProgress />
      <Header />
      <main>
        {/* หัวเรื่อง */}
        <section className="bg-gradient-to-b from-brand-600 to-brand-400 py-10 text-center text-white">
          <div className="mx-auto max-w-6xl px-4">
            <p className="text-sm font-medium opacity-80">เกี่ยวกับสหกรณ์ · ทำเนียบองค์กร</p>
            <h1 className="mt-1.5 text-2xl font-bold md:text-3xl">คณะกรรมการดำเนินการ ชุดที่ 45</h1>
          </div>
        </section>

        {/* กริดกรรมการ */}
        <section className="bg-sky-soft py-12">
          <div className="mx-auto max-w-6xl px-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {members.map((m, i) => (
                <Reveal key={m.name} delay={(i % 4) * 0.05}>
                  <figure className="group overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-black/5 transition duration-300 hover:-translate-y-1.5 hover:shadow-xl">
                    <Image
                      src={m.img}
                      alt={`คณะกรรมการดำเนินการ ชุดที่ 45 — ${m.name}`}
                      placeholder="blur"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="h-auto w-full transition duration-500 group-hover:scale-[1.03]"
                    />
                  </figure>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      </main>
      <BackToTop />
      <Footer />
    </>
  );
}
