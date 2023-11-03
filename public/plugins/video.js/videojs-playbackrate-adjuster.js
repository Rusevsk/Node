(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.videojsPlaybackrateAdjuster = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
(function (global){(function (){
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

function _interopDefault(ex) {
  return ex && (typeof ex === 'undefined' ? 'undefined' : _typeof(ex)) === 'object' && 'default' in ex ? ex['default'] : ex;
}

var videojs = _interopDefault((typeof window !== "undefined" ? window['videojs'] : typeof global !== "undefined" ? global['videojs'] : null));

var createNewRanges = function createNewRanges(timeRanges, playbackRate) {
  var newRanges = [];

  for (var i = 0; i < timeRanges.length; i++) {
    newRanges.push([timeRanges.start(i) / playbackRate, timeRanges.end(i) / playbackRate]);
  }

  return videojs.createTimeRange(newRanges);
};

var playbackrateAdjuster = function playbackrateAdjuster(player) {
  var tech = void 0;

  player.on('ratechange', function () {
    tech.trigger('durationchange');
    tech.trigger('timeupdate');
  });

  return {
    setSource: function setSource(srcObj, next) {
      next(null, srcObj);
    },
    setTech: function setTech(newTech) {
      tech = newTech;
    },
    duration: function duration(dur) {
      return dur / player.playbackRate();
    },
    currentTime: function currentTime(ct) {
      return ct / player.playbackRate();
    },
    setCurrentTime: function setCurrentTime(ct) {
      return ct * player.playbackRate();
    },
    buffered: function buffered(bf) {
      return createNewRanges(bf, player.playbackRate());
    },
    seekable: function seekable(_seekable) {
      return createNewRanges(_seekable, player.playbackRate());
    },
    played: function played(_played) {
      return createNewRanges(_played, player.playbackRate());
    }
  };
};

// Register the plugin with video.js.
videojs.use('*', playbackrateAdjuster);

// Include the version number.
playbackrateAdjuster.VERSION = '1.0.1';

module.exports = playbackrateAdjuster;

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}]},{},[1])(1)
});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvanMvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7O0FDQUE7Ozs7QUFFQSxTQUFTLGVBQVQsQ0FBMEIsRUFBMUIsRUFBOEI7QUFBRSxTQUFRLE1BQU8sUUFBTyxFQUFQLHlDQUFPLEVBQVAsT0FBYyxRQUFyQixJQUFrQyxhQUFhLEVBQWhELEdBQXNELEdBQUcsU0FBSCxDQUF0RCxHQUFzRSxFQUE3RTtBQUFrRjs7QUFFbEgsSUFBSSxVQUFVLGdCQUFnQixRQUFRLFVBQVIsQ0FBaEIsQ0FBZDs7QUFFQSxJQUFNLGtCQUFrQixTQUFsQixlQUFrQixDQUFDLFVBQUQsRUFBYSxZQUFiLEVBQThCO0FBQ3BELE1BQU0sWUFBWSxFQUFsQjs7QUFFQSxPQUFLLElBQUksSUFBSSxDQUFiLEVBQWdCLElBQUksV0FBVyxNQUEvQixFQUF1QyxHQUF2QyxFQUE0QztBQUMxQyxjQUFVLElBQVYsQ0FBZSxDQUNiLFdBQVcsS0FBWCxDQUFpQixDQUFqQixJQUFzQixZQURULEVBRWIsV0FBVyxHQUFYLENBQWUsQ0FBZixJQUFvQixZQUZQLENBQWY7QUFHRDs7QUFFRCxTQUFPLFFBQVEsZUFBUixDQUF3QixTQUF4QixDQUFQO0FBQ0QsQ0FWRDs7QUFZQSxJQUFNLHVCQUF1QixTQUF2QixvQkFBdUIsQ0FBUyxNQUFULEVBQWlCO0FBQzVDLE1BQUksYUFBSjs7QUFFQSxTQUFPLEVBQVAsQ0FBVSxZQUFWLEVBQXdCLFlBQVc7QUFDakMsU0FBSyxPQUFMLENBQWEsZ0JBQWI7QUFDQSxTQUFLLE9BQUwsQ0FBYSxZQUFiO0FBQ0QsR0FIRDs7QUFLQSxTQUFPO0FBQ0wsYUFESyxxQkFDSyxNQURMLEVBQ2EsSUFEYixFQUNtQjtBQUN0QixXQUFLLElBQUwsRUFBVyxNQUFYO0FBQ0QsS0FISTtBQUtMLFdBTEssbUJBS0csT0FMSCxFQUtZO0FBQ2YsYUFBTyxPQUFQO0FBQ0QsS0FQSTtBQVNMLFlBVEssb0JBU0ksR0FUSixFQVNTO0FBQ1osYUFBTyxNQUFNLE9BQU8sWUFBUCxFQUFiO0FBQ0QsS0FYSTtBQWFMLGVBYkssdUJBYU8sRUFiUCxFQWFXO0FBQ2QsYUFBTyxLQUFLLE9BQU8sWUFBUCxFQUFaO0FBQ0QsS0FmSTtBQWlCTCxrQkFqQkssMEJBaUJVLEVBakJWLEVBaUJjO0FBQ2pCLGFBQU8sS0FBSyxPQUFPLFlBQVAsRUFBWjtBQUNELEtBbkJJO0FBcUJMLFlBckJLLG9CQXFCSSxFQXJCSixFQXFCUTtBQUNYLGFBQU8sZ0JBQWdCLEVBQWhCLEVBQW9CLE9BQU8sWUFBUCxFQUFwQixDQUFQO0FBQ0QsS0F2Qkk7QUF5QkwsWUF6Qkssb0JBeUJJLFNBekJKLEVBeUJjO0FBQ2pCLGFBQU8sZ0JBQWdCLFNBQWhCLEVBQTBCLE9BQU8sWUFBUCxFQUExQixDQUFQO0FBQ0QsS0EzQkk7QUE2QkwsVUE3Qkssa0JBNkJFLE9BN0JGLEVBNkJVO0FBQ2IsYUFBTyxnQkFBZ0IsT0FBaEIsRUFBd0IsT0FBTyxZQUFQLEVBQXhCLENBQVA7QUFDRDtBQS9CSSxHQUFQO0FBa0NELENBMUNEOztBQTRDQTtBQUNBLFFBQVEsR0FBUixDQUFZLEdBQVosRUFBaUIsb0JBQWpCOztBQUVBO0FBQ0EscUJBQXFCLE9BQXJCLEdBQStCLGFBQS9COztBQUVBLE9BQU8sT0FBUCxHQUFpQixvQkFBakIiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wRGVmYXVsdCAoZXgpIHsgcmV0dXJuIChleCAmJiAodHlwZW9mIGV4ID09PSAnb2JqZWN0JykgJiYgJ2RlZmF1bHQnIGluIGV4KSA/IGV4WydkZWZhdWx0J10gOiBleDsgfVxuXG52YXIgdmlkZW9qcyA9IF9pbnRlcm9wRGVmYXVsdChyZXF1aXJlKCd2aWRlby5qcycpKTtcblxuY29uc3QgY3JlYXRlTmV3UmFuZ2VzID0gKHRpbWVSYW5nZXMsIHBsYXliYWNrUmF0ZSkgPT4ge1xuICBjb25zdCBuZXdSYW5nZXMgPSBbXTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IHRpbWVSYW5nZXMubGVuZ3RoOyBpKyspIHtcbiAgICBuZXdSYW5nZXMucHVzaChbXG4gICAgICB0aW1lUmFuZ2VzLnN0YXJ0KGkpIC8gcGxheWJhY2tSYXRlLFxuICAgICAgdGltZVJhbmdlcy5lbmQoaSkgLyBwbGF5YmFja1JhdGVdKTtcbiAgfVxuXG4gIHJldHVybiB2aWRlb2pzLmNyZWF0ZVRpbWVSYW5nZShuZXdSYW5nZXMpO1xufTtcblxuY29uc3QgcGxheWJhY2tyYXRlQWRqdXN0ZXIgPSBmdW5jdGlvbihwbGF5ZXIpIHtcbiAgbGV0IHRlY2g7XG5cbiAgcGxheWVyLm9uKCdyYXRlY2hhbmdlJywgZnVuY3Rpb24oKSB7XG4gICAgdGVjaC50cmlnZ2VyKCdkdXJhdGlvbmNoYW5nZScpO1xuICAgIHRlY2gudHJpZ2dlcigndGltZXVwZGF0ZScpO1xuICB9KTtcblxuICByZXR1cm4ge1xuICAgIHNldFNvdXJjZShzcmNPYmosIG5leHQpIHtcbiAgICAgIG5leHQobnVsbCwgc3JjT2JqKTtcbiAgICB9LFxuXG4gICAgc2V0VGVjaChuZXdUZWNoKSB7XG4gICAgICB0ZWNoID0gbmV3VGVjaDtcbiAgICB9LFxuXG4gICAgZHVyYXRpb24oZHVyKSB7XG4gICAgICByZXR1cm4gZHVyIC8gcGxheWVyLnBsYXliYWNrUmF0ZSgpO1xuICAgIH0sXG5cbiAgICBjdXJyZW50VGltZShjdCkge1xuICAgICAgcmV0dXJuIGN0IC8gcGxheWVyLnBsYXliYWNrUmF0ZSgpO1xuICAgIH0sXG5cbiAgICBzZXRDdXJyZW50VGltZShjdCkge1xuICAgICAgcmV0dXJuIGN0ICogcGxheWVyLnBsYXliYWNrUmF0ZSgpO1xuICAgIH0sXG5cbiAgICBidWZmZXJlZChiZikge1xuICAgICAgcmV0dXJuIGNyZWF0ZU5ld1JhbmdlcyhiZiwgcGxheWVyLnBsYXliYWNrUmF0ZSgpKTtcbiAgICB9LFxuXG4gICAgc2Vla2FibGUoc2Vla2FibGUpIHtcbiAgICAgIHJldHVybiBjcmVhdGVOZXdSYW5nZXMoc2Vla2FibGUsIHBsYXllci5wbGF5YmFja1JhdGUoKSk7XG4gICAgfSxcblxuICAgIHBsYXllZChwbGF5ZWQpIHtcbiAgICAgIHJldHVybiBjcmVhdGVOZXdSYW5nZXMocGxheWVkLCBwbGF5ZXIucGxheWJhY2tSYXRlKCkpO1xuICAgIH1cblxuICB9O1xufTtcblxuLy8gUmVnaXN0ZXIgdGhlIHBsdWdpbiB3aXRoIHZpZGVvLmpzLlxudmlkZW9qcy51c2UoJyonLCBwbGF5YmFja3JhdGVBZGp1c3Rlcik7XG5cbi8vIEluY2x1ZGUgdGhlIHZlcnNpb24gbnVtYmVyLlxucGxheWJhY2tyYXRlQWRqdXN0ZXIuVkVSU0lPTiA9ICdfX1ZFUlNJT05fXyc7XG5cbm1vZHVsZS5leHBvcnRzID0gcGxheWJhY2tyYXRlQWRqdXN0ZXI7XG4iXX0=
