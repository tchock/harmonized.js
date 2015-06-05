Harmonized.IndexedDbHandler = function IndexedDbHandler(storeName) {
  this._handlerType = 'IndexedDB';
  Harmonized.DbHandler.call(this, Harmonized.IndexedDbHandler, storeName);
}

// Connection stream to pause or resume the upstream
Harmonized.IndexedDbHandler._connectionStream  = new Rx.Subject();

// Database Object
Harmonized.IndexedDbHandler._db = null;

/* istanbul ignore next */
Harmonized.IndexedDbHandler.getDbReference = function () {
  return window.indexedDB;
};

Harmonized.IndexedDbHandler.connect = function () {
  var dbHandler = Harmonized.IndexedDbHandler;
  if (dbHandler._db !== null) {
    // DB connection is already established
    return;
  }

  var request = dbHandler.getDbReference().open('harmonized_db',
    Harmonized.dbVersion);

  // Request success
  request.onsuccess = function (e) {
    dbHandler._db = request.result;
    dbHandler._connectionStream.onNext(true);
  };

  // DB needs upgrade
  request.onupgradeneeded = function (e) {
    var db = e.result;
    var schema = Harmonized.getDbSchema();
    var currentStore;
    var newObjectStore;
    var i;

    // Remove all stores items
    for (i = db.objectStoreNames.length-1; i >= 0; i--) {
      currentStore = db.objectStoreNames[i];
      db.deleteObjectStore(currentStore);
    }

    for (var store in schema) {
      currentStore = schema[store];
      var objectStore = db.createObjectStore(store, { keyPath: currentStore.storeId,
        autoIncrement: true });
      objectStore.createIndex('serverId', currentStore.serverId, { unique: true,
        multiEntry: false });
    }
  };

  return request;
};

Harmonized.IndexedDbHandler.closeConnection = function () {
  var dbHandler = Harmonized.IndexedDbHandler;
  var db = dbHandler._db;
  /* istanbul ignore else */
  if (db) {
    db.close();
    dbHandler._db = null;
    dbHandler._connectionStream.onNext(false);
  }
};

Harmonized.IndexedDbHandler.deleteDb = function () {
  Harmonized.IndexedDbHandler.closeConnection();
  return Harmonized.IndexedDbHandler.getDbReference().deleteDatabase(
    'harmonized_db');
};

Harmonized.IndexedDbHandler.prototype = Object.create(Harmonized.DbHandler.prototype);

Harmonized.IndexedDbHandler.prototype.getAllEntries = function () {
  var _this = this;

  var store = Harmonized.IndexedDbHandler._db.transaction([_this._storeName])
    .objectStore(_this._storeName);

  // Cursor success
  var cursor = store.openCursor();
  cursor.onsuccess = function (e) {
    cursor = e.target.result;
    var cursorItem = cursor.value;
    if (cursor) {
      _this.downstream.onNext(Harmonized._createStreamItem(cursorItem,
          _this._keys));
      cursor.continue();
    }
  };

  // Error handling
  cursor.onerror = _this.downstream.onError;
};

Harmonized.IndexedDbHandler.prototype.put = function (item) {
  var dbHandler = Harmonized.IndexedDbHandler;

  // Don't do anything if the database connection is not established
  if (!dbHandler._db) return;

  var _this = this;
  var i = 0;
  var putStream = new Rx.Subject();

  // Create singleton array with data, if data is no array
  if (!_.isArray(item)) {
    item = [item];
  }

  var transaction = dbHandler._db.transaction([_this._storeName], 'readwrite');
  transaction.onerror = putStream.onError;
  var objectStore = transaction.objectStore(_this._storeName);
  putNext();

  function putNext(e) {
    if (!!e) {
      // Data was received
      if (_.isUndefined(item[i].meta)) {
        item[i].meta = {};
      }

      item[i].meta.storeId = e.target.result;
      putStream.onNext(item[i]);
      i++;
    }

    if (i < item.length) {
      // Save and do next stuff
      var put = objectStore.put(_this._createDbItem(item[i]));
      put.onsuccess = putNext;
      put.onerror = putError;
    }
  }

  function putError(err) {
    putNext();
  }

  return putStream;
};

Harmonized.IndexedDbHandler.prototype.remove = function (item) {
  var dbHandler = Harmonized.IndexedDbHandler;

  // Don't do anything if the database connection is not established
  if (!dbHandler._db) return;

  var removeStream = new Rx.Subject();
  var request = dbHandler._db.transaction(_this._storeName, 'readwrite')
    .objectStore(_this._storeName).delete(item.meta.storeId);

  request.onsuccess = function () {
    item.meta.deleted = true;
    removeStream.onNext(item);
  };

  request.onerror = removeStream.onError;

  return removeStream;
};

Harmonized.IndexedDbHandler.prototype.clearStorage = function () {
  var _this = this;
  var dbHandler = Harmonized.IndexedDbHandler;

  // Don't do anything if the database connection is not established
  if (!dbHandler._db) return;

  return dbHandler._db.transaction(_this._storeName, 'readwrite')
    .objectStore(_this._storeName)
    .clear();
};
