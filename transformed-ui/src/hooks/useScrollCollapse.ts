import { useState, useEffect, useCallback, useRef } from "react";

export function useScrollCollapse(threshold: number = 80): {
  collapsed: boolean;
  scrollRef: React.RefObject<HTMLElement | null>;
} {
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<HTMLElement | null>(null);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCollapsed(el.scrollTop > threshold);
  }, [threshold]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return { collapsed, scrollRef };
}
