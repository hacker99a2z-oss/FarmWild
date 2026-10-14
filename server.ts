import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { app as backendApp } from "./backend/src/server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  process.env["EMBEDDED_DEV"] = "true";
  const app = express();

  // Mount backend API routes & verification
  app.use(backendApp);

  if (process.env["NODE_ENV"] === "production") {
    const distPath = path.resolve(__dirname, "frontend/dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  } else {
    // Mount frontend Vite development server in middleware mode
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
      root: path.resolve(__dirname, "frontend"),
    });

    app.use(vite.middlewares);

    // Serve transformed index.html for SPA routes
    app.get("*", async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const indexPath = path.resolve(__dirname, "frontend/index.html");
        let template = fs.readFileSync(indexPath, "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  }

  const PORT = process.env["PORT"] || 3000;
  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Farm City app running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
