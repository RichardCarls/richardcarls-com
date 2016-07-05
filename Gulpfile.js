var DEV = Boolean(process.env.NODE_ENV == 'development');

require('es6-promise').polyfill();

var gulp = require('gulp'),
    concat = require('gulp-concat'),
    rename = require('gulp-rename'),
    sourcemaps = require('gulp-sourcemaps'),
    uglify = require('gulp-uglify'),
    sass = require('gulp-sass'),
    autoprefixer = require('gulp-autoprefixer');

var config = {
    scssPath: './scss',
    assetsPath: './public_http/assets',
};

gulp.task('sass', function() {
    gulp
        .src(config.scssPath + '/richardcarls.scss')
        .pipe(sourcemaps.init())
        .pipe(sass({
            includePaths: [config.scssPath],
        }))
        .pipe(autoprefixer({
            browsers: ['last 2 versions'],
        }))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest(config.assetsPath + '/css'));
});

gulp.task('watch', function() {
    var sassOptions = {
        name: 'Sass',
        ignoreInitial: true,
        verbose: DEV,
    };

    gulp
        .watch(config.scssPath + '/**/*.scss', sassOptions, ['sass']);
});

gulp.task('build', ['sass',]);
gulp.task('default', ['build']);
