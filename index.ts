import express from "express";
import axios from "axios";
import path from "path";
import { draw } from "./draw";
const PORT: number = 53316;
const app = express();
const __dirname = path.resolve(path.dirname(""));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.redirect("/Zhipu-index.html");
});
app.get("/Zhipu-jsCode", (req, res) => {
  if (req.query?.editor === "y")
    res.sendFile("/static/Zhipu-jsCode-editor-y.js", { root: __dirname });
  else res.sendFile("/static/Zhipu-jsCode.js", { root: __dirname });
});
app.get("/zhipu-getExampleFile", (req, res) => {
  res.sendFile(`/static/Public/examples/example-${req.query.id}.json`, {
    root: __dirname,
  });
});
// app.post("/Zhipu-draw", (_req, res) => {
//   res.sendFile("/static/Zhipu-draw", { root: __dirname });
// });
app.use(express.urlencoded({ extended: true }));
app.post("/Zhipu-draw", async (req, res) => {
  try {
    const formData = new URLSearchParams(req.body).toString();
    const response = await axios.post(
      "http://zhipu.lezhi99.com/Zhipu-draw",
      formData,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          Referer: "http://zhipu.lezhi99.com/Zhipu-index.html",
          Origin: "http://zhipu.lezhi99.com",
          Accept: "*/*",
          "Accept-Encoding": "gzip, deflate",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
          "X-Requested-With": "XMLHttpRequest",
        },
      }
    );
    res.status(response.status).set(response.headers).send(response.data);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal server error", error: error });
  }
});
app.use(express.static("static"));
app.listen(PORT, () => {
  console.log("服务器启动，端口号", PORT);
});
