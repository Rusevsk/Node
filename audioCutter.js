// audioCutter.js
const ffmpeg = require('fluent-ffmpeg');

function cutAudio(inputFile, start, duration, outputFile, callback) {
  ffmpeg(inputFile)
    .setStartTime(start)
    .setDuration(duration)
    .output(outputFile)
    .on('end', function() {
      callback(null);
    })
    .on('error', function(err) {
      callback(err);
    })
    .run();
}

module.exports = cutAudio;
