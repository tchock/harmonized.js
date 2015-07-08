var allTestFiles = [];
var TEST_REGEXP = /(test)\.js$/i;

Object.keys(window.__karma__.files).forEach(function(file) {
  if (TEST_REGEXP.test(file)) {
    // Normalize paths to RequireJS module names.
    allTestFiles.push(file);
  }
});

require.config({
  // Karma serves files under /base, which is the basePath from your config file
  baseUrl: '/base/src',

  paths: {
    'Squire': '../bower_components/squire/src/Squire',
    'sinon': '../bower_components/sinon/index',
    'jasmineMatchers': '../bower_components/jasmine-expect/dist/jasmine-matchers',
    'jasmineObjectMatchers': '../bower_components/jasmine-object-matchers/dist/jasmine-object-matchers',
    'lodash': '../bower_components/lodash/lodash',
    'sqlParser': '../bower_components/sql-parser/browser/sql-parser',
    'WebSqlMock': '../bower_components/mock-websql/websql',
    'indexedDBmock': '../bower_components/indexedDBmock/dist/indexedDBmock',
    'rx': '../bower_components/rxjs/dist/rx.lite',
    'rx.async': '../bower_components/rxjs/dist/rx.async',
    'rx.virtualtime': '../bower_components/rxjs/dist/rx.virtualtime',
    'rx.testing': '../bower_components/rxjs/dist/rx.testing',

    'MockDbHandler': '../tests/testHelper/MockDbHandler',
    'mockWebStorage': '../tests/testHelper/mockWebStorage'
  },

  shim: {
    'lodash': {
      exports: '_'
    },
    'sinon': {
      exports: 'sinon'
    },
    'rx': {
      exports: 'Rx'
    }
  },
});

require(allTestFiles, function() {
  // we have to kickoff jasmine, as it is asynchronous
  window.__karma__.start();
});
