'use strict';

define('DbHandler/IndexedDbHandler', ['DbHandler/BaseHandler', 'harmonizedData'], function(DbHandler, harmonizedData) {
  var IndexedDbHandler = function IndexedDbHandler(storeName, keys) {
    this._handlerType = 'IndexedDB';
    DbHandler.call(this, IndexedDbHandler,
      storeName, keys);
  };

  // Connection stream to pause or resume the upstream
  IndexedDbHandler._connectionStream = new Rx.Subject();

  // Database Object
  IndexedDbHandler._db = null;
  IndexedDbHandler._isConnecting = false;

  /* istanbul ignore next */
  IndexedDbHandler.getDbReference = function() {
    return window.indexedDB;
  };

  IndexedDbHandler.connect = function() {
    var dbHandler = IndexedDbHandler;
    if (dbHandler._db !== null || dbHandler._isConnecting) {
      // DB connection is already established
      dbHandler._isConnecting = false;
      return;
    }

    dbHandler._isConnecting = true;
    var request = dbHandler.getDbReference().open('harmonizedDb',
      harmonizedData.dbVersion);

    // Request success
    request.onsuccess = function() {
      dbHandler._db = request.result;
      dbHandler._isConnecting = false;
      dbHandler._connectionStream.onNext(true);
    };

    request.onerror = function(e) {
      dbHandler._connectionStream.onError(new Error(e.error.name));
      dbHandler._isConnecting = false;
    };

    // DB needs upgrade
    request.onupgradeneeded = function(e) {
      var db = e.result;
      var schema = harmonizedData.getDbSchema();
      var currentStore;
      var i;

      // Remove all stores items
      for (i = db.objectStoreNames.length - 1; i >= 0; i--) {
        currentStore = db.objectStoreNames[i];
        db.deleteObjectStore(currentStore);
      }

      for (var store in schema) {
        currentStore = schema[store];
        var objectStore = db.createObjectStore(store, {
          keyPath: currentStore.storeId,
          autoIncrement: true
        });
        objectStore.createIndex('serverId', currentStore.serverId, {
          unique: true,
          multiEntry: false
        });
      }
    };

    return request;
  };

  IndexedDbHandler.closeConnection = function() {
    var dbHandler = IndexedDbHandler;
    var db = dbHandler._db;
    /* istanbul ignore else */
    if (db) {
      db.close();
      dbHandler._db = null;
      dbHandler._connectionStream.onNext(false);
    }
  };

  IndexedDbHandler.deleteDb = function() {
    IndexedDbHandler.closeConnection();
    return IndexedDbHandler.getDbReference().deleteDatabase(
      'harmonizedDb');
  };

  IndexedDbHandler.prototype = Object.create(DbHandler
    .prototype);

  IndexedDbHandler.prototype.getAllEntries = function() {
    var _this = this;

    var store = IndexedDbHandler._db.transaction([_this._storeName])
      .objectStore(_this._storeName);

    // Cursor success
    var cursor = store.openCursor();
    cursor.onsuccess = function(e) {
      cursor = e.target.result;
      if (cursor) {
        var cursorItem = cursor.value;
        _this.downstream.onNext(harmonizedData._createStreamItem(cursorItem,
          _this._keys));
        cursor.continue();
      }
    };

    // Error handling
    cursor.onerror = _this.downstream.onError;
  };

  IndexedDbHandler.prototype.put = function(item) {
    var dbHandler = IndexedDbHandler;
    var putStream = new Rx.Subject();

    // Don't do anything if the database connection is not established
    if (!dbHandler._db) {
      putStream.onError(new Error('no database connection established'));
      putStream.onCompleted();
      return putStream;
    }

    var _this = this;
    var i = 0;

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
        var dbItem = _this._createDbItem(item[i]);
        var put = objectStore.put(dbItem);
        put.onsuccess = putNext;
        put.onerror = putError;
      } else {
        putStream.onCompleted();
      }
    }

    function putError() {
      i++;
      putNext();
    }

    // Create singleton array with data, if data is no array
    if (!_.isArray(item)) {
      item = [item];
    }

    var transaction = dbHandler._db.transaction([_this._storeName],
      'readwrite');
    transaction.onerror = function(e) {
      putStream.onError(new Error(e.error.name));
    };

    var objectStore = transaction.objectStore(_this._storeName);
    putNext();

    return putStream;
  };

  IndexedDbHandler.prototype.remove = function(item) {
    var dbHandler = IndexedDbHandler;
    var _this = this;

    var removeStream = new Rx.Subject();

    // Don't do anything if the database connection is not established
    if (!dbHandler._db) {
      removeStream.onError(new Error('no database connection established'));
      removeStream.onCompleted();
      return removeStream;
    }

    var request = dbHandler._db.transaction([_this._storeName],
        'readwrite')
      .objectStore(_this._storeName).delete(item.meta.storeId);

    request.onsuccess = function() {
      item.meta.deleted = true;
      removeStream.onNext(item);
      removeStream.onCompleted();
    };

    request.onerror = removeStream.onError;

    return removeStream;
  };

  return IndexedDbHandler;
});
