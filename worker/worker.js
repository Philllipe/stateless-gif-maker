const express = require("express");
const AWS = require("aws-sdk");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");

const app = express();
const port = 8000;

const s3 = new AWS.S3({ region: "ap-southeast-2" });
const sqs = new AWS.SQS({ region: "ap-southeast-2" });

const s3Bucket = "n11029935-assignment-2";
const sqsQueueUrl =
  "https://sqs.ap-southeast-2.amazonaws.com/901444280953/n11029935-sqs-queue";

function pollQueue() {
  const params = {
    QueueUrl: sqsQueueUrl,
    MaxNumberOfMessages: 1,
    WaitTimeSeconds: 20, // Adjust this as needed.
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
  // Extract the uniqueID
  const messageBody = JSON.parse(message.Body);
  const uniqueID = messageBody.uniqueID;
  const fileExtension = messageBody.fileExtension;
  const s3ObjectKey = `${uniqueID}.${fileExtension}`;

  // Create a writable stream to store the video file locally.
  const videoFilePath = path.join("./temp", s3ObjectKey);
  const writeStream = fs.createWriteStream(videoFilePath);

  // Create parameters from the message body.
  const parameters = messageBody.parameters;

  // Fetch the video file from S3 and store it locally.
  const s3Params = {
    Bucket: s3Bucket,
    Key: s3ObjectKey,
  };

  const s3ReadStream = s3.getObject(s3Params).createReadStream();
  s3ReadStream.pipe(writeStream);

  // Set a visibility timeout for the message (e.g., 5 minutes = 300 seconds)
  const visibilityTimeout = 300;
  const visibilityParams = {
    QueueUrl: sqsQueueUrl,
    ReceiptHandle: message.ReceiptHandle,
    VisibilityTimeout: visibilityTimeout,
  };

  sqs.changeMessageVisibility(visibilityParams, (err, data) => {
    if (err) {
      console.error("Error setting visibility timeout:", err);
      return;
    }

    // Wait for the download to finish.
    s3ReadStream.on("end", () => {
      // Continue with the rest of the processing.
      let ffmpegCommand = ffmpeg(videoFilePath);

      ffmpegCommand = ffmpegCommand.addOption("-threads", "0");

      if (parameters.size) ffmpegCommand = ffmpegCommand.size(parameters.size);
      if (parameters.duration)
        ffmpegCommand = ffmpegCommand.setDuration(parameters.duration);

      if (parameters.framerate)
        ffmpegCommand = ffmpegCommand.fps(parameters.framerate);

      const gifFilePath = path.join("./temp", `${uniqueID}.gif`);
      const s3GIFObjectKey = `${uniqueID}.gif`;

      console.log(`Converting ${uniqueID} to GIF...`);
      ffmpegCommand
        .toFormat("gif")
        .on("end", () => {
          console.log(`Converted ${uniqueID} to GIF...`);
          // Conversion finished; send the GIF back to S3, overwriting the original file.
          const uploadParams = {
            Bucket: s3Bucket,
            Key: s3GIFObjectKey, // Use the original video file name.
            Body: fs.createReadStream(gifFilePath),
          };

          s3.upload(uploadParams, (err, data) => {
            if (err) {
              console.error("S3 upload error:", err);
            } else {
              console.log(`...Uploaded ${uniqueID} to GIF`);
              cleanupFiles([gifFilePath]);
            }
          });
          cleanupFiles([videoFilePath]);
        })
        .on("error", (err) => {
          console.error("Error during conversion:", err);
          cleanupFiles([videoFilePath, gifFilePath]);
        })
        .save(gifFilePath);

      s3.deleteObject(s3Params, (err, data) => {
        if (err) {
          console.error("Error deleting original video:", err);
        } else {
          console.log("Original video file deleted from S3");
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
          }
        });
      });
    });

    // Handle any errors during the download.
    s3ReadStream.on("error", (err) => {
      console.error(
        "Error downloading original video " + s3ObjectKey + ":",
        err
      );
    });
  });
}

app.get("/", (req, res) => {
  res.send("Worker is running"); // Send a response when the root URL is accessed.
});

pollQueue();

app.listen(port, () => {
  console.log(`Worker is running on port ${port}`);
});
