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

let concurrentTasks = 0;
const maxConcurrentTasks = 5;

// Function to Poll the SQS queue for message to process
function pollQueue() {
  if (concurrentTasks >= maxConcurrentTasks) {
    console.log("Max concurrent tasks reached. Waiting...");
    setTimeout(() => pollQueue(), 10000); // Retry after a delay
    return;
  }

  const params = {
    QueueUrl: sqsQueueUrl,
    MaxNumberOfMessages: 1,
    WaitTimeSeconds: 20,
  };

  sqs.receiveMessage(params, (err, data) => {
    if (err) {
      console.error("SQS Receive Error:", err);
      return;
    }

    // Process the message if it exists.
    if (data.Messages) {
      data.Messages.forEach((message) => {
        processMessage(message);
      });
    }
    // Poll the queue again.
    pollQueue();
  });
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

// Function to process the message from the SQS queue
function processMessage(message) {
  const messageBody = JSON.parse(message.Body); // Parse the message body for information
  const uniqueID = messageBody.uniqueID; // Extract the uniqueID
  const fileExtension = messageBody.fileExtension; // Extract the file extension
  const s3ObjectKey = `${uniqueID}.${fileExtension}`; // Create the S3 object key

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

  // Create a readable stream from the S3 object.
  const s3ReadStream = s3.getObject(s3Params).createReadStream();
  // Pipe the read stream to the write stream.
  s3ReadStream.pipe(writeStream);

  // Set a visibility timeout for the message
  const visibilityTimeout = 600; // 600 seconds / 10 minutes
  const visibilityParams = {
    QueueUrl: sqsQueueUrl,
    ReceiptHandle: message.ReceiptHandle,
    VisibilityTimeout: visibilityTimeout,
  };

  // Set the visibility timeout for the message.
  sqs.changeMessageVisibility(visibilityParams, (err, data) => {
    if (err) {
      console.error("Error setting visibility timeout:", err);
      return;
    }

    // Wait for the download to finish.
    s3ReadStream.on("end", () => {
      // Continue with the rest of the processing.
      let ffmpegCommand = ffmpeg(videoFilePath);

      ffmpegCommand = ffmpegCommand.addOption("-threads", "0"); // Use all available CPU cores.

      // Set the parameters for the conversion if they exist.
      if (parameters.size) ffmpegCommand = ffmpegCommand.size(parameters.size);
      if (parameters.duration)
        ffmpegCommand = ffmpegCommand.setDuration(parameters.duration);
      if (parameters.framerate)
        ffmpegCommand = ffmpegCommand.fps(parameters.framerate);

      const gifFilePath = path.join("./temp", `${uniqueID}.gif`); // Create a path for the GIF file.
      const s3GIFObjectKey = `${uniqueID}.gif`; // Create the S3 object key for the GIF file.

      console.log(`Converting ${uniqueID} to GIF...`);

      // Increment the number of concurrent tasks.
      concurrentTasks++;
      ffmpegCommand
        .toFormat("gif")
        .on("end", () => {
          console.log(`Converted ${uniqueID} to GIF...`);
          // Conversion finished, send the GIF back to S3, overwriting the original file.
          const uploadParams = {
            Bucket: s3Bucket,
            Key: s3GIFObjectKey, // Use the original video file name.
            Body: fs.createReadStream(gifFilePath),
          };

          s3.upload(uploadParams, (err, data) => {
            if (err) {
              console.error("S3 upload error:", err);
              cleanupFiles([gifFilePath]);
              concurrentTasks--;
            } else {
              console.log(`...Uploaded ${uniqueID} to GIF`);
              cleanupFiles([gifFilePath]);

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
              concurrentTasks--;
            }
          });
          cleanupFiles([videoFilePath]);
        })
        .on("error", (err) => {
          console.error("Error during conversion:", err);
          cleanupFiles([videoFilePath, gifFilePath]);
          concurrentTasks--;
        })
        .save(gifFilePath);
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
