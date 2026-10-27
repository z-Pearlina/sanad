// Build-time access to public/data for Server Components (the site is exported as static HTML).
import { readFileSync } from "node:fs";
import path from "node:path";

export function readData<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(process.cwd(), "public/data", file), "utf-8")) as T;
}
