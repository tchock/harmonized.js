'use strict';

define('ViewItem', ['lodash', 'rx'], function(_, Rx) {

  /**
   * Constructor of the ViewItem
   * @param {ViewCollection} viewCollection   The collection of the item
   * @param {Object} [data]                   The data of the item
   * @param {Object} [meta]                   The metadata of the item
   * @param {boolean} [addToCollection]       true if item should be added
   *                                          directly, false if not
   */
  var ViewItem = function ViewItem(viewCollection, data, meta,
    addToCollection) {
    var _this = this;

    /**
     * Gets the collection of the item
     * @return {ViewCollection} The collection of the item
     */
    _this.getCollection = function() {
      return viewCollection;
    };

    _this._streams = {};

    _this._streams.upStream = viewCollection.upStream;

    _this._streams.saveDownStream = viewCollection.downStream.filter(
      function(item) {
        return item.meta.rtId === _this._meta.rtId && item.meta.action ===
          'save';
      });

    // Subscription for the save downstream
    _this._streams.saveDownStreamSub = _this._streams.saveDownStream.subscribe(
      function(item) {
        _this._save(item.data, item.meta);
      });

    // Subscription for the delete downstream
    _this._streams.deleteDownStream = viewCollection.downStream.filter(
      function(item) {
        return item.meta.rtId === _this._meta.rtId && (item.meta.action ===
          'delete' || item.meta.action === 'deletePermanently');
      });

    // Subscription for the delete downstream
    _this._streams.deleteDownStreamSub = _this._streams.deleteDownStream.subscribe(
      function() {
        _this._delete();
      });

    _this._meta = meta || {};
    _this._meta = _.clone(_this._meta);
    delete _this._meta.action;

    // Add the content
    for (var key in data) {
      _this[key] = data[key];
    }

    _this._meta.addedToCollection = false;
    if (addToCollection && !_.isUndefined(_this._meta.rtId)) {
      _this._meta.addedToCollection = true;
      viewCollection.push(_this);
      viewCollection._items[_this._meta.rtId] = _this;
    }

  };

  /**
   * Sends item to the upstream (to the model)
   * @param  {string} action The action that should be added (save or delete)
   */
  ViewItem.prototype._sendItemToUpStream = function(action) {
    var itemData = {};
    var itemMeta = {};

    if (_.isUndefined(this._meta.rtId)) {
      this._meta.rtId = this.getCollection()._model.getNextRuntimeId();
    }

    itemMeta.rtId = this._meta.rtId;

    if (!_.isUndefined(this._meta.serverId)) {
      itemMeta.serverId = this._meta.serverId;
    }

    if (!_.isUndefined(this._meta.storeId)) {
      itemMeta.storeId = this._meta.storeId;
    }

    itemMeta.action = action;

    // Get all item data
    for (var item in this) {
      if (this.hasOwnProperty(item) && item !== '_meta' && item !==
        'getCollection' && item !== '_streams') {
        itemData[item] = this[item];
      }
    }

    this._streams.upStream.onNext({
      data: itemData,
      meta: itemMeta
    });
  };

  /**
   * Saves the item and updates the data of the model, server and local
   * database. If item is not yet in the collection, it adds itself.
   */
  ViewItem.prototype.save = function() {
    this._sendItemToUpStream('save');
    if (!this._meta.addedToCollection) {
      var collection = this.getCollection();
      collection.push(this);
      collection._items[this._meta.rtId] = this;
      this._meta.addedToCollection = true;
    }
  };

  /**
   * Save function for the save downstream. Updates the data and metadata
   * @param  {Object} data The new data of the item
   * @param  {Object} meta The new metadata of the item
   */
  ViewItem.prototype._save = function(data, meta) {
    // Set metadata
    this._meta.rtId = meta.rtId;

    if (!_.isUndefined(meta.storeId)) {
      this._meta.storeId = meta.storeId;
    }

    if (!_.isUndefined(meta.serverId)) {
      this._meta.serverId = meta.serverId;
    }

    // Remove all old data
    for (var item in this) {
      if (this.hasOwnProperty(item) && item !== '_meta' && item !==
        'getCollection' && item !== '_streams') {
        delete this[item];
      }
    }

    // Add new data
    for (var key in data) {
      this[key] = data[key];
    }
  };

  /**
   * Deletes the item from the database, server, model and view collection
   */
  ViewItem.prototype.delete = function() {
    this._sendItemToUpStream('delete');
    this._delete();
  };

  /**
   * Internal delete function. Sets the delete flag, deletes the item from the
   * collection and disposes the downstream subscriptions of the item
   */
  ViewItem.prototype._delete = function() {
    // Set metadata deleted flag
    this._meta.deleted = true;

    // Delete from collection
    if (this._meta.addedToCollection) {
      var collection = this.getCollection();
      for (var i = collection.length - 1; i >= 0; i--) {
        if (collection[i] === this) {
          collection.splice(i, 1);
        }
      }
    }

    this._streams.saveDownStreamSub.dispose();
    this._streams.deleteDownStreamSub.dispose();
  };

  return ViewItem;
});
