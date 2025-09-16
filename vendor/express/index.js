import http from "http";
import fs from "fs";
import path from "path";
import { URL } from "url";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

function mimeLookup(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

function decorateResponse(res) {
  if (res.__miniExpress) return;
  res.__miniExpress = true;
  res.status = function status(code) {
    res.statusCode = code;
    return res;
  };
  res.set = function set(field, value) {
    res.setHeader(field, value);
    return res;
  };
  res.send = function send(body) {
    if (body == null) {
      res.end();
      return res;
    }
    if (Buffer.isBuffer(body)) {
      res.end(body);
      return res;
    }
    if (typeof body === "object") {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(body));
      return res;
    }
    res.end(String(body));
    return res;
  };
  res.sendFile = function sendFile(filePath) {
    try {
      let target = path.resolve(filePath);
      const stat = fs.statSync(target);
      if (stat.isDirectory()) {
        target = path.join(target, "index.html");
      }
      const stream = fs.createReadStream(target);
      res.statusCode = res.statusCode || 200;
      res.setHeader("Content-Type", mimeLookup(target));
      stream.on("error", () => {
        res.statusCode = 404;
        res.end("Not Found");
      });
      if (res.req?.method === "HEAD") {
        stream.destroy();
        res.end();
        return res;
      }
      stream.pipe(res);
    } catch (err) {
      res.statusCode = 404;
      res.end("Not Found");
    }
    return res;
  };
}

function createApp() {
  const middlewares = [];
  const routes = [];

  function use(fn) {
    middlewares.push(fn);
    return app;
  }

  function get(routePath, handler) {
    routes.push({ method: "GET", path: routePath, handler });
    return app;
  }

  function match(routePath, pathname) {
    if (routePath === "*" || routePath === "/*") return true;
    return pathname === routePath;
  }

  function handle(req, res) {
    decorateResponse(res);
    const url = new URL(req.url || "\/", "http://localhost");
    let idx = 0;

    const runRoute = () => {
      const route = routes.find((r) => r.method === req.method && match(r.path, url.pathname));
      if (route) {
        try {
          route.handler(req, res);
        } catch (err) {
          res.statusCode = 500;
          res.end("Internal Server Error");
        }
        return;
      }
      if (!res.writableEnded) {
        res.statusCode = 404;
        res.end("Not Found");
      }
    };

    const next = (err) => {
      if (err) {
        res.statusCode = 500;
        res.end("Internal Server Error");
        return;
      }
      if (res.writableEnded) return;
      if (idx >= middlewares.length) {
        runRoute();
        return;
      }
      const fn = middlewares[idx++];
      try {
        fn(req, res, next);
      } catch (error) {
        next(error);
      }
    };

    next();
  }

  const server = http.createServer((req, res) => handle(req, res));

  const app = {
    use,
    get,
    listen(port, cb) {
      return server.listen(port, cb);
    }
  };

  return app;
}

function staticMiddleware(rootDir) {
  const root = path.resolve(rootDir);
  return (req, res, next) => {
    if (!req.url || (req.method !== "GET" && req.method !== "HEAD") || res.writableEnded) {
      next();
      return;
    }

    try {
      const url = new URL(req.url, "http://localhost");
      let filePath = path.join(root, decodeURIComponent(url.pathname));
      if (!filePath.startsWith(root)) {
        next();
        return;
      }
      let stat;
      try {
        stat = fs.statSync(filePath);
      } catch {
        stat = null;
      }
      if (stat?.isDirectory()) {
        filePath = path.join(filePath, "index.html");
        try {
          stat = fs.statSync(filePath);
        } catch {
          stat = null;
        }
      }
      if (!stat || !stat.isFile()) {
        next();
        return;
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", mimeLookup(filePath));
      const stream = fs.createReadStream(filePath);
      stream.on("error", () => {
        next();
      });
      if (req.method === "HEAD") {
        stream.destroy();
        res.end();
        return;
      }
      stream.pipe(res);
    } catch (err) {
      next();
    }
  };
}

export default function express() {
  const app = createApp();
  return app;
}

express.static = staticMiddleware;
