var concat = require('gulp-concat');

gulp.task('scripts', function() {
  return gulp.src('src/*')
    .pipe(concat('serverclock.js'))
    .pipe(gulp.dest('./dist/'));
});
