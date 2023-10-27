
//set up page
const express = require('express');
const responseTime = require('response-time')

//set up systems
const ffmpeg = require('ffmpeg');

const app = express();
app.use(responseTime());

const axios = require('axios');
const redis = require('redis');

require('dotenv').config();
const AWS = require('aws-sdk');

//files
const inputFilePath = './TestFile.mp4';
const outputFilePath = './Outputvideos/New_File.mp4';


//helpfull Links
//https://www.npmjs.com/package/ffmpeg

// Cloud Services Set-up 
// Create unique bucket name
const bucketName = "CAB-432-Video-Program";
const s3 = new AWS.S3({ apiVersion: "2006-03-01" });

(async () => {
    try {
        await s3.createBucket({ Bucket: bucketName }).promise();
        console.log(`Created bucket: ${bucketName}`);
    } catch (err) {
        // We will ignore 409 errors which indicate that the bucket already exists
        if (err.statusCode !== 409) {
            console.log(`Error creating bucket: ${err}`);
        }
    }
})();


//test if everything set up
app.get("/test", async (req, res) => {




    
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
            video.setVideoDuration(20)

            //save video to redis
            video.save(outputFilePath, function (error, file) {
                if (!error)
                    console.log('Video file: ' + file);
            });

            //save video to S3 - not done
            const body = JSON.stringify({
                source: "S3 Bucket",
                ...video.metadata,
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



    

    res.json();
});

app.listen(3000, () => {
    console.log("Server listening on port: ", 3000);
});