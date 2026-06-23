"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Segment<T extends string> = {
  value: T;
  label: React.ReactNode;
  count?: number;
};

type SegmentedControlProps<T extends string> = {
  segments: readonly Segment<T>[];
  value: T;
  onChange?: (value: T) => void;
  className?: string;
};

/* ─── Link-based variant for server-rendered pages (URL filter tabs) ─────── */
type LinkSegment<T extends string> = {
  value: T;
  label: React.ReactNode;
  href: string;
  count?: number;
};

type LinkSegmentedControlProps<T extends string> = {
  segments: readonly LinkSegment<T>[];
  value: T;
  className?: string;
};

export function LinkSegmentedControl<T extends string>({
  segments,
  value,
  className,
}: LinkSegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label="Filtres"
      className={cn(
        "inline-flex items-center gap-px p-0.5 rounded-[10px]",
        "bg-black/[0.06] dark:bg-white/[0.08]",
        className
      )}
    >
      {segments.map((seg) => {
        const isActive = seg.value === value;
        return (
          <Link
            key={seg.value}
            href={seg.href}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "relative inline-flex items-center gap-1.5 rounded-[8px] px-3 py-1",
              "text-[13px] font-medium leading-snug select-none",
              "transition-all duration-150 ease-out",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              isActive
                ? [
                    "bg-white dark:bg-[#3A3A3C]",
                    "text-foreground dark:text-white",
                    "shadow-[0_1px_3px_rgba(0,0,0,0.12),0_0.5px_1px_rgba(0,0,0,0.08)]",
                    "dark:shadow-[0_1px_3px_rgba(0,0,0,0.5)]",
                  ].join(" ")
                : [
                    "text-foreground/60 dark:text-white/50",
                    "hover:text-foreground/80 dark:hover:text-white/70",
                    "hover:bg-black/[0.04] dark:hover:bg-white/[0.05]",
                  ].join(" ")
            )}
          >
            {seg.label}
            {seg.count !== undefined && (
              <span
                className={cn(
                  "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1",
                  "rounded-full text-[11px] font-semibold leading-none",
                  isActive
                    ? "bg-primary/[0.12] text-primary dark:bg-primary/[0.20]"
                    : "bg-black/[0.06] dark:bg-white/[0.10] text-foreground/50 dark:text-white/40"
                )}
              >
                {seg.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

/* ─── State-based variant for client-side filtering ──────────────────────── */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label="Filtres"
      className={cn(
        "inline-flex items-center gap-px p-0.5 rounded-[10px]",
        "bg-black/[0.06] dark:bg-white/[0.08]",
        className
      )}
    >
      {segments.map((seg) => {
        const isActive = seg.value === value;
        return (
          <button
            key={seg.value}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange?.(seg.value)}
            className={cn(
              "relative inline-flex items-center gap-1.5 rounded-[8px] px-3 py-1",
              "text-[13px] font-medium leading-snug select-none",
              "transition-all duration-150 ease-out",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              isActive
                ? [
                    "bg-white dark:bg-[#3A3A3C]",
                    "text-foreground dark:text-white",
                    "shadow-[0_1px_3px_rgba(0,0,0,0.12),0_0.5px_1px_rgba(0,0,0,0.08)]",
                    "dark:shadow-[0_1px_3px_rgba(0,0,0,0.5)]",
                  ].join(" ")
                : [
                    "text-foreground/60 dark:text-white/50",
                    "hover:text-foreground/80 dark:hover:text-white/70",
                    "hover:bg-black/[0.04] dark:hover:bg-white/[0.05] rounded-[8px]",
                  ].join(" ")
            )}
          >
            {seg.label}
            {seg.count !== undefined && (
              <span
                className={cn(
                  "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1",
                  "rounded-full text-[11px] font-semibold leading-none",
                  isActive
                    ? "bg-primary/[0.12] text-primary dark:bg-primary/[0.20] dark:text-primary"
                    : "bg-black/[0.06] dark:bg-white/[0.10] text-foreground/50 dark:text-white/40"
                )}
              >
                {seg.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
