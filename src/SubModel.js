'use strict';

define('Model', ['harmonizedData', 'ServerHandler', 'dbHandlerFactory',
  'lodash'
], function(harmonizedData, ServerHandler, dbHandlerFactory, _) {

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

  var SubModel = function SubModel(modelName, parentItem, model, options) {
    var _this = this;

    _this._modelName = modelName;
    _this._model = model;
    _this._options = options || {};

    // Get the model of the parent item
    var parentItemModel = parentItem.getModel();

    // Set the options defined in the model schema if not manually overwritten
    var modelSchema = harmonizedData._modelSchema[parentItemModel._modelName].subModels[modelName];
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
    _this._serverHandler = new ServerHandler(_this.getUrl(), thisOptions.serverOptions);
    _this._dbHandler = dbHandlerFactory.createDbHandler(thisOptions.storeName,
      thisOptions.keys);

    _this._serverHandler.downStream.subscribe(function(item) {
      var rtId = item.meta.rtId;
      var serverId = item.meta.serverId;
      var storeId = item.meta.storeId;

      var rtIdHashItem = _this._rtIdHash[rtId];
      var serverIdHashItem = _this._serverIdHash[serverId];
      var storeIdHashItem = _this._storeIdHash[storeId];

      var hashItem = rtIdHashItem || serverIdHashItem || storeIdHashItem;

      if (!_.isUndefined(hashItem)) {
        if (!_.isUndefined(rtId) && _.isUndefined(rtIdHashItem)) {
          _this._rtIdHash[rtId] = hashItem;
        }

        if (!_.isUndefined(serverId) && _.isUndefined(serverIdHashItem)) {
          _this._serverIdHash[serverId] = hashItem;
        }

        if (!_.isUndefined(storeId) && _.isUndefined(storeIdHashItem)) {
          _this._storeIdHash[storeId] = hashItem;
        }
      } else {
        var modelItem = _this.model._serverIdHash[serverId];
        var subModelItem = {
          meta: {},
          item: modelItem
        };

        if (!_.isUndefined(rtId)) {
          subModelItem.meta.rtId = rtId;
          _this._rtIdHash[rtId] = subModelItem;
        }

        if (!_.isUndefined(serverId)) {
          subModelItem.meta.serverId = serverId;
          _this._serverIdHash[serverId] = subModelItem;
        }

        if (!_.isUndefined(storeId)) {
          subModelItem.meta.storeId = storeId;
          _this._storeIdHash[storeId] = subModelItem;
        }

      }




      if (!_.isUndefined(hashItem) && _.isUndefined(storeIdHashItem)) {
        _this._storeIdHash[item.meta.storeId] = hashItem;
      }

    });

  };

  return SubModel;

  });
