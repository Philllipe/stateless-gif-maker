const express = require("express");
const router = express.Router();

const multer = require("multer");
const AWS = require("aws-sdk");
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

// // Retrieve the object from S3
// async function getObjectFromS3() {
//   const params = {
//     Bucket: s3Bucket,
//     Key: "output.gif",
//   };

//   try {
//     const data = await s3.getObject(params).promise();
//     return data; // Return the data received from S3.
//   } catch (err) {
//     console.error("Error:", err);
//     throw err; // Rethrow the error so that it can be handled by the caller.
//   }
// }

async function uploadVideoToS3(filePath, videoID) {
  const uploadParams = {
    Bucket: s3Bucket,
    Key: `${videoID}.mp4`, // Object key in S3.
    Body: fs.createReadStream(filePath),
  };

  try {
    await s3.upload(uploadParams).promise();
    // log the location
    console.log(`File uploaded successfully uploaded to ${s3Bucket}`);
  } catch (err) {
    console.error("S3 upload error:", err);
    throw err; // You might want to handle this error differently in your application.
  }
}

async function sendSQSMessage(videoID, parameters) {
  const params = {
    MessageBody: JSON.stringify({ videoID, parameters }), // Include the video ID and parameters in the message.
    QueueUrl: sqsQueueUrl,
  };

  try {
    await sqs.sendMessage(params).promise();
    console.log("SQS message sent successfully");
  } catch (err) {
    console.error("SQS message sending error:", err);
    throw err; // You might want to handle this error differently in your application.
  }
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
  const videoID = `${Date.now()}`; // Generate a unique video ID

  // GIF parameters
  const parameters = {};
  const width = req.body.width;
  const height = req.body.height;
  const duration = req.body.duration;
  const framerate = req.body.framerate;

  if (width && height) parameters.size = `${width}x${height}`;
  else if (width) parameters.size = `${width}x?`;
  else if (height) parameters.size = `?x${height}`;

  if (duration) parameters.duration = duration;
  if (framerate) parameters.framerate = framerate;

  await uploadVideoToS3(inputVideoFilePath, videoID);
  await sendSQSMessage(videoID, parameters);

  res.status(200).send("File uploaded successfully.");
  cleanupFiles([inputVideoFilePath]);
});
module.exports = router;
