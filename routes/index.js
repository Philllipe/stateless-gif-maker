const express = require("express");
const router = express.Router();

const multer = require("multer");
const AWS = require("aws-sdk");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");

const s3 = new AWS.S3();
const sqs = new AWS.SQS({ region: "ap-southeast-2" });

const s3Bucket = "n11029935-assignment-2";
const sqsQueueUrl =
  "https://sqs.ap-southeast-2.amazonaws.com/901444280953/n11029935-sqs-queue";

const upload = multer({ dest: "uploads/" });

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  sessionToken: process.env.AWS_SESSION_TOKEN,
  region: "ap-southeast-2",
});

// Retrieve the object from S3
async function getObjectFromS3() {
  const params = {
    Bucket: s3Bucket,
    Key: "output.gif",
  };

  try {
    const data = await s3.getObject(params).promise();
    return data; // Return the data received from S3.
  } catch (err) {
    console.error("Error:", err);
    throw err; // Rethrow the error so that it can be handled by the caller.
  }
}

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

function sendSQSMessage(s3ObjectUrl, callback) {
  const params = {
    MessageBody: s3ObjectUrl, // Include the S3 object URL in the message.
    QueueUrl: sqsQueueUrl,
  };

  sqs.sendMessage(params, (err, data) => {
    if (err) {
      callback(err);
    } else {
      callback(null);
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
router.post("/upload", upload.single("video"), async (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  const inputVideoFilePath = req.file.path; // Use the uploaded video file.
  const outputFilePath = "downloads/output.gif"; // Specify the path where you want to save the output GIF.

  // GIF parameters
  const width = req.body.width;

  const height = req.body.height;

  const duration = req.body.duration;

  const framerate = req.body.framerate;

  let ffmpegCommand = ffmpeg(inputVideoFilePath);

  if (width && height) ffmpegCommand = ffmpegCommand.size(`${width}x${height}`);
  else if (width) ffmpegCommand = ffmpegCommand.size(`${width}x?`);
  else if (height) ffmpegCommand = ffmpegCommand.size(`?x${height}`);

  if (duration) ffmpegCommand = ffmpegCommand.setDuration(duration);
  if (framerate) ffmpegCommand = ffmpegCommand.fps(framerate);

  ffmpegCommand
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

          // Send a message to Amazon SQS.
          sendSQSMessage(s3Data.Location, (sqsErr) => {
            if (sqsErr) {
              console.error("SQS message sending error:", sqsErr);
              res.status(500).send("Error sending message to SQS");
            } else {
              console.log("SQS message sent successfully");
            }
          });
        }
        // Delete the temporary files
        cleanupFiles([inputVideoFilePath]);
      });
    })
    .on("error", (err) => {
      console.error("Error:", err);
      res.status(500).send("Error during conversion");
    })
    .save(outputFilePath);

  const s3Object = await getObjectFromS3();

  if (s3Object.Body) {
    // Create a data URI for the GIF content
    const gifDataUri = `data:image/gif;base64,${s3Object.Body.toString(
      "base64"
    )}`;
    res.render("Upload", { gifDataUri });
  } else {
    console.error("GIF content not found in S3 object.");
    res.status(500).send("Error: GIF content not found");
  }
});
module.exports = router;
