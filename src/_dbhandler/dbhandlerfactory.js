'use strict';

Harmonized.dbHandlerFactory = function dbHandlerFactory() {
  // Check for db support
  if (Harmonized.dbHandlerFactory._getIndexedDb()) {
    // Set IndexedDB if supported
    Harmonized.dbHandlerFactory._DbHandler = Harmonized.IndexedDbHandler;
  } else if (Harmonized.dbHandlerFactory._getWebSql()) {
    // Set WebSQL if supported
    Harmonized.dbHandlerFactory._DbHandler = Harmonized.WebSqlHandler;
  } else {
    // Set no database if no DB support
    Harmonized.dbHandlerFactory._DbHandler = undefined;
  }
};

Harmonized.dbHandlerFactory.createDbHandler = function(name, options) {
  if (!!Harmonized.dbHandlerFactory._DbHandler) {
    return new Harmonized.dbHandlerFactory._DbHandler(name, options);
  } else {
    return undefined;
  }
};

Harmonized.dbHandlerFactory._getDbStructure = function getDbStructure() {
  // TODO extract db structure from resource definition
  return {};
};

/* istanbul ignore next */
Harmonized.dbHandlerFactory._getIndexedDb = function getIndexedDb() {
  return window.indexedDB && _.isFunction(Harmonized.IndexedDbHandler);
};

/* istanbul ignore next */
Harmonized.dbHandlerFactory._getWebSql = function getWebSql() {
  return window.openDatabase && _.isFunction(Harmonized.WebSqlHandler);
};
