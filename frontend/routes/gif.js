const express = require("express");
const router = express.Router();
const AWS = require("aws-sdk");
const fs = require("fs");
const path = require("path");

const s3 = new AWS.S3({ region: "ap-southeast-2" });
const s3Bucket = "n11029935-assignment-2";
const pollInterval = 5000; // Poll every 5 seconds

// Route to get the GIF from S3
router.get("/:uniqueID", (req, res) => {
  const { uniqueID } = req.params;
  const pollForGIF = () => {
    const gifKey = `${uniqueID}.gif`;

    // Check if the GIF exists in S3
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
        res.render("gif", { uniqueID, s3Url });
      }
    });
  };
  pollForGIF();
});

module.exports = router;
