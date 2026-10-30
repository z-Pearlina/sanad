// The visitor's choice of appearance. "auto" follows the system, as the identity asks.
export type Theme = "auto" | "light" | "dark";

export const THEME_KEY = "sanad-theme";
export const THEME_COLOR = { light: "#efe5cf", dark: "#1d1610" };

/** Runs before the first paint, so a chosen theme never flashes the other one. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
