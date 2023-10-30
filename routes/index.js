var express = require('express');
var router = express.Router();

const ffmpeg = require('ffmpeg');

require('dotenv').config();
const AWS = require('aws-sdk');

//files
const inputFilePath = './TestFile.mp4';
const outputFilePath = './Outputvideos/New_File.mp4';

//helpfull Links
//https://www.npmjs.com/package/ffmpeg

/* GET home page. */
router.get('/', function(req, res, next) 
{
  try {
    //process video
    var process = new ffmpeg(inputFilePath);
    process.then(function (video) {
        // Video metadata
        console.log('data: ');
        console.log(video.metadata)

        // FFmpeg configuration
        console.log('config:');
        console.log(video.info_configuration);

        //edit video - not done
        //video.setVideoFormat('avi');
        video.setDisableAudio();
        video.setVideoDuration(20);

        //save video
        video.save(outputFilePath, function (error, file) {
            if (!error)
                console.log('Video file: ' + file);
        });

        //save video to S3 - not done
        const body = JSON.stringify({
            source: "S3 Bucket",
            ...video,
        });

        const objectParams = { Bucket: bucketName, Key: s3Key, Body: body };

        s3.putObject(objectParams).promise();

        console.log(`Successfully uploaded data to ${bucketName}${s3Key}`);

        //return video - not done


      }, function (err) {
          console.log('Error: ' + err);
      });
  } catch (e) {
      console.log('hit: ' + e.code);
      console.log('hited: ' + e.msg);
  }

  res.render("index", {});
});


module.exports = router;
