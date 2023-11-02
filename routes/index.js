const express = require("express");
const router = express.Router();
const multer = require("multer");
const AWS = require("aws-sdk");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const cors = require("cors");
router.use(cors());

const s3 = new AWS.S3();

const s3Bucket = "n11029935-assignment-2";

const upload = multer({ dest: "uploads/" });

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  sessionToken: process.env.AWS_SESSION_TOKEN,
  region: "ap-southeast-2",
});

function uploadToS3(filePath, callback) {
  const uploadParams = {
    Bucket: s3Bucket,
    Key: "output.gif", // Object key in S3.
    Body: fs.createReadStream(filePath),
  };

  s3.upload(uploadParams, (err, data) => {
    if (err) {
      callback(err, null);
    } else {
      callback(null, data);
    }
  });
}

function cleanupFiles(files) {
  for (const file of files) {
    fs.unlink(file, (err) => {
      if (err) {
        console.error("Error deleting file:", err);
      }
    });
  }
}

// Home Page
router.get("/", function (req, res, next) {
  res.render("index", { title: "Home Page" });
});

// Upload Page
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
      // Upload the converted GIF to Amazon S3.
      uploadToS3(outputFilePath, (err, s3Data) => {
        if (err) {
          console.error("S3 upload error:", err);
          res.status(500).send("Error during S3 upload");
        } else {
          console.log("File uploaded to S3:", s3Data.Location);

          // Delete the temporary files after upload.
          cleanupFiles([inputVideoFilePath, outputFilePath]);

          res.status(200).send("File uploaded to S3.");
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