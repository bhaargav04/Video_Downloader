const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

const YTDLP_PATH = "/usr/local/bin/yt-dlp"; // adjust if needed

// 🎬 ANALYZE VIDEO (get title, thumbnail, formats)
app.post("/analyze", (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  console.log("Analyzing URL:", url);

  const ytdlp = spawn(YTDLP_PATH, ["-j", url]);

  let data = "";
  let errorMsg = "";

  ytdlp.stdout.on("data", (chunk) => {
    data += chunk.toString();
  });

  ytdlp.stderr.on("data", (chunk) => {
    errorMsg += chunk.toString();
  });

  ytdlp.on("close", (code) => {
    if (code !== 0) {
      console.error("Analyze Error:", errorMsg);
      return res.status(500).json({ error: "Failed to analyze video" });
    }

    try {
      const json = JSON.parse(data);

      const formats = json.formats
        .filter((f) => f.ext === "mp4" && f.format_note)
        .map((f) => ({
          format_id: f.format_id,
          quality: f.format_note,
          ext: f.ext,
        }));

      res.json({
        title: json.title,
        thumbnail: json.thumbnail,
        formats,
      });
    } catch (err) {
      console.error("JSON Parse Error:", err);
      res.status(500).json({ error: "Parsing failed" });
    }
  });
});

// ⬇️ DOWNLOAD VIDEO (selected format)
app.post("/download", (req, res) => {
  const { url, format_id } = req.body;

  if (!url || !format_id) {
    return res.status(400).json({ error: "Missing url or format_id" });
  }

  console.log("Streaming download:", url);

  const ytdlp = spawn("/usr/local/bin/yt-dlp", [
    "-f",
    format_id,
    "-o",
    "-", // 🔥 output to stdout (IMPORTANT)
    url,
  ]);

  // 🎯 Set headers for browser download
  res.setHeader("Content-Disposition", "attachment; filename=video.mp4");
  res.setHeader("Content-Type", "application/octet-stream");

  // 🔥 Pipe video stream directly to browser
  ytdlp.stdout.pipe(res);

  // Handle errors
  ytdlp.stderr.on("data", (data) => {
    console.log("STDERR:", data.toString());
  });

  ytdlp.on("close", (code) => {
    console.log("Process exited with code:", code);

    if (code !== 0) {
      res.end("Download failed");
    }
  });
});

app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});