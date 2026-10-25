"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonClass } from "@/components/ui/button";

/**
 * Thumb-reach call to action on phones. It appears only once the hero's own buttons have
 * scrolled away, so the first screen is never covered; while hidden it is inert.
 */
export function MobileBar() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const target = document.getElementById("hero-cta");
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting && entry.boundingClientRect.top < 0));
    observer.observe(target);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      inert={!show}
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] transition-transform duration-200 ease-[var(--ease-out)] motion-reduce:transition-none sm:hidden ${show ? "translate-y-0" : "translate-y-full"}`}
    >
      <Link href="/inscription" className={buttonClass("primary", "h-12 w-full rounded-full text-[15px]")}>
        Créer ma page gratuitement <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
