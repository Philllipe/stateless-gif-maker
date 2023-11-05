const express = require("express");
const router = express.Router();
const AWS = require("aws-sdk");
const fs = require("fs");
const path = require("path");

const s3 = new AWS.S3();
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
  console.log("uniqueID:", uniqueID);

  // Start polling S3 for the GIF and send the response to the user.
  //pollS3ForGif(uniqueID, res);
  res.render("convert", { uniqueID });
});

module.exports = router;
