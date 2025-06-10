module.exports = function(grunt) {
  grunt.initConfig({
    uglify: {
      options: { compress: true, sourceMap: true },
      target: {
        files: [{
          expand: true,
          cwd: 'build/static/js',
          src: ['*.js'],
          dest: 'build/static/js/min',
          ext: '.min.js'
        }]
      }
    },
    cssmin: {
      target: {
        files: [{
          expand: true,
          cwd: 'build/static/css',
          src: ['*.css'],
          dest: 'build/static/css/min',
          ext: '.min.css'
        }]
      }
    },
    replace: {
      firebase: {
        src: ['build/**/*.html'],
        overwrite: true,
        replacements: [{
          from: '<!-- FIREBASE_CONFIG -->',
          to: '<script src="/__/firebase/init.js"></script>'
        }]
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-text-replace');

  grunt.registerTask('build', ['uglify', 'cssmin', 'replace']);
};
