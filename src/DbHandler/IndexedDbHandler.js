'use strict';

define('DbHandler/IndexedDbHandler', ['DbHandler/BaseHandler', 'harmonizedData', 'rx', 'lodash'], function(DbHandler, harmonizedData, Rx, _) {

  /**
   * The IndexedDbHandler constructor
   * @param {string} storeName The name of the store of the created handler
   * @param {Object} keys      The store and server keys
   */
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

  /**
   * Get the window.indexedDb object
   *
   * This function exists to make it possible to spy on the local storage
   * @return {IDBFactory} The indexedDb object
   */
  IndexedDbHandler.getDbReference = function() {
    return window.indexedDB;
  };

  /**
   * Connect to the indexeddb handler
   * @return {IDBRequest} The indexedDb request object of the connection
   */
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
      dbHandler._connectionStream.onError(new Error(e.target.error.name));
      dbHandler._isConnecting = false;
    };

    // DB needs upgrade
    request.onupgradeneeded = function(e) {
      var db = e.target.result;
      var schema = harmonizedData.getDbSchema();
      var currentStore;
      var i;

      // Remove all stores items
      if (!_.isUndefined(db)) {
        for (i = db.objectStoreNames.length - 1; i >= 0; i--) {
          currentStore = db.objectStoreNames[i];
          db.deleteObjectStore(currentStore);
        }
      }

      for (var store in schema) {
        currentStore = schema[store];
        var objectStore = db.createObjectStore(store, {
          keyPath: currentStore.storeKey,
          autoIncrement: true,
        });
        objectStore.createIndex('serverId', currentStore.serverKey, {
          unique: true,
          multiEntry: false,
        });
      }
    };

    return request;
  };

  /**
   * Closes the connection to the indexedDb database
   */
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

  /**
   * Deletes the database
   * @return {IDBRequest} The indexedDB request for the database deletion
   */
  IndexedDbHandler.deleteDb = function() {
    IndexedDbHandler.closeConnection();
    return IndexedDbHandler.getDbReference().deleteDatabase(
      'harmonizedDb');
  };

  IndexedDbHandler.prototype = Object.create(DbHandler.prototype);

  /**
   * Get all entries from the database and put it in the downstream
   */
  IndexedDbHandler.prototype.getAllEntries = function(cb) {
    var _this = this;

    var store = IndexedDbHandler._db.transaction([_this._storeName])
      .objectStore(_this._storeName);

    // Cursor success
    var cursor = store.openCursor();
    cursor.onsuccess = function(e) {
      cursor = e.target.result;
      if (cursor) {
        var cursorItem = cursor.value;
        var newItem = harmonizedData._createStreamItem(cursorItem,
          _this._keys);

        // Set the action depending on the deletion status
        if (newItem.meta.deleted) {
          newItem.meta.action = 'delete';
        } else {
          newItem.meta.action = 'save';
        }

        _this.downStream.onNext(newItem);
        cursor.continue();
      } else {
        // No item left, so call the callback!
        if (_.isFunction(cb)) {
          cb();
        }
      }
    };

    // Error handling
    cursor.onerror = _this.downStream.onError;
  };

  IndexedDbHandler.prototype.getEntry = function(key) {
    var _this = this;

    var transaction = IndexedDbHandler._db.transaction([_this._storeName]);
    var objectStore = transaction.objectStore(_this._storeName);
    var request = objectStore.get(key);

    request.onerror = _this.downStream.onError

    request.onsuccess = function() {
      if (!_.isUndefined(request.result)) {
        var newItem = harmonizedData._createStreamItem(request.result,
          _this._keys);
        _this.downStream.onNext(newItem);
      } else {
        _this.downStream.onError(new Error('Item with id ' + key + ' not found in database'));
      }

    };
  };

  /**
   * Write an item to the database
   * @param  {Object} item  Item that has to be written to the database
   * @return {Rx.Subject}   The stream where the returned item will be put in
   */
  IndexedDbHandler.prototype.put = function(item) {
    var dbHandler = IndexedDbHandler;
    var putStream = new Rx.Subject();

    // Don't do anything if the database connection is not established
    if (!dbHandler._db) {
      putStream.onError(new Error('no database connection established'));
      putStream.onCompleted();
      return putStream;
    }

    // Don't do anything if the item shouldn't be saved locally
    if (item.meta.dontSaveLocally) {
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
      putStream.onError(new Error(e.target.error.name));
    };

    var objectStore = transaction.objectStore(_this._storeName);
    putNext();

    return putStream;
  };

  /**
   * Remove an item from the database
   * @param  {Object} item  Item to remove from the database. Needs serverID!
   * @return {Rx.Subject}   The stream where the removed item will be put in
   */
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
      item.meta.action = 'deletePermanently';
      removeStream.onNext(item);
      removeStream.onCompleted();
    };

    request.onerror = removeStream.onError;

    return removeStream;
  };

  return IndexedDbHandler;
});
