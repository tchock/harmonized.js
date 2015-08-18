'use strict';

define('Model', ['harmonizedData', 'ModelItem', 'ServerHandler',
  'dbHandlerFactory',
  'lodash'
], function(harmonizedData,
  ModelItem, ServerHandler, dbHandlerFactory, _) {

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
   * The map function to synchronize the metadata of the ModelItem with the
   * metadata of the stream item from the database or server downstream
   * @param  {Model} model  The Model where the metadata will be changed
   * @return {Object}       The item with the updated metadata
   */
  function downStreamMap(model) {
    return function(item) {
      var knownItem = model._rtIdHash[item.meta.rtId] || model._serverIdHash[
        item.meta.serverId] || model._storeIdHash[item.meta.storeId];

      if (!_.isUndefined(knownItem)) {
        // Sync known item metadata with item metadata
        knownItem.meta.rtId = knownItem.meta.rtId || item.meta.rtId;
        knownItem.meta.serverId = knownItem.meta.serverId || item.meta.serverId;
        knownItem.meta.storeId = knownItem.meta.storeId || item.meta.storeId;
        knownItem.meta.deleted = item.meta.deleted || knownItem.meta.deleted;

        // Add known data to item
        var itemAction = item.meta.action;
        _.extend(item.meta, knownItem.meta);
        item.meta.action = itemAction;

        // Add to server ID hash if server ID is known and item not in hash
        if (!_.isUndefined(item.meta.serverId) && _.isUndefined(model
            ._serverIdHash[item.meta.serverId])) {
          model._serverIdHash[item.meta.serverId] = knownItem;
        }

        // Add to store ID hash if store ID is known and item not in hash
        if (!_.isUndefined(item.meta.storeId) && _.isUndefined(model._storeIdHash[
            item.meta.storeId])) {
          model._storeIdHash[item.meta.storeId] = knownItem;
        }

      }

      return item;
    };
  };

  /**
   * The constructor of the Model
   * @param {string} modelName Name of the model
   * @param {Object} [options]   The options to overwrite the default model options
   */
  var Model = function Model(modelName, options) {
    var _this = this;

    _this._modelName = modelName;
    _this._options = options || {};

    // Set the options defined in the model schema if not manually overwritten
    var modelSchema = harmonizedData._modelSchema[modelName];
    var thisOptions = _this._options;
    for (var optKey in modelSchema) {
      if (modelSchema.hasOwnProperty(optKey)) {
        setOptionIfUndefined(thisOptions, optKey, modelSchema);
      }
    }

    _this._subModelsSchema = modelSchema.subModels;

    // Set server- and database handlers
    _this._serverHandler = new ServerHandler(_this.getFullRoute(), thisOptions.keys, thisOptions.serverOptions);

    // Build db handler if data should be saved locally or build the db handler
    // stub, to fake a database call. This is simpler to write extra logic for
    // the case, that no data will be saved locally.
    if (thisOptions.saveLocally) {
      _this._buildDbHandler();
    } else {
      _this._buildDbHandlerStub();
    }

    // The downstreams with map function to add not added hash ids
    _this._serverDownStream = _this._serverHandler.downStream.map(downStreamMap(_this));
    _this._dbDownStream = _this._dbHandler.downStream.map(downStreamMap(_this));

    // Add already available items to the database
    _this._serverDownStream.filter(function(item) {
      return !_.isUndefined(item.meta.rtId);
    }).subscribe(_this._dbHandler.upStream);

    // Public upstream
    _this.upStream = new Rx.Subject();

    // Create a stream for data received from the upstream not yet in the model
    _this.upStream.filter(function(item) {
      return _.isUndefined(_this._rtIdHash[item.meta.rtId]);
    }).subscribe(function(item) {
      new ModelItem(_this, item.data, item.meta);
    });

    // public upstream => serverHandler upstream & dbHandler upstream
    _this.upStream.subscribe(_this._serverHandler.upStream);
    _this.upStream.subscribe(_this._dbHandler.upStream);

    // Public downstream
    _this.downStream = new Rx.Subject();

    // Internal downstream merged from the database and server downstreams
    _this._downStream = Rx.Observable.merge(_this._serverDownStream,
      _this._dbDownStream);

    // Only add already existing model items to the public downstream
    _this._existingItemDownStream = _this._downStream.filter(function(item) {
      return !_.isUndefined(item.meta.rtId);
    });

    _this._existingItemDownStream.subscribe(_this.downStream);

    // Create a stream for data received from the downstream not yet in the model
    _this._downStream.filter(function(item) {
      return _.isUndefined(item.meta.rtId);
    }).subscribe(function(item) {
      _this._createNewItem(item);
    });

    // Hashs for ModelItems
    _this._rtIdHash = {};
    _this._serverIdHash = {};
    _this._storeIdHash = {};

    _this._nextRuntimeId = 1;

    // Get data from db and server

    return _this;
  };

  /**
   * Creates a new item
   * @param  {Object} item The stream item with metadata and data
   */
  Model.prototype._createNewItem = function(item) {
    var newModel = new ModelItem(this, item.data, item.meta);
    item.meta = _.clone(newModel.meta);
    delete item.meta.action;
  };

  /**
   * Builds the database handler (will only be called in the constructor)
   */
  Model.prototype._buildDbHandler = function() {
    var _this = this;
    _this._dbHandler = dbHandlerFactory.createDbHandler(_this._options.storeName, _this._options.keys);

    // Listen to the database to be connected, to get all entries
    dbHandlerFactory._DbHandler._connectionStream.subscribe(function(state) {
      if (state === true) {
        _this._dbHandler.getAllEntries(function() {
          _this._dbReadyCb();
        });
      }
    });

    // Get all entries, if the database is already connected
    if (dbHandlerFactory._DbHandler._db !== null) {
      _this._dbHandler.getAllEntries(function() {
        _this._dbReadyCb();
      });
    }
  };

  /**
   * Builds a stub for the database handler, because there will be no saving into
   * the local database.
   */
  Model.prototype._buildDbHandlerStub = function() {
    this._dbHandler = {
      downStream: new Rx.Subject(),
      upStream: new Rx.Subject()
    };

    // Subscribe the downstream directly to the upstream
    this._dbHandler.upStream.map(function(item) {
      // Set action to "deletePermanently" if action was delete
      // to permanently delete item in Model
      item.meta.action = (item.meta.action === 'delete') ? 'deletePermanently' : item.meta.action;
      return item;
    }).subscribe(this._dbHandler.downStream);

    // No DB, so db is immediately ready ;)
    this._dbReadyCb();
  };

  /**
   * Get all items of the model
   * @return {Array} List of all ModelItems
   */
  Model.prototype.getItems = function(itemCb) {
    var hash = this._rtIdHash;
    for (var item in hash) {
      itemCb(hash[item]);
    }
  };

  /**
   * Gets a single item of the model
   * @param  {number} rtId  Runtime ID of the item to get
   * @return {ModelItem}    The ModelItem with the selected runtime ID
   */
  Model.prototype.getItem = function(rtId) {
    return this._rtIdHash[rtId];
  };

  /**
   * This function will be called after the database query got all items!
   * This is useful to only ask for the server entries if the database
   * items are ready.
   */
  Model.prototype._dbReadyCb = function() {
    var _this = this;
    if (harmonizedData._config.fetchAtStart) {
      _this.getFromServer(function() {
        _this.pushChanges();
      });
    }
  }

  Model.prototype.pushChanges = function() {
    // Push the items to the server that have to be saved
    for (var storeId in this._storeIdHash) {
      if (this._storeIdHash.hasOwnProperty(storeId)) {
        var currentItem = this._storeIdHash[storeId];
        var itemMeta = _.clone(currentItem.meta);
        var itemData = _.clone(currentItem.data);

        if (_.isUndefined(currentItem.meta.serverId)) {

          delete itemMeta.serverId;
          itemMeta.action = 'save';

          this._serverHandler.upStream.onNext({
            meta: itemMeta,
            data: itemData
          });
        } else if (currentItem.meta.deleted) {
          itemMeta.action = 'delete';
          this._serverHandler.upStream.onNext({
            meta: itemMeta,
            data: itemData
          });
        }
      }
    }
  }

  /**
   * Request a fetch of data from the server. The requested data will be pushed
   * to the ServerHandler downstream
   */
  Model.prototype.getFromServer = function(cb) {
    this._serverHandler.fetch(cb);
  };

  /**
   * Checks for items that are deleted on the server and removes them locally.
   */
  Model.prototype.checkForDeletedItems = function() {
    var _this = this;

    // TODO make params configurable
    this._serverHandler.sendHttpRequest({
      params: {
        view: 'keys'
      }
    }).then(function(items) {
      // Get to know the locally known server ids
      var localServerIds = [];
      for (var serverId in _this._serverIdHash) {
        if (_this._serverIdHash.hasOwnProperty(serverId)) {
          localServerIds.push(parseInt(serverId));
        }
      }

      var deletedItemIds = _.difference(localServerIds, items);

      var keys = _this._options.keys;
      for (var i = 0; i < deletedItemIds.length; i++) {

        // Create the stream item
        var currentItem = _this._serverIdHash[deletedItemIds[i]];
        var streamItem = {
          meta: _.clone(currentItem.meta),
          data: _.clone(currentItem.data)
        };
        streamItem.meta.action = 'deletePermanently';

        // Send to the streams
        _this.downStream.onNext(streamItem);
        _this._dbHandler.upStream.onNext(streamItem);
      }
    });
  }

  /**
   * Gets the next runtime ID for a new item
   * @return {number} a new model-unique runtimeid
   */
  Model.prototype.getNextRuntimeId = function() {
    return this._nextRuntimeId++;
  };

  /**
   * Gets the full URL to the resource of the server
   * @return {String} URL to the resource of the server
   */
  Model.prototype.getFullRoute = function() {
    return [this._options.baseUrl, this._options.route];
  };

  return Model;

});
