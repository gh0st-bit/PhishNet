import express, { type Express } from "express";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
// Use dynamic import to be compatible across Vite major versions
import { type Server } from "node:http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true as const,
    hmr: { server },
    allowedHosts: true as const,
  };

  const resolvedConfig =
    typeof viteConfig === "function" ? await viteConfig() : viteConfig;

  let viteModule: any = await import("vite");
  let createViteServer =
    viteModule?.createServer || viteModule?.default?.createServer;

  // Fallback: if a local file named 'vite' shadows the package, import directly from node_modules
  if (typeof createViteServer !== "function") {
    const viteNodePath = path.resolve(import.meta.dirname, "..", "node_modules", "vite", "dist", "node", "index.js");
    const viteNodeUrl = pathToFileURL(viteNodePath).href;
    viteModule = await import(viteNodeUrl);
    createViteServer = viteModule?.createServer || viteModule?.default?.createServer;
  }

  if (typeof createViteServer !== "function") {
    throw new Error("Vite createServer API not found. Check installed Vite version.");
  }

  const vite = await createViteServer({
    ...resolvedConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // Build output configured in vite.config.ts: dist/public under repo root
  const distPath = path.resolve(import.meta.dirname, "..", "dist", "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}. Run 'npm run build' from the project root (generates dist/public).`,
    );
  }

  app.use(express.static(distPath));

  // SPA fallback
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
