module.exports = function(grunt) {
  'use strict';

  // Force use of Unix newlines
  grunt.util.linefeed = '\n';

  // Load grunt tasks automatically
  require('load-grunt-tasks')(grunt);

  // Time how long tasks take. Can help when optimizing build times
  require('time-grunt')(grunt);

  // Project configuration.
  grunt.initConfig({
    requirejs: {
      compile: {
        options: {
          baseUrl: "src/",
          out: 'harmonized.js',
          //name: 'harmonized',
          name: '../bower_components/almond/almond',
          optimize: 'none',
          mainConfigFile:'./main.js',
          paths: {
            'lodash': 'empty:',
            'rx': 'empty:',
            'rx.async': 'empty:',
          },
          wrap: {
            startFile: '.wrap-start.frag',
            endFile: '.wrap-end.frag'
          }
        }
      }
    },

    jscs: {
      src: 'src/**/*.js',
      options: {
        config: '.jscsrc',
        preset: 'airbnb',
        requireCurlyBraces: ['if']
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
        prereleaseName: 'alpha'
      }
    },
    jshint: {
      options: {
        jshintrc: '.jshintrc'
      },
      all: {
        src: [
          'src/{,*/}*.js'
        ]
      }
    },

    clean: {
      dist: 'dist',
      tmp: '.tmp'
    },

    uglify: {
      options: {
        preserveComments: 'none'
      },
      build: {
        src: '<%= requirejs.compile.options.out %>',
        dest: 'harmonized.min.js'
      }
    },

    copy: {},

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
          middleware: function(connect) {
            return [
              connect.static('.tmp'),
              connect().use(
                '/bower_components',
                connect.static('./bower_components')
              ),
              connect.static('src'),
              connect.static('examples')
            ];
          }
        }
      }
    },

    // Automatically inject Bower components into the app
    wiredep: {
      app: {
        src: ['examples/templates/index.html'],
        ignorePath: /\.\.\//
      }
    },

    includeSource: {
      options: {
        // Task-specific options go here.
      },
      target: {
        files: {
           'examples/index.html': 'examples/templates/index.html'
         }
      }
    },

    watch: {
      bower: {
        files: ['bower.json'],
        tasks: ['wiredep', 'includeSource']
      },
      src: {
        files: '<%= jshint.all.src %>',
        tasks: ['jshint:all', 'jscs', 'includeSource']
      },
      livereload: {
        options: {
          livereload: '<%= connect.options.livereload %>'
        },
        files: [
          'examples/{,*/}*.html'
        ]
      }
    }

  });

  // JS distribution task
  grunt.registerTask('dist-js', ['requirejs', 'uglify:build']);

  // Full distribution task
  grunt.registerTask('dist', ['jscs', 'clean:dist', 'dist-js']);

  // Full release task
  grunt.registerTask('release', 'bump and changelog', function(type) {
    grunt.task.run([
      'dist',
      'bump:' + (type || 'patch') + ':bump-only',
      //'changelog',
      'bump-commit'
    ]);
  });

  // Default task
  grunt.registerTask('default', ['clean:dist']);

  // Serve task
  grunt.registerTask('serve', ['clean', 'connect', 'watch']);
};
