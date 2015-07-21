'use strict';
define('dbHandlerFactory', ['harmonizedData', 'DbHandler/IndexedDbHandler',
  'DbHandler/WebSqlHandler'
], function(harmonizedData, IndexedDbHandler, WebSqlHandler) {

  /**
   * Initiates the dbHandlerFactory
   */
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

  /**
   * Creates a database handler for a specified resource
   * @param  {string} name                        Name of the resource
   * @param  {Object} options                     Options for the db handler
   * @return {IndexedDbHandler|WebSqlHandler}  created db handler or undefined (if no db support)
   */
  dbHandlerFactory.createDbHandler = function(name, keys) {
    if (!!dbHandlerFactory._DbHandler) {
      return new dbHandlerFactory._DbHandler(name, keys);
    } else {
      return undefined;
    }
  };

  /* istanbul ignore next */

  /**
   * Get the indexedDb object if browser implementation or IndexedDbHandler exist
   * @return {IDBFactory} The indexedDB implementation
   */
  dbHandlerFactory._getIndexedDb = function getIndexedDb() {
    if (window.indexedDB && _.isFunction(IndexedDbHandler)) {
      return window.indexedDB;
    }

    return null;
  };

  /* istanbul ignore next */

  /**
   * Get the Web SQL object if browser implementation or WebSqlHandler exist
   * @return {Function} The openDatabase function for WebSQL
   */
  dbHandlerFactory._getWebSql = function getWebSql() {
    if (window.openDatabase && _.isFunction(WebSqlHandler)) {
      return window.openDatabase;
    }

    return null;
  };

  // initialize one time
  dbHandlerFactory();

  return dbHandlerFactory;
});
