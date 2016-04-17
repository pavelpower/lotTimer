var concat = require('gulp-concat');

gulp.task('scripts', function() {
  return gulp.src('src/*')
    .pipe(concat('ServerClock.js'))
    .pipe(gulp.dest('./dist/'));
});
