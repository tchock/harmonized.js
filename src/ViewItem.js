'use strict';

define('ViewItem', ['lodash', 'rx', 'ViewCollection', 'harmonizedData'],
  function(_, Rx, ViewCollection, harmonizedData) {

  /**
   * Constructor of the ViewItem
   * @param {ViewCollection} viewCollection   The collection of the item
   * @param {Object} [data]                   The data of the item
   * @param {Object} [meta]                   The metadata of the item
   * @param {boolean} [addToCollection]       true if item should be added
   *                                          directly, false if not
   */
  var ViewItem = function ViewItem(viewCollection, data, meta, subData,
    addToCollection) {
    var _this = this;

    // If item is user created (by the collections .new() method), this is false
    _this._wasAlreadySynced = (subData !== null && subData !== undefined);

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

    if (subData !== null && subData !== undefined) {
      _this._addSubCollections(subData);
    }

    _this._meta.addedToCollection = false;
    if (addToCollection && !_.isUndefined(_this._meta.rtId)) {
      _this._meta.addedToCollection = true;
      viewCollection.push(_this);
      viewCollection._items[_this._meta.rtId] = _this;
      harmonizedData._viewUpdateCb();
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
      if (this._isPropertyData(item)) {
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
    if (!_.isUndefined(meta.storeId)) {
      this._meta.storeId = meta.storeId;
    }

    if (!_.isUndefined(meta.serverId)) {
      this._meta.serverId = meta.serverId;
    }

    // Remove all old data
    for (var item in this) {
      if (this._isPropertyData(item)) {
        delete this[item];
      }
    }

    // Add new data
    for (var key in data) {
      this[key] = data[key];
    }

    // Add sub model view collections to the item if not happened before
    if (!this._wasAlreadySynced) {
      var subData = this.getCollection()._model.getItem(this._meta.rtId).subData;
      this._addSubCollections(subData);
      this._wasAlreadySynced = true;
    }

    harmonizedData._viewUpdateCb();
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
    harmonizedData._viewUpdateCb();
  };

  /**
   * Checks if a given property is a dataentry of the item
   * @param  {string} property  Property to test for dataentry
   * @return {boolean}          If true, the property is a dataentry
   */
  ViewItem.prototype._isPropertyData = function(property) {
    return this.hasOwnProperty(property) &&
      property !== '_meta' &&
      property !== 'getCollection' &&
      property !== '_streams' &&
      property !== '_wasAlreadySynced' &&
      !_.includes(this._subDataList, property);
  };

  /**
   * Adds sub collections to the item. The collections resemble the sub models
   * of the model item
   * @param {Object} subData object containing the sub data of the model item
   */
  ViewItem.prototype._addSubCollections = function(subData) {
    this._subDataList = Object.keys(subData);
    for (var subModel in subData) {
      if (subData.hasOwnProperty(subModel)) {
        this[subModel] = new ViewCollection(subData[subModel]);
      }
    }
  }

  return ViewItem;
});
