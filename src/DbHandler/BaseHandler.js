'use strict';

define('DbHandler/BaseHandler', ['helper/webStorage'], function(webStore) {

  /**
   * The database handler constructor
   * @param {IndexedDbHandler|WebSqlHandler} dbHandler The explicit database handler
   * @param {string} storeName                            The name of the database store
   * @param {Object} keys                                 The store and server keys
   */
  var DbHandler = function DbHandler(dbHandler, storeName, keys) {
    var _this = this;

    this._storeName = storeName;
    this._keys = keys;

    // Public streams
    this.downStream = new Rx.Subject();
    this.upStream = new Rx.Subject();

    // Internal pausable upstream
    this._upStream = this.upStream.pausableBuffered(dbHandler._connectionStream);

    // Directly connect to the server if necessary
    if (!dbHandler._db && dbHandler._isConnecting === false) {
      dbHandler._connectionStream.onNext(false);
      dbHandler.connect();
    }

    // Save upstream
    this._saveUpstream = this._upStream.filter(function(item) {
      return item.meta.action === 'save';
    });

    this._saveDownstream = this._saveUpstream.flatMap(function(item) {
      return _this.put(item);
    });

    this._saveSubscribe = this._saveDownstream.map(function(item) {
      console.log('db save downstream');
      return item;
    }).subscribe(this.downStream);

    // Delete upstream
    this._deleteUpstream = this._upStream.filter(function(item) {
      return item.meta.action === 'delete';
    });

    this._deleteDownstream = this._deleteUpstream.flatMap(function(item) {
      if (_.isUndefined(item.meta.serverId)) {
        return _this.remove(item);
      } else {
        return _this.put(item);
      }
    });

    this._deleteSubscribe = this._deleteDownstream.map(function(item) {
      console.log('db delete downstream');
      return item;
    }).subscribe(this.downStream);

    // Delete permanently upstream
    this._deletePermanentlyUpstream = this._upStream.filter(function(item) {
      return item.meta.action === 'deletePermanently';
    });

    this._deletePermanentlyDownstream = this._deletePermanentlyUpstream.map(function(item) {
      console.log('delete perm in db');
      _this.remove(item);
      return item;
    });

    this._deletePermanentlySubscribe = this._deletePermanentlyDownstream.map(function(item) {
      console.log('db delete perm downstream');
      return item;
    }).subscribe(this.downStream);

    // Initially get the metadata
    this._metaStorageName = 'harmonizedMeta_' + this._storeName;
    this._metadata = webStore.getWebStorage().getItem(this._metaStorageName) || {};
  };

  /**
   * Gets the metadata of the database
   * @return {Object} The database metadata
   */
  DbHandler.prototype.getMetadata = function() {
    return this._metadata;
  };

  /**
   * Sets the database metadata
   * @param  {string} key   The key of the metadata entry
   * @param  {*} value      The value of the metadata entry
   */
  DbHandler.prototype.setMetadata = function(key, value) {
    this._metadata[key] = value;
    webStore.getWebStorage().setItem(this._metaStorageName, this._metadata);
  };

  /**
   * Creates a database item in a format that can be saved to the local database
   * @param  {Object} item  The item that has to be transformed to the local
   *                        database format
   * @return {Object}       The item in the database format
   */
  DbHandler.prototype._createDbItem = function(item) {
    // Clone data and arrange it for db
    var putItem = _.clone(item.data);
    if (!_.isUndefined(item.meta) && !_.isUndefined(item.meta.storeId)) {
      putItem[this._keys.storeKey] = item.meta.storeId;
    }

    if (!_.isUndefined(item.meta) && !_.isUndefined(item.meta.serverId)) {
      putItem[this._keys.serverKey] = item.meta.serverId;
    }

    if (!_.isUndefined(item.meta) && item.meta.action === 'delete') {
      putItem._deleted = true;
    } else {
      putItem._deleted = false;
    }

    return putItem;
  };

  return DbHandler;
});
