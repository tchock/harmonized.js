// Karma configuration
// Generated on Tue Jul 07 2015 12:45:02 GMT+0200 (CEST)

module.exports = function(config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',

    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['jasmine', 'requirejs'],



    // list of files / patterns to load in the browser
    files: [{
        pattern: 'bower_components/squire/src/Squire.js',
        included: false
      }, {
        pattern: 'bower_components/jasmine-expect/dist/jasmine-matchers.js',
        included: true
      }, {
        pattern: 'bower_components/jasmine-object-matchers/dist/jasmine-object-matchers.js',
        included: true
      }, {
        pattern: 'bower_components/lodash/lodash.js',
        included: false
      }, {
        pattern: 'bower_components/sinon/index.js',
        included: false
      }, {
        pattern: 'bower_components/sql-parser/browser/sql-parser.js',
        included: false
      }, {
        pattern: 'bower_components/mock-websql/websql.js',
        included: false
      }, {
        pattern: 'bower_components/indexedDBmock/dist/indexedDBmock.js',
        included: false
      }, {
        pattern: 'bower_components/rxjs/dist/rx.lite.js',
        included: false
      }, {
        pattern: 'bower_components/rxjs/dist/rx.async.js',
        included: false
      }, {
        pattern: 'bower_components/rxjs/dist/rx.virtualtime.js',
        included: false
      }, {
        pattern: 'bower_components/rxjs/dist/rx.testing.js',
        included: false
      },

      {
        pattern: 'src/**/*.js',
        included: false
      }, {
        pattern: 'tests/testHelper/**/*.js',
        included: false
      }, {
        pattern: 'tests/**/*.js',
        included: false
      },

      'test-main.js'
    ],

    // list of files to exclude
    exclude: [],

    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {},

    preprocessors: {
      'src/**/*.js': [
        'coverage'
      ]
    },

    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['spec' , 'coverage' ],


    // web server port
    port: 9876,

    // enable / disable colors in the output (reporters and logs)
    colors: true,

    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,

    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,

    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    browsers: ['PhantomJS'],

    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: false
  });
};
