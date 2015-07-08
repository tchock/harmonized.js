'use strict';
define('dbHandlerFactory', ['DbHandler/IndexedDbHandler',
  'DbHandler/WebSqlHandler'
], function(IndexedDbHandler, WebSqlHandler) {
  var dbHandlerFactory = function dbHandlerFactory() {
    // Check for db support
    if (dbHandlerFactory._getIndexedDb()) {
      // Set IndexedDB if supported
      dbHandlerFactory._DbHandler = IndexedDbHandler;
    } else if (dbHandlerFactory._getWebSql()) {
      // Set WebSQL if supported
      dbHandlerFactory._DbHandler = WebSqlHandler;
    } else {
      // Set no database if no DB support
      dbHandlerFactory._DbHandler = undefined;
    }
  };

  dbHandlerFactory.createDbHandler = function(name, options) {
    if (!!dbHandlerFactory._DbHandler) {
      return new dbHandlerFactory._DbHandler(name, options);
    } else {
      return undefined;
    }
  };

  dbHandlerFactory._getDbStructure = function getDbStructure() {
    // TODO extract db structure from resource definition
    return {};
  };

  /* istanbul ignore next */
  dbHandlerFactory._getIndexedDb = function getIndexedDb() {
    if (window.indexedDB && _.isFunction(IndexedDbHandler)) {
      return window.indexedDb;
    }

    return null;
  };

  /* istanbul ignore next */
  dbHandlerFactory._getWebSql = function getWebSql() {
    if (window.openDatabase && _.isFunction(WebSqlHandler)) {
      return window.openDatabase;
    }

    return null;
  };

  return dbHandlerFactory;
});
