const express = require("express");
const router = express.Router();
const AWS = require("aws-sdk");
const fs = require("fs");
const path = require("path");

const s3 = new AWS.S3();
const s3Bucket = "n11029935-assignment-2";
const pollInterval = 5000; // Poll every 5 seconds (adjust as needed).

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  sessionToken: process.env.AWS_SESSION_TOKEN,
  region: "ap-southeast-2",
});

// This route can be used to initiate the GIF conversion process.
router.get("/:uniqueID", (req, res) => {
  const { uniqueID } = req.params;

  // Function to check if the GIF exists in S3
  const pollForGIF = () => {
    const gifKey = `${uniqueID}.gif`; // Assuming your GIFs have the .gif extension

    s3.headObject({ Bucket: s3Bucket, Key: gifKey }, (err, data) => {
      if (err) {
        // The GIF doesn't exist in S3 yet. Poll again after a delay.
        setTimeout(pollForGIF, pollInterval);
      } else {
        // The GIF exists in S3. Generate a temporary URL and render the page.
        const s3Url = s3.getSignedUrl("getObject", {
          Bucket: s3Bucket,
          Key: gifKey,
        });

        // Render the page with the GIF URL
        res.render("convert", { uniqueID, s3Url });
      }
    });
  };

  // Start checking if the GIF exists in S3
  pollForGIF();
});

module.exports = router;
