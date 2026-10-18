"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-checks every 5 s for up to 2 minutes while the payment is pending. */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    let count = 0;
    const id = setInterval(() => {
      if (++count > 24) return clearInterval(id);
      router.refresh();
    }, 5000);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
