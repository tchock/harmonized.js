// Karma configuration
// Generated on Thu Oct 16 2014 17:35:58 GMT+0200 (CEST)

module.exports = function(config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',


    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['jasmine'],


    // list of files / patterns to load in the browser
    files: [
      'bower_components/lodash/lodash.js',
      'bower_components/sql-parser/browser/sql-parser.js',
      'bower_components/mock-websql/websql.js',
      'bower_components/rxjs/dist/rx.lite.js',
      'bower_components/rxjs/dist/rx.async.js',
      'bower_components/rxjs/dist/rx.virtualtime.js',
      'bower_components/rxjs/dist/rx.testing.js',
      'src/**/*.js',
      'tests/_testHelper/**/*.js',
      'tests/Harmonized/harmonizedTest.js',
      'tests/webstorage/webStorageTest.js',
      'tests/dbHandler/dbHandlerTest.js',
      'tests/dbhandler/dbHandlerFactoryTest.js'
      //'tests/**/*.js'
    ],


    // list of files to exclude
    exclude: [
    ],


    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
      'src/**/*.js': ['coverage']
    },


    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['spec', 'osx', 'coverage'],


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
