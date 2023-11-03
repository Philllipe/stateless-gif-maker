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
        processMessage(message);
      });
    } else {
      console.log("No messages to process...");
      pollQueue();
    }
    pollQueue();
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

function processMessage(message) {
  // Extract the videoID
  const messageBody = JSON.parse(message.Body);
  const videoID = messageBody.videoID;
  const s3ObjectKey = `${videoID}.mp4`;

  // Create a writable stream to store the video file locally.
  const inputFilePath = path.join("./temp", s3ObjectKey);
  const writeStream = fs.createWriteStream(inputFilePath);

  // Create parameters from the message body.
  const parameters = messageBody.parameters;

  // Fetch the video file from S3 and store it locally.
  const s3Params = {
    Bucket: s3Bucket,
    Key: s3ObjectKey,
  };

  const s3ReadStream = s3.getObject(s3Params).createReadStream();
  s3ReadStream.pipe(writeStream);

  // Wait for the download to finish.
  s3ReadStream.on("end", () => {
    console.log("Video downloaded from S3...");
    // Continue with the rest of the processing.
    let ffmpegCommand = ffmpeg(inputFilePath);

    if (parameters.size) ffmpegCommand = ffmpegCommand.size(parameters.size);
    if (parameters.duration)
      ffmpegCommand = ffmpegCommand.setDuration(parameters.duration);

    if (parameters.framerate)
      ffmpegCommand = ffmpegCommand.fps(parameters.framerate);

    console.log("Converting to GIF...");
    const outputFilePath = path.join("./temp", `${videoID}.gif`);
    const s3GIFObjectKey = `${videoID}.gif`;

    ffmpegCommand
      .toFormat("gif")
      .on("end", () => {
        // Conversion finished; send the GIF back to S3, overwriting the original file.
        const uploadParams = {
          Bucket: s3Bucket,
          Key: s3GIFObjectKey, // Use the original video file name.
          Body: fs.createReadStream(outputFilePath),
        };

        s3.upload(uploadParams, (err, data) => {
          if (err) {
            console.error("S3 upload error:", err);
          } else {
            console.log("GIF file uploaded to S3:", data.Location);

            // Delete the original .mp4 file from S3
            const deleteMP4Params = {
              Bucket: s3Bucket,
              Key: s3ObjectKey,
            };

            s3.deleteObject(deleteMP4Params, (err, data) => {
              if (err) {
                console.error("Error deleting original .mp4:", err);
              } else {
                console.log("Original .mp4 file deleted from S3");
              }

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
                  pollQueue();
                }
              });
            });
          }
          cleanupFiles([inputFilePath, outputFilePath]);
        });
      })
      .on("error", (err) => {
        console.error("Error during conversion:", err);
      })
      .save(outputFilePath);
  });

  // Handle any errors during the download.
  s3ReadStream.on("error", (err) => {
    console.error("Error downloading video from S3:", err);
  });
}

pollQueue();

app.listen(port, () => {
  console.log(`Worker is running on port ${port}`);
});
