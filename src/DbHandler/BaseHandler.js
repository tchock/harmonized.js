'use strict';

define('DbHandler/BaseHandler', ['helper/webStorage'], function(webStore) {

  /**
   * The database handler constructor
   * @param {IndexedDbHandler|WebSqlHandler} dbHandler The explicit database handler
   * @param {string} storeName                            The name of the database store
   * @param {Object} keys                                 The store and server keys
   */
  var DbHandler = function DbHandler(dbHandler, storeName, keys) {
    this._storeName = storeName;
    this._keys = keys;

    // Public streams
    this.downstream = new Rx.Subject();
    this.upstream = new Rx.Subject();

    // Internal pausable upstream
    this._upstream = this.upstream.pausableBuffered(dbHandler._connectionStream);

    // Directly connect to the server if necessary
    if (!dbHandler._db && dbHandler._isConnecting === false) {
      dbHandler._connectionStream.onNext(false);
      dbHandler.connect();
    }

    // Save upstream
    this._saveUpstream = this._upstream.filter(function(item) {
      return item.meta.action === 'save';
    });

    this._saveDownstream = this._saveUpstream.map(this.put);
    this._saveSubscribe = this._saveDownstream.subscribe(this.downstream);

    // Delete upstream
    this._deleteUpstream = this._upstream.filter(function(item) {
      return item.meta.action === 'delete';
    });

    this._deleteDownstream = this._deleteUpstream.map(this.remove);
    this._deleteSubscribe = this._deleteDownstream.subscribe(this.downstream);

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

    return putItem;
  };

  return DbHandler;
});
