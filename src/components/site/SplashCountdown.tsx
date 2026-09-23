"use client";

import { useEffect, useRef, useState } from "react";
import { useEnterSite } from "@/components/site/useEnterSite";

/**
 * นับถอยหลังบนหน้าวันสำคัญ แล้วพาเข้าเว็บให้เอง
 *
 * มีไว้เพราะหน้านี้มีแต่ภาพกับปุ่มเดียว บางคนนั่งดูภาพแล้วไม่รู้ว่าต้องกดตรงไหนถึงจะเข้าเว็บ
 * (ปัญหาเดียวกับที่ทำให้ปุ่มต้องกระพริบ — ดู EnterSiteButton) · ตัวเลขบอกไปเลยว่าอีกกี่วินาที
 * จะพาเข้าเอง ไม่ต้องเดา · ตั้งกี่วินาทีก็ได้ที่ หลังบ้าน → หน้าวันสำคัญ (0 = ไม่นับ)
 *
 * ⚠️ ที่นี่เขียน setInterval เองทั้งที่กฎของโปรเจกต์บอกว่า "ของที่เลื่อนเองทุกตัวต้องผ่าน
 * useAutoRotate" — เจ้าของเว็บชี้ขาดไว้ 23 ก.ย. 2569 ว่าให้เป็นข้อยกเว้น เพราะตัวนี้
 * นับครั้งเดียวจบแล้วออกจากหน้าไปเลย ไม่ได้วนเป็นรอบแบบสไลด์ ซึ่งเป็นสิ่งที่ useAutoRotate
 * มีไว้ทำ (หลักเดียวกับที่ NewsTicker เป็นข้อยกเว้นอยู่แล้ว)
 *
 * ⚠️ นับจากเวลาจริง (Date.now) ไม่ใช่นับจำนวนครั้งที่ tick — เบราว์เซอร์หรี่ setInterval
 * ของแท็บที่ไม่ได้อยู่หน้าจอ ถ้านับจำนวนครั้งจะเพี้ยนไปหลายวินาทีทันทีที่สลับแท็บ
 */

/** ถี่กว่าวินาทีละครั้งเพื่อให้วงแหวนเดินลื่น — ตัวเลขยังเปลี่ยนวินาทีละครั้งเหมือนเดิม */
const TICK_MS = 100;

/** รัศมีวงแหวน (หน่วยเดียวกับ viewBox) */
const R = 34;
const CIRCUMFERENCE = 2 * Math.PI * R;

export default function SplashCountdown({
  seconds,
  light = false,
  onDone,
}: {
  /** นับจากกี่วินาที — ต้องมากกว่า 0 (ไม่งั้นอย่าวาดคอมโพเนนต์นี้เลย) */
  seconds: number;
  /** พื้นหลังสว่าง = ต้องใช้ตัวหนังสือเข้ม */
  light?: boolean;
  /** ไม่ส่งมา = ไปหน้าแรกทันที · ส่งมา = ให้หน้าที่ครอบอยู่จัดการเอง (จางออกก่อนค่อยไป) */
  onDone?: () => void;
}) {
  const enter = useEnterSite();
  const done = onDone ?? enter;
  const total = seconds * 1000;

  const [left, setLeft] = useState(total);
  const [paused, setPaused] = useState(false);
  const [stopped, setStopped] = useState(false);
  // เวลาที่เหลือจริง เก็บแยกจาก state ไว้ให้ตัวจับเวลาอ่านตอนเริ่มนับต่อจากที่หยุดค้างไว้
  const leftRef = useRef(total);

  useEffect(() => {
    if (stopped || paused) return;

    const deadline = Date.now() + leftRef.current;
    const timer = setInterval(() => {
      const ms = Math.max(0, deadline - Date.now());
      leftRef.current = ms;
      setLeft(ms);
      if (ms === 0) {
        clearInterval(timer);
        done();
      }
    }, TICK_MS);

    return () => clearInterval(timer);
  }, [paused, stopped, done]);

  if (stopped) return null;

  const secondsLeft = Math.ceil(left / 1000);
  const text = light ? "text-amber-900" : "text-amber-50/90";
  const dim = light ? "text-amber-900/60" : "text-white/55";

  return (
    <div
      className="relative flex flex-col items-center gap-2"
      // เอาเมาส์ชี้ = อยากดูภาพต่อ หยุดนับค้างไว้ก่อน แล้วเดินต่อเมื่อเอาเมาส์ออก
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      // คนที่ใช้แป้นพิมพ์เดินมาถึงปุ่ม "หยุดนับ" ก็ต้องได้เวลาอ่านเหมือนกัน
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="relative" role="timer" aria-label={`เข้าสู่เว็บไซต์อัตโนมัติใน ${secondsLeft} วินาที`}>
        {/*
          วงแหวนนี้ไม่ได้ซ่อนตอนเครื่องตั้ง "ลดการเคลื่อนไหว" (ต่างจากหลอดของสไลด์)
          เพราะมันบอกข้อมูลว่าเหลือเวลาเท่าไร ไม่ใช่ลูกเล่นประดับ — ซ่อนแล้วเหลือแต่ตัวเลข
          ที่กระโดดเปลี่ยนเฉย ๆ ดูเหมือนหน้าเว็บกำลังจะทำอะไรไม่รู้
        */}
        <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90" aria-hidden="true">
          <circle
            cx="40"
            cy="40"
            r={R}
            fill="none"
            strokeWidth="3"
            className={light ? "stroke-amber-900/15" : "stroke-white/15"}
          />
          <circle
            cx="40"
            cy="40"
            r={R}
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - left / total)}
            className={light ? "stroke-amber-700/70" : "stroke-amber-200/70"}
          />
        </svg>
        <span
          aria-hidden="true"
          className={`absolute inset-0 flex items-center justify-center text-4xl font-semibold tabular-nums ${text}`}
        >
          {secondsLeft}
        </span>
      </div>

      <p className={`text-xs ${dim}`}>
        {paused ? "หยุดนับไว้ชั่วคราว" : "กำลังพาเข้าสู่เว็บไซต์"}
      </p>

      <button
        onClick={() => setStopped(true)}
        className={`rounded-full px-3 py-1 text-xs underline-offset-4 transition hover:underline ${dim}`}
      >
        หยุดนับถอยหลัง
      </button>
    </div>
  );
}
