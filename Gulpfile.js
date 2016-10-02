var Promise = require('es6-promise').Promise;

var gulp = require('gulp');
var cssimport = require('gulp-cssimport');
var autoprefixer = require('gulp-autoprefixer');
var sourcemaps = require('gulp-sourcemaps');

gulp.task('styles', function() {
  var autoprefixerOpts = {
    browsers: [
      'ie >= 9',
      'android >= 3',
      '> 5%',
    ],
  };
  
  return gulp.src('./css/main.css')
    //.pipe(sourcemaps.init())
    .pipe(cssimport())
    .pipe(autoprefixer(autoprefixerOpts))
    //.pipe(sourcemaps.write('./'))
    .pipe(gulp.dest('./public_http/assets/css'));
});

gulp.task('watch', ['styles'], function() {
  gulp.watch('./css/**/*.css', ['styles']);
});

gulp.task('default', ['watch']);
