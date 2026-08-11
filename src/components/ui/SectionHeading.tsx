import type { ReactNode } from "react";

export default function SectionHeading({
  title,
  subtitle,
  en,
}: {
  title: ReactNode;
  subtitle?: string;
  en?: string;
}) {
  return (
    <div className="text-center mb-8 md:mb-10">
      <h2 className="text-2xl md:text-3xl font-bold text-brand-700">{title}</h2>
      {en && (
        <p className="mt-1 text-xs md:text-sm font-semibold tracking-[0.2em] text-brand-400 uppercase">
          {en}
        </p>
      )}
      {subtitle && <p className="mt-2 text-sm md:text-base text-gray-500">{subtitle}</p>}
    </div>
  );
}
