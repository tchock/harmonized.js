Harmonized.dbHandlerFactory = function dbHandlerFactory() {
  // Set supported db handler
  Harmonized.setSupportedDbHandler();
};

Harmonized.setSupportedDbHandler = function setSupportedDbHandler() {
  // Set IndexedDB if supported
  if (window.indexedDB) {
    Harmonized.dbHandlerFactory._DbHandler = Harmonized.IndexedDbHandler;
    // Set WebSQL if supported
  } else if (window.openDatabase) {
    Harmonized.dbHandlerFactory._DbHandler = Harmonized.WebSqlHandler;
    // Set No Database if no DB support
  } else {
    Harmonized.dbHandlerFactory._DbHandler = undefined;
  }
};

Harmonized.dbHandlerFactory.createDbHandler = function createDbHandler(options) {

};
