import { createServer } from "net";
import { execFile } from "child_process";

export const WEB_HOST = process.env.TREE_WEB_HOST || "127.0.0.1";

export async function findPort(base: number): Promise<number> {
  for (let p = base; p < base + 100; p++) {
    const ok = await new Promise<boolean>((resolve) => {
      const s = createServer();
      s.once("error", () => resolve(false));
      s.once("listening", () => s.close(() => resolve(true)));
      s.listen(p, WEB_HOST);
    });
    if (ok) return p;
  }
  throw new Error(`No available port in range ${base}-${base + 99}`);
}

export function openBrowser(url: string) {
  if (process.platform === "darwin") {
    execFile("open", [url]);
  } else if (process.platform === "win32") {
    execFile("cmd", ["/c", "start", "", url]);
  } else {
    execFile("xdg-open", [url]);
  }
}

export function maskToken(token: string): string {
  if (token.length <= 8) return "***";
  return token.slice(0, 4) + "..." + token.slice(-4);
}
