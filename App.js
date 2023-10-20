
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
const inputFilePath = 'TestFile.mp4';
const outputFilePath = 'Outputvideos';


//helpfull Links
//https://www.npmjs.com/package/ffmpeg




//test if everything set up
app.get("/test", async (req, res) => {
    try {
        //process video - not done (doesn't seem to have any data on the video or be able to save it)
        var process = new ffmpeg(inputFilePath);
        process.then(function (video) {
            // Video metadata
            console.log(video.metadata);
            // FFmpeg configuration
            console.log(video.info_configuration);

            //Testing
            video.setVideoFormat('avi');
            video.save(outputFilePath, function (error, file) {
                if (!error)
                    console.log('Video file: ' + file);
            });
        }, function (err) {
            console.log('Error: ' + err);
        });
    } catch (e) {
        console.log(e.code);
        console.log(e.msg);
    }

    //edit video - not done

    //save video to redis - not done

    //save video to S3 - not done

    //return video - not done

    res.json();  
});

app.listen(3000, () => {
    console.log("Server listening on port: ", 3000);
});