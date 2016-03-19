'use strict';

define('SubModel', ['harmonizedData', 'ServerHandler', 'dbHandlerFactory',
  'modelHandler', 'lodash'
], function(harmonizedData, ServerHandler, dbHandlerFactory, modelHandler,
  _) {

  /**
   * Sets an option to its default value if undefined in custom options
   * @param {Object} options     The options object
   * @param {string} item        The key to the item of the options object
   * @param {Object} modelSchema The schema of the model that contains the
   *                             default values
   */
  function setOptionIfUndefined(options, item, modelSchema) {
    if (_.isUndefined(options[item])) {
      options[item] = modelSchema[item];
    }
  }

  /**
   * Constructor for SubModel
   * @param {string} modelName      The name of the sub model
   * @param {ModelItem} parentItem  The item the sub model belongs to
   * @param {Object} options        The options for the sub model (overwrites default)
   */
  var SubModel = function SubModel(modelName, parentItem, options) {
    var _this = this;

    _this._modelName = modelName;
    _this._options = options || {};

    _this.getParent = function() {
      return parentItem;
    };

    _this._gotServerData = false;
    _this._gotDbData = false;

    // Get the model of the parent item
    var parentItemModel = parentItem.getModel();

    // Set the options defined in the model schema if not manually overwritten
    var modelSchema = parentItemModel._subModelsSchema[modelName];
    var thisOptions = _this._options;
    setOptionIfUndefined(thisOptions, 'route', modelSchema);
    setOptionIfUndefined(thisOptions, 'keys', modelSchema);
    setOptionIfUndefined(thisOptions, 'storeName', modelSchema);

    // Set the model from the sourceModel stated in the sub model schema
    _this._model = modelHandler.getModel(modelSchema.sourceModel);

    // TODO check if should be moved to modelSchema
    if (_.isUndefined(thisOptions.serverOptions)) {
      thisOptions.serverOptions = {};
    }

    // Set server- and database handlers
    _this._serverHandler = new ServerHandler(_this.getFullRoute(),
      thisOptions.serverOptions);
    _this._dbHandler = dbHandlerFactory.createDbHandler(thisOptions.storeName,
      thisOptions.keys);

    _this._serverHandler.downStream.subscribe(function(item) {
      var serverId = item.meta.serverId;
      var action = item.meta.action;
      if (_.isUndefined(serverId)) {
        // Server sends complete list of items
        _this._serverItems = item.data;
        _this._gotServerData = true;

        // Only update database if db data already arrived
        if (_this._gotDbData) {
          _this._updateDb();
        }

        _this._sendAllItemsDownstream();
      } else if (action === 'save') {
        // Server sends only one item
        _this._serverItems.push(serverId);
        _this._storeItems.splice(_this._storeItems.indexOf(item.meta.storeId),
          1);
        _this._updateDb();
        _this._sendItemDownstream('server', serverId);
      } else if (action === 'deletePermanently') {
        var serverItemPos = _this._serverItems.indexOf(serverId);
        var deletedItemPos = _this._deletedItems.indexOf(serverId);
        _this._serverItems.splice(serverItemPos, 1);
        _this._deletedItems.splice(deletedItemPos, 1);
        _this._updateDb();
      }
    });

    // Public downstream
    _this.downStream = new Rx.Subject();

    _this._dbHandler.downStream.subscribe(function(item) {
      // Don't update server items because server has updated it already
      if (!_this._gotServerData) {
        _this._serverItems = item.data.serverItems;
      }

      _this._storeItems = item.data.storeItems;
      _this._deletedItems = item.data.deletedItems;

      _this._gotDbData = true;

      // Update database entry if item was received by the server
      if (_this._gotServerData) {
        _this._updateDb();
      }

      _this._sendAllItemsDownstream();
    });

    // Filter the items from the model downstream
    _this._filterModelStream = _this._model.downStream.filter(function(item) {
      var serverItems = _this._serverItems;
      var storeItems = _this._storeItems;

      var serverId = item.meta.serverId;
      var storeId = item.meta.storeId;

      // Item is included in the submodel by the server id
      if (!_.isUndefined(serverId) && _.includes(serverItems,
          serverId)) {
        return true;
      }

      // Item is included in the submodel by the store id
      if (!_.isUndefined(storeId) && _.includes(storeItems, storeId)) {
        // Server ID is now available, so add to server
        if (!_.isUndefined(serverId)) {
          _this._addToServer(serverId, storeId);
        }

        return true;
      }

      return false;
    });

    // Do something with the filtered items
    _this._filterModelStream.subscribe(_this.downStream);

    // Public upstream
    _this.upStream = new Rx.Subject();

    _this.upStream.subscribe(function(item) {

      var serverItems = _this._serverItems;
      var storeItems = _this._storeItems;

      var serverId = item.meta.serverId;
      var storeId = item.meta.storeId;
      var action = item.meta.action;

      switch (action) {
        case 'save':
          if (!_.isUndefined(serverId) && !_.includes(serverItems,
              serverId)) {
            _this._addToServer(serverId, storeId);
          } else if (_.isUndefined(serverId) && !_.isUndefined(
              storeId) && !_.includes(storeItems, storeId)) {
            _this._storeItems.push(storeId);
            _this._updateDb();
          }

          break;
        case 'delete':
          if (!_.isUndefined(serverId) && _.includes(serverItems,
              serverId)) {
            _this._removeFromServer(serverId);
          } else if (!_.isUndefined(storeId) && _.includes(storeItems,
              storeId)) {
            // Remove from store items list
            _this._storeItems.splice(storeItems.indexOf(storeId), 1);
            _this._updateDb();
          }

          break;
      }
    });

    _this._serverItems = [];
    _this._storeItems = [];
    _this._deletedItems = [];

    // Initially get data
    _this._dbHandler.getEntry(parentItem.meta._storeId);
    _this._serverHandler.fetch();
  };

  /**
   * Updates the database with the current items of the sub model
   */
  SubModel.prototype._updateDb = function() {
    this._dbHandler.upStream.onNext({
      meta: {
        storeId: this.getParent().meta.storeId
      },
      data: {
        storeItems: _.cloneDeep(this._storeItems),
        serverItems: _.cloneDeep(this._serverItems),
        deletedItems: _.cloneDeep(this._deletedItems)
      }
    });
  };

  /**
   * Sends the items of a certain type (server/store) to the downstream
   * @param  {string} idType  The type of the data ('server' or 'store')
   * @param  {*} id           The server or store id
   */
  SubModel.prototype._sendItemDownstream = function(idType, id) {
    var modelItem = this._model['_' + idType + 'IdHash'][id];
    if (!_.isUndefined(modelItem)) {
      this.downStream.onNext({
        meta: _.cloneDeep(modelItem.meta),
        data: _.cloneDeep(modelItem.data)
      });
    }
  };

  /**
   * Sends all items of the sub model to the downstream
   */
  SubModel.prototype._sendAllItemsDownstream = function() {
    var i;
    var modelItem;

    // Get the server items that are not marked to be deleted
    var serverItems = _.difference(this._serverItems, this._deletedItems);

    // Add server items to downstream
    for (i = 0; i < serverItems.length; i++) {
      this._sendItemDownstream('server', serverItems[i]);
    }

    // Add store items to downstream
    for (i = 0; i < this._storeItems.length; i++) {
      this._sendItemDownstream('store', serverItems[i]);
    }
  }

  /**
   * Adds an item to the server to add it the sub resource
   * @param {*} serverId      The server id of the item to add
   * @param {number} storeId  The store id of the item to add
   */
  SubModel.prototype._addToServer = function(serverId, storeId) {
    var storeItems = this._storeItems;

    if (!_.isUndefined(storeId) && !_.includes(storeItems, storeId)) {
      storeItems.push(storeId);
    }

    this._serverHandler.upStream.onNext({
      meta: {
        storeId: storeId,
        serverId: serverId,
        action: 'save'
      }
    });
  };

  /**
   * Removes an item from the server sub resource
   * @param  {*} serverId The server id of the item to remove from the resource
   */
  SubModel.prototype._removeFromServer = function(serverId) {
    var storeItems = this._storeItems;

    this._deletedItems.push(serverId);
    this._serverHandler.upStream.onNext({
      meta: {
        serverId: serverId,
        action: 'delete'
      }
    });

    this._updateDb();
  };

  /**
   * Gets the full resource path to communicate to the server
   * @return {Array} The different segments of the path (URL). The first segmen
   *                 is the base URL to the server
   */
  SubModel.prototype.getFullRoute = function() {
    return this.getParent().getFullRoute().concat([this._options.route]);
  };

  /**
   * Gets the next runtime id from the connected model
   * @return {number} The next unused and unique runtime DI
   */
  SubModel.prototype.getNextRuntimeId = function() {
    return this._model.getNextRuntimeId();
  };

  /**
   * Gets a single item from the submodel
   * @param  {number} rtId The runtime id of the item to get
   * @return {ModelItem}   The requested item. If not available in model or
   *                           or in the sub model, 'undefined' is returned
   */
  SubModel.prototype.getItem = function(rtId) {
    var item = this._model.getItem(rtId);
    if (_.includes(this._serverItems, item.meta.serverId) || _.includes(
        this._storeItems, item.meta.storeId)) {
      return item;
    } else {
      return undefined;
    }
  }

  /**
   * Gets all items of the sub model
   * @param  {Function} itemCb Function that has one of the ModelItems as the
   *                           parameter. Is invoked for every ModelItem in
   *                           the sub model
   */
  SubModel.prototype.getItems = function(itemCb) {
    var modelItem;
    var i;
    for (i = 0; i < this._serverItems.length; i++) {
      modelItem = this._model._serverIdHash[this._serverItems[i]];
      if (!_.isUndefined(modelItem)) {
        itemCb(modelItem);
      }
    }

    for (i = 0; i < this._storeItems.length; i++) {
      modelItem = this._model._storeIdHash[this._storeItems[i]];
      if (!_.isUndefined(modelItem)) {
        itemCb(modelItem);
      }
    }
  }

  return SubModel;

});
