const express = require("express");
const router = express.Router();
const multer = require("multer");
const AWS = require("aws-sdk");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const cors = require("cors");
router.use(cors());

const s3 = new AWS.S3();
const sqs = new AWS.SQS();

const s3Bucket = "n11029935-assignment-2";
const s3Key = "output.gif";

const upload = multer({ dest: "uploads/" });

// Home Page
router.get("/", function (req, res, next) {
  res.render("index", { title: "Home Page" });
});

router.post("/upload", upload.single("video"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  const inputVideoFilePath = req.file.path; // Use the uploaded video file.
  const outputFilePath = "downloads/output.gif"; // Specify the path where you want to save the output GIF.

  ffmpeg()
    .input(inputVideoFilePath)
    .setStartTime("00:00:01")
    .setDuration("5")
    .size("1440x1080")
    .fps(40)
    .toFormat("gif")
    .on("end", () => {
      // Conversion finished; send the GIF to the client or do further processing.
      res.download(outputFilePath, "output.gif", (err) => {
        if (err) {
          console.error("Download error:", err);
          res.status(500).send("Error during download");
        } else {
          // Delete the temporary files after download
          fs.unlink(inputVideoFilePath, (err) => {
            if (err) {
              console.error("Error deleting input file:", err);
            }
          });
        }
      });
    })
    .on("error", (err) => {
      console.error("Error:", err);
      res.status(500).send("Error during conversion");
    })
    .save(outputFilePath);
});
module.exports = router;
