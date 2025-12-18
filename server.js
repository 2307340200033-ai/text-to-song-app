import express from "express";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import { join } from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const app = express();
const upload = multer({ dest: "uploads/" });

app.post("/convert", upload.single("audio"), (req, res) => {
  const inputPath = req.file.path;
  const outPath = `${inputPath}.mp3`;
  ffmpeg(inputPath)
    .toFormat("mp3")
    .on("end", () => {
      res.download(outPath, "song.mp3", () => {
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outPath);
      });
    })
    .on("error", (err) => {
      console.error(err);
      res.status(500).send("Conversion error");
      fs.existsSync(inputPath) && fs.unlinkSync(inputPath);
    })
    .save(outPath);
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
