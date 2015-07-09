var allTestFiles = [];
var modules = [];
var allFiles = [];
var TEST_REGEXP = /(test)\.js$/i;
var SRC_REGEXP = /\/base\/src\//;
var JS_REGEXP = /\.js$/;

/**
* This function converts a given js path to requirejs module
*/
var jsToModule = function (path) {
    return path.replace(/^\/base\/src\//, '').replace(/\.js$/, '');
};

Object.keys(window.__karma__.files).forEach(function (file) {
    if (TEST_REGEXP.test(file)) {
        allFiles.push(file);
    } else if (SRC_REGEXP.test(file) && JS_REGEXP.test(file)) {
      console.log(file);
        allFiles.push(jsToModule(file));
    }
});

require.config({
  // Karma serves files under /base, which is the basePath from your config file
  baseUrl: '/base/src/',

  paths: {
    'Squire': '../bower_components/squire/src/Squire',
    'sinon': '../bower_components/sinon/index',
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
    'indexedDBmock': {
      exports: 'indexedDBmock',
      init: function() {
        return {
          mock: this.indexedDBmock,
          mockDbs: this.indexedDBmockDbs
        };
      }
    },
  },
});

var startTest = function () {
    //loading all the existing requirejs src modules before
    //triggering the karma test
    require(modules, function () {
        window.__karma__.start();
    });
};


require(allFiles, function() {
  // we have to kickoff jasmine, as it is asynchronous
  window.__karma__.start();
});
