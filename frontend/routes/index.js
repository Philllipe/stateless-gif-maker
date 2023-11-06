const express = require("express");
const router = express.Router();

const multer = require("multer");
const AWS = require("aws-sdk");
const fs = require("fs");

const s3 = new AWS.S3({ region: "ap-southeast-2" });
const sqs = new AWS.SQS({ region: "ap-southeast-2" });

const s3Bucket = "n11029935-assignment-2";
const sqsQueueUrl =
  "https://sqs.ap-southeast-2.amazonaws.com/901444280953/n11029935-sqs-queue";

const upload = multer({ dest: "uploads/" });

// Function to upload the video to S3
async function uploadVideoToS3(filePath, uniqueID, fileExtension) {
  const uploadParams = {
    Bucket: s3Bucket,
    Key: `${uniqueID}.${fileExtension}`,
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

// Function to send the SQS message
async function sendSQSMessage(uniqueID, fileExtension, parameters) {
  const params = {
    MessageBody: JSON.stringify({
      uniqueID: uniqueID,
      fileExtension,
      parameters,
    }), // Include the video ID and parameters in the message.
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

// Function to clean up files from the local filesystem
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
  res.render("index");
});

// Upload Page
router.post("/gif", upload.single("video"), async (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  const inputVideoFilePath = req.file.path; // Use the uploaded video file.

  const uniqueID = `${Date.now()}`; // Generate a unique video ID
  const fileExtension = req.file.originalname.split(".").pop();

  // GIF parameters
  const parameters = {};
  const width = req.body.width;
  const height = req.body.height;
  const duration = req.body.duration;
  const framerate = req.body.framerate;

  // Set the parameters if they are defined (for allowing no parameters)
  if (width && height) parameters.size = `${width}x${height}`;
  else if (width) parameters.size = `${width}x?`;
  else if (height) parameters.size = `?x${height}`;

  if (duration) parameters.duration = duration;
  if (framerate) parameters.framerate = framerate;

  // Upload the video to S3 and send the SQS message
  await uploadVideoToS3(inputVideoFilePath, uniqueID, fileExtension);
  await sendSQSMessage(uniqueID, fileExtension, parameters);

  // Redirect to the GIF page
  res.status(200).redirect(`/gif/${uniqueID}`);

  cleanupFiles([inputVideoFilePath]);
});
module.exports = router;
