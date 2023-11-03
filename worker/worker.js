const express = require("express");
const AWS = require("aws-sdk");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const os = require("os");
const path = require("path");

require("dotenv").config();

const app = express();
const port = 8000;

const s3 = new AWS.S3();
const sqs = new AWS.SQS({ region: "ap-southeast-2" });

const s3Bucket = "n11029935-assignment-2";
const sqsQueueUrl =
  "https://sqs.ap-southeast-2.amazonaws.com/901444280953/n11029935-sqs-queue";

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  sessionToken: process.env.AWS_SESSION_TOKEN,
  region: "ap-southeast-2",
});

function pollQueue() {
  const params = {
    QueueUrl: sqsQueueUrl,
    MaxNumberOfMessages: 1,
    WaitTimeSeconds: 10, // Adjust this as needed.
  };

  sqs.receiveMessage(params, (err, data) => {
    if (err) {
      console.error("SQS Receive Error:", err);
      return;
    }

    if (data.Messages) {
      data.Messages.forEach((message) => {
        processMessage(message);
      });
    }

    pollQueue();
  });
}

function processMessage(message) {
  // Extract the videoID and construct the S3 object URL
  const messageBody = JSON.parse(message.Body);
  const videoID = messageBody.videoID;
  const s3ObjectUrl = `https://${s3Bucket}.s3.amazonaws.com/${videoID}.mp4`;
  const gifFilePath = path.join("./temp", `${videoID}.gif`);

  // Extract parameters like size, duration, and framerate from the message body.
  const parameters = messageBody.parameters;
  console.log(videoID);
  console.log(parameters);

  let ffmpegCommand = ffmpeg(s3ObjectUrl);

  if (parameters.size) ffmpegCommand = ffmpegCommand.size(parameters.size);

  if (parameters.duration)
    ffmpegCommand = ffmpegCommand.setDuration(parameters.duration);

  if (parameters.framerate)
    ffmpegCommand = ffmpegCommand.fps(parameters.framerate);

  ffmpegCommand
    .toFormat("gif")
    .on("end", () => {
      // Conversion finished; send the GIF back to S3, overwriting the original file.
      const uploadParams = {
        Bucket: s3Bucket,
        Key: path.basename(s3ObjectUrl), // Use the original video file name.
        Body: fs.createReadStream(gifFilePath),
      };

      s3.upload(uploadParams, (err, data) => {
        if (err) {
          console.error("S3 upload error:", err);
        } else {
          console.log("GIF file uploaded to S3:", data.Location);
        }
      });
    })
    .on("error", (err) => {
      console.error("Error during conversion:", err);
    });

  // // Delete the temporary files.
  // fs.unlink(gifFilePath, (err) => {
  //   if (err) {
  //     console.error("Error deleting temporary file:", err);
  //   }
  // });

  // Delete the message from the queue.
  const deleteParams = {
    QueueUrl: sqsQueueUrl,
    ReceiptHandle: message.ReceiptHandle,
  };

  sqs.deleteMessage(deleteParams, (err, data) => {
    if (err) {
      console.error("SQS message deletion error:", err);
    } else {
      console.log("SQS message deleted successfully");
    }
  });
}

pollQueue();

app.listen(port, () => {
  console.log(`Worker is running on port ${port}`);
});
