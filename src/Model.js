'use strict';

define('Model', ['harmonizedData', 'ModelItem', 'ServerHandler',
  'dbHandlerFactory',
  'lodash'
], function(harmonizedData,
  ModelItem, ServerHandler, dbHandlerFactory, _) {

  function setOptionIfUndefined(options, item, modelSchema) {
    if (_.isUndefined(options[item])) {
      options[item] = modelSchema[item];
    }
  }

  function downStreamMap(model) {
    return function(item) {

      var knownItem = model._rtIdHash[item.meta.rtId] || model._serverIdHash[
        item.meta.serverId] || model._storeIdHash[item.meta.storeId];

      if (!_.isUndefined(knownItem)) {
        // Sync known item metadata with item metadata
        knownItem.meta.rtId = knownItem.meta.rtId || item.meta.rtId;
        knownItem.meta.serverId = knownItem.meta.serverId || item.meta
          .serverId;
        knownItem.meta.storeId = knownItem.meta.storeId || item.meta.storeId;
        item.meta = _.clone(knownItem.meta);

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
    }
  }

  var Model = function Model(modelName, options) {
    var _this = this;

    _this._randomId = Math.round(Math.random() * 10000);

    _this._modelName = modelName;
    _this._options = options || {};

    var modelSchema = harmonizedData._modelSchema[modelName];
    var thisOptions = _this._options;
    setOptionIfUndefined(thisOptions, 'baseUrl', modelSchema);
    setOptionIfUndefined(thisOptions, 'route', modelSchema);
    setOptionIfUndefined(thisOptions, 'keys', modelSchema);
    setOptionIfUndefined(thisOptions, 'storeName', modelSchema);

    // TODO check if should be moved to modelSchema
    if (_.isUndefined(thisOptions.serverOptions)) {
      thisOptions.serverOptions = {};
    }

    // Set server- and database handlers
    _this._serverHandler = new ServerHandler(thisOptions.baseUrl,
      thisOptions.route, thisOptions.serverOptions);
    _this._dbHandler = dbHandlerFactory.createDbHandler(thisOptions.storeName,
      thisOptions.keys);

    // The downstreams with map function to add not added hash ids
    _this._serverDownStream = _this._serverHandler.downStream.map(downStreamMap(_this));
    _this._dbDownStream = _this._dbHandler.downStream.map(downStreamMap(_this));

    // Add already available items to the database
    _this._serverDownStream.filter(function(item) {
      return !_.isUndefined(item.meta.rtId);
    }).subscribe(_this._dbHandler.upStream);

    // Public upstream
    _this.upStream = new Rx.Subject();


    // public upstream => serverHandler upstream & dbHandler upstream
    _this.upStream.subscribe(_this._serverHandler.upStream);
    _this.upStream.subscribe(_this._dbHandler.upStream);

    // Public downstream
    _this.downStream = new Rx.Subject();

    // Internal downstream merged from the database and server downstreams
    _this._downStream = new Rx.Observable.merge(_this._serverDownStream,
      _this._dbDownStream);

    // Only add already existing model items to the public downstream
    _this._downStream.filter(function(item) {
      return !_.isUndefined(item.meta.rtId);
    }).subscribe(_this.downStream);

    // Create a stream for data not yet in the model
    _this._downStream.filter(function(item) {
      return _.isUndefined(item.meta.rtId);
    }).subscribe(function(item) {
      var newModel = new ModelItem(_this, item.data, item.meta);
      item.meta = _.clone(newModel.meta);

      // Send to downstream to update views and database upstream to save
      _this.downStream.onNext(item);
      _this.upStream.onNext(item);
    });

    // Hashs for ModelItems
    _this._rtIdHash = {};
    _this._serverIdHash = {};
    _this._storeIdHash = {};

    _this._nextRuntimeId = 1;

    return _this;
  };

  Model.prototype.getItems = function() {
    var itemList = [];
    var hash = this._rtIdHash;
    for (var item in hash) {
      itemList.push(hash[item]);
    }

    return itemList;
  }

  Model.prototype.getItem = function(rtId) {
    return this._rtIdHash[rtId];
  }

  Model.prototype.getFromServer = function() {
    this._serverHandler.fetch();
  }

  Model.prototype.getNextRuntimeId = function() {
    return this._nextRuntimeId++;
  }

  return Model;

});
