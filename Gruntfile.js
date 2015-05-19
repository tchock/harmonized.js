module.exports = function (grunt) {
  'use strict';

  // Force use of Unix newlines
  grunt.util.linefeed = '\n';

  // Load grunt tasks automatically
  require('load-grunt-tasks')(grunt);

  // Time how long tasks take. Can help when optimizing build times
  require('time-grunt')(grunt);

  var pkg = require('./package.json');

  // Project configuration.
  grunt.initConfig({
    jscs: {
      src: 'src/*.js',
      options: {
        config: '.jscsrc',
        preset: 'airbnb',
        requireCurlyBraces: ["if"]
      }
    },
    changelog: {
      options: {
        to: 'HEAD'
      }
    },
    bump: {
      options: {
        files: ['package.json', 'bower.json'],
        updateConfigs: [],
        commit: true,
        commitMessage: 'Release %VERSION%',
        commitFiles: ['package.json', 'bower.json', 'CHANGELOG.md',
          'harmonized.js', 'harmonized.min.js'
        ],
        createTag: true,
        tagName: '%VERSION%',
        tagMessage: 'Version %VERSION%',
        push: true,
        pushTo: 'origin',
        prereleaseName: 'alpha',
      }
    },
    jshint: {
      options: {
        jshintrc: '.jshintrc'
      },
      all: {
        src: [
          'src/js/{,*/}*.js'
        ]
      },
    },

    clean: {
      dist: 'dist',
      tmp: '.tmp'
    },

    concat: {
      build: {
        src: [
          'src/js/*.js'
        ],
        dest: 'harmonized.js'
      }
    },

    uglify: {
      options: {
        preserveComments: 'some'
      },
      build: {
        src: '<%= concat.build.dest %>',
        dest: 'harmonized.min.js'
      }
    },

    copy: {
    },

    connect: {
      options: {
        port: 9000,
        // Change this to '0.0.0.0' to access the server from outside.
        hostname: '0.0.0.0',
        livereload: 35729
      },
      livereload: {
        options: {
          open: true,
          middleware: function (connect) {
            return [
              connect.static('.tmp'),
              connect().use(
                '/bower_components',
                connect.static('./bower_components')
              ),
              connect.static('src')
            ];
          }
        }
      }
    },



    watch: {
      src: {
        files: '<%= jshint.all.src %>',
        tasks: ['jshint:all', 'concat']
      },
      livereload: {
        options: {
          livereload: '<%= connect.options.livereload %>'
        },
        files: [
          'src/{,*/}*.html',
        ]
      }
    },

  });

  // JS distribution task
  grunt.registerTask('dist-js', ['concat', 'uglify:build']);

  // Full distribution task
  grunt.registerTask('dist', ['jscs', 'clean:dist', 'dist-js']);

  // Full release task
  grunt.registerTask('release', 'bump and changelog', function(type) {
    grunt.task.run([
      'dist',
      'bump:' + (type || 'patch') + ':bump-only',
      'changelog',
      'bump-commit'
    ]);
  });

  // Default task
  grunt.registerTask('default', ['clean:dist']);

  // Serve task
  grunt.registerTask('serve', ['clean', 'connect', 'watch']);
};
