import { createServer } from "net";
import { exec } from "child_process";

export async function findPort(base: number): Promise<number> {
  for (let p = base; p < base + 100; p++) {
    const ok = await new Promise<boolean>((resolve) => {
      const s = createServer();
      s.once("error", () => resolve(false));
      s.once("listening", () => s.close(() => resolve(true)));
      s.listen(p);
    });
    if (ok) return p;
  }
  throw new Error(`No available port in range ${base}-${base + 99}`);
}

export function openBrowser(url: string) {
  const cmd =
    process.platform === "darwin"
      ? `open "${url}"`
      : process.platform === "win32"
        ? `start "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd);
}
