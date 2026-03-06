"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const clampNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

export default function AnimatedNumber({
  value = 0,
  durationMs = 700,
  decimals = 0,
  locale = "en-KE",
  prefix = "",
  suffix = "",
  className = ""
}) {
  const [displayValue, setDisplayValue] = useState(clampNumber(value));
  const previousValue = useRef(clampNumber(value));

  useEffect(() => {
    const target = clampNumber(value);
    const start = previousValue.current;
    previousValue.current = target;

    if (typeof window === "undefined") {
      setDisplayValue(target);
      return;
    }

    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (prefersReducedMotion || durationMs <= 0) {
      setDisplayValue(target);
      return;
    }

    const startedAt = performance.now();
    let frameId = null;

    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = start + (target - start) * eased;
      setDisplayValue(nextValue);
      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [value, durationMs]);

  const formatted = useMemo(() => {
    const formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
    return formatter.format(clampNumber(displayValue));
  }, [decimals, displayValue, locale]);

  return <span className={className}>{`${prefix}${formatted}${suffix}`}</span>;
}
