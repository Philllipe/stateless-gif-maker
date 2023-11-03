const express = require("express");
const AWS = require("aws-sdk");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
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
  console.log("Polling for messages...");
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
        downlaodS3AndProcessMessage(message);
      });
    } else {
      console.log("No messages to process...");
      pollQueue();
    }
  });
}

function downlaodS3AndProcessMessage(message) {
  // Extract the videoID
  const messageBody = JSON.parse(message.Body);
  const videoID = messageBody.videoID;
  const s3ObjectKey = `${videoID}.mp4`;

  // Create a writable stream to store the video file locally.
  const localFilePath = "./temp/" + s3ObjectKey;
  console.log(localFilePath);

  // Create parameters from the message body.
  const parameters = messageBody.parameters;

  // Fetch the video file from S3 and store it locally.
  const s3Params = {
    Bucket: s3Bucket,
    Key: s3ObjectKey,
  };

  const s3ReadStream = s3.getObject(s3Params).createReadStream();
  const writeStream = fs.createWriteStream(localFilePath);

  s3ReadStream.on("error", (err) => {
    console.error("Error downloading video from S3:", err);
    pollQueue();
  });

  s3ReadStream.pipe(writeStream);

  writeStream.on("close", () => {
    console.log("Download complete");
    processMessage(message, localFilePath, parameters);
  });
}

function processMessage(message, localFilePath, parameters) {
  let ffmpegCommand = ffmpeg(localFilePath);

  if (parameters.size) {
    ffmpegCommand = ffmpegCommand.size(parameters.size);
    console.log("size", parameters.size);
  }
  if (parameters.duration) {
    ffmpegCommand = ffmpegCommand.setDuration(parameters.duration);
  }
  if (parameters.framerate) {
    ffmpegCommand = ffmpegCommand.fps(parameters.framerate);
    console.log("framerate", parameters.framerate);
  }
  console.log("Converting to GIF");

  ffmpegCommand
    .toFormat("gif")
    .on("end", () => {
      console.log("GIF file created");
      const uploadParams = {
        Bucket: s3Bucket,
        Key: s3ObjectKey,
        Body: fs.createReadStream(localFilePath),
      };

      s3.upload(uploadParams, (err, data) => {
        if (err) {
          console.error("S3 upload error:", err);
        } else {
          console.log("GIF file uploaded to S3:", data.Location);

          const deleteParams = {
            QueueUrl: sqsQueueUrl,
            ReceiptHandle: message.ReceiptHandle,
          };

          sqs.deleteMessage(deleteParams, (err, data) => {
            if (err) {
              console.error("SQS message deletion error:", err);
            } else {
              console.log("SQS message deleted successfully");
              pollQueue();
            }
          });
        }
      });
    })
    .on("error", (err) => {
      console.error("Error during conversion:", err);
    });
  console.log("OUT");
}

pollQueue();

app.listen(port, () => {
  console.log(`Worker is running on port ${port}`);
});
