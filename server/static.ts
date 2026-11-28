import express, { type Express, type RequestHandler } from "express";
import fs from "fs";
import path from "path";
import { hostPageRouting } from "./v2/middlewares/host-routing";
import { setIndexCacheHeaders } from "./v2/utils/index-html";
import { renderIndexHtml } from "./v2/modules/page-meta/page-meta.controller";

/** `distPath` is only overridden by tests; the build puts the client in ./public next to the bundle. */
export function serveStatic(app: Express, distPath: string = path.resolve(__dirname, "public")) {
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  const indexPath = path.resolve(distPath, "index.html");
  let index: { html: string; modified: string } | null = null;

  // The built index.html never changes while the server runs; read it once. Every response carries the hosts tag.
  const sendIndex: RequestHandler = async (req, res, next) => {
    try {
      if (!index) {
        index = {
          html: fs.readFileSync(indexPath, "utf-8"),
          modified: fs.statSync(indexPath).mtime.toUTCString(),
        };
      }
      setIndexCacheHeaders(res, index.modified);
      res.status(200).type("text/html; charset=UTF-8").send(await renderIndexHtml(index.html, req));
    } catch (err) {
      next(err);
    }
  };

  // "/" and "/index.html" must not reach express.static, or the tag would be bypassed.
  app.get(["/", "/index.html"], hostPageRouting, sendIndex);

  app.use(express.static(distPath, { index: false }));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", hostPageRouting, sendIndex);
}
