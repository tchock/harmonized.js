'use strict';

var Harmonized = function Harmonized() { // jshint ignore:line

};

Harmonized._config = {
  defaultKeys: {
    serverKey: 'id',
    storeKey: '_id'
  },
  baseUrl: null,
  dbName: 'harmonizedDb',
  sendModifiedSince: false
};

Harmonized._resourceSchema = {};

Harmonized.dbVersion = 1;

Harmonized.getStoreKey = function() {
  // TODO implement get store key fn
};

Harmonized.getServerKey = function() {
  // TODO implement get server key fn
};

Harmonized.setModelSchema = function setModelSchema(schema) {

  Harmonized._setModelSchema(schema);
  Harmonized._modelSchema = schema;
};

Harmonized._setModelSchema = function _setModelSchema(schema, storeNamePrefix) {
  var subModels;
  var currentModel;
  var keys;

  for (var item in schema) {
    currentModel = schema[item];
    if (!_.isObject(currentModel.keys)) {
      currentModel.keys = Harmonized._config.defaultKeys;
    } else {
      keys = currentModel.keys;

      if (_.isUndefined(keys.serverKey)) {
        keys.serverKey = Harmonized._config.defaultKeys.serverKey;
      }

      if (_.isUndefined(keys.storeKey)) {
        keys.storeKey = Harmonized._config.defaultKeys.storeKey;
      }
    }

    if (_.isUndefined(currentModel.storeName)) {
      if (!_.isString(storeNamePrefix)) {
        storeNamePrefix = '';
      }

      currentModel.storeName = storeNamePrefix + item;
    }

    subModels = currentModel.subModels;
    if (_.isObject(subModels)) {
      Harmonized._setModelSchema(subModels, currentModel.storeName + '_');
    }
  }
};

Harmonized.getDbSchema = function getDbSchema() {
  var output = {};

  Harmonized._getDbSchema(Harmonized._modelSchema, output);

  return output;
};

Harmonized._getDbSchema = function(modelSchema, output) {
  var currentModel;
  var subModels;

  for (var schemaItem in modelSchema) {
    currentModel = modelSchema[schemaItem];
    output[currentModel.storeName] = currentModel.keys;
    subModels = modelSchema[schemaItem].subModels;
    if (_.isObject(subModels)) {
      Harmonized._getDbSchema(subModels, output);
    }
  }
};

Harmonized._createStreamItem = function(inputItem, keys) {
  inputItem = _.clone(inputItem);
  var item = {
    meta: {
      storeId: inputItem[keys.storeKey],
      serverId: inputItem[keys.serverKey]
    }
  };

  // Remove the metadata from the actual data
  delete inputItem[keys.storeKey];
  delete inputItem[keys.serverKey];

  item.data = inputItem;

  return item;
};
