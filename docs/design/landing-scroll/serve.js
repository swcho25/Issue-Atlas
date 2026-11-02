// 정적 파일 서버: node serve.js <폴더> <포트>
// POST /save/<이름> 은 받은 본문을 <폴더>/baked/<이름> 으로 저장한다(지도 장면 굽기용)
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || ".");
const port = Number(process.argv[3] || 5199);
const kbps = Number(process.argv[4] || 0);   // 0 = 제한 없음
let line = 0;                                  // 다음 조각을 보낼 수 있는 시각(모든 응답이 함께 쓴다)
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json" };

http
  .createServer((req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    if (req.method === "POST" && url.startsWith("/save/")) {
      const name = path.basename(url.slice(6));
      const dir = path.join(root, "baked");
      fs.mkdirSync(dir, { recursive: true });
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        fs.writeFileSync(path.join(dir, name), Buffer.concat(chunks));
        res.writeHead(200).end("saved " + name);
      });
      return;
    }
    const file = path.join(root, url === "/" ? "index.html" : url);
    if (!file.startsWith(root)) return res.writeHead(403).end();
    fs.readFile(file, (err, data) => {
      if (err) return res.writeHead(404).end("not found");
      res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
      if (!kbps) return res.end(data);
      // 느린 인터넷 흉내: 응답 지연 80ms + 모든 응답이 합쳐서 kbps(KB/s) 를 나눠 쓴다(조각을 번갈아 보낸다)
      const step = 8 * 1024; let at = 0;
      const send = () => { const now = Date.now(), t = Math.max(now, line); line = t + (step / 1024 / kbps) * 1000;
        setTimeout(() => { res.write(data.subarray(at, at + step)); at += step; if (at >= data.length) res.end(); else send(); }, t - now); };
      setTimeout(send, 80);
    });
  })
  .listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));
