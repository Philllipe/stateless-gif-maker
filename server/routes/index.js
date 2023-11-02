var express = require("express");
var router = express.Router();
const cors = require("cors");
router.use(cors());

const ffmpeg = require("ffmpeg");

require("dotenv").config();
const AWS = require("aws-sdk");

//files
const inputFilePath = "TestFile.mp4";
const outputFilePath = "Outputvideos/New_File.gif";

//helpfull Links
//https://www.npmjs.com/package/ffmpeg

// Home Page
router.get("/", function (req, res, next) {
  res.render("index", { title: "Video Backend" });
});

router.get("/", function (req, res, next) {
  try {
    //process video
    var process = new ffmpeg(inputFilePath);
    process.then(
      function (video) {
        // Video metadata
        //console.log('data: ');
        //console.log(video.metadata)

        // FFmpeg configuration
        //console.log('config:');
        //console.log(video.info_configuration);

        //edit video - not done
        video.setVideoFormat("gif");

        // if(size){
        //     video.setVideoSize('640x480', true, false);
        // }

        // if(duration){
        //     video.setVideoDuration(5);
        // }

        //save video
        video.save(outputFilePath, function (error, file) {
          if (!error) console.log("Video file: " + file);
        });

        //save video to S3 - not done
        const body = video;

        const objectParams = { Bucket: bucketName, Key: s3Key, Body: body };

        s3.putObject(objectParams).promise();

        console.log(`Successfully uploaded data to ${bucketName}${s3Key}`);

        //return video - not done
      },
      function (err) {
        console.log("Error: " + err);
      }
    );
  } catch (e) {
    console.log("hit: " + e.code);
    console.log("hited: " + e.msg);
  }
});

module.exports = router;
