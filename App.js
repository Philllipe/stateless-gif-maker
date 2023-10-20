
//set up page
const express = require('express');
const responseTime = require('response-time')

//set up systems
const ffmpeg = require('ffmpeg');
const command = ffmpeg();

const app = express();
app.use(responseTime());

//files
const inputFilePath = 'C:\Users\timot\OneDrive\Desktop\Uni stuff\Cloud\GitHub\Cloud-Project\TestFile.mp4';
const outputFilePath = 'C:\Users\timot\OneDrive\Desktop\Uni stuff\Cloud\GitHub\Cloud-Project\TestFile.mp4';


//helpfull videos
//https://www.youtube.com/watch?v=26Mayv5JPz0
//https://ffmpeg.org/documentation.html




//test if everything set up
app.get("/test", async (req, res) => {
    
    command.input(inputFilePath);

    // Video codec, in this case, we'll use libx264 for MP4 format
    command.videoCodec('libx264');

    // Audio codec
    command.audioCodec('aac');

    // Output file
    command.output(outputFilePath);

    // Run the FFmpeg command
    command.on('end', () => {
        res.json('Conversion finished');
        console.log('Conversion finished');
    })
    .on('error', (err) => {
        res.json('Error:');
        console.error('Error:', err);
    })
    .run();

    
});

app.listen(3000, () => {
    console.log("Server listening on port: ", 3000);
});