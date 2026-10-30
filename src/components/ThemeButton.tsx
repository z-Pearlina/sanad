"use client";

import { Moon, Sun, SunMoon } from "lucide-react";
import { useSyncExternalStore } from "react";
import { THEME_COLOR, THEME_KEY, type Theme } from "@/lib/theme";

const NEXT: Record<Theme, Theme> = { auto: "light", light: "dark", dark: "auto" };
const LABEL: Record<Theme, string> = { auto: "تلقائي", light: "فاتح", dark: "داكن" };
const ICON = { auto: SunMoon, light: Sun, dark: Moon };

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const current = (): Theme => {
  const t = document.documentElement.dataset.theme;
  return t === "light" || t === "dark" ? t : "auto";
};

function choose(theme: Theme) {
  const root = document.documentElement;
  if (theme === "auto") delete root.dataset.theme;
  else root.dataset.theme = theme;
  try {
    if (theme === "auto") window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // no storage: the choice lasts until the page is left
  }
  // the browser's own bar: one tag for each system setting, in that order
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((tag, i) => {
    tag.content = theme === "auto" ? (i ? THEME_COLOR.dark : THEME_COLOR.light) : THEME_COLOR[theme];
  });
  listeners.forEach((fn) => fn());
}

/** Three states: automatic (the default, following the system), light and dark. */
export default function ThemeButton({ className, named }: { className?: string; /** Says what the setting is, for a row in a menu. */ named?: boolean }) {
  const theme = useSyncExternalStore(subscribe, current, () => "auto" as Theme);
  const Icon = ICON[theme];
  return (
    <button type="button" className={className} onClick={() => choose(NEXT[theme])} aria-label={`المظهر: ${LABEL[theme]}. اضغط لتغييره`}>
      <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
      {named ? `المظهر: ${LABEL[theme]}` : LABEL[theme]}
    </button>
  );
}
