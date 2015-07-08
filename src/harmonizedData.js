'use strict';

define('harmonizedData', function() {

var data = {}; // jshint ignore:line

data._config = {
  defaultKeys: {
    serverKey: 'id',
    storeKey: '_id'
  },
  baseUrl: null,
  dbName: 'harmonizedDb',
  sendModifiedSince: false
};

data._resourceSchema = {};
data._httpFunction = function() {
  throw new Error('No http function was added');
};

data.dbVersion = 1;

data.setModelSchema = function setModelSchema(schema) {
  data._setModelSchema(schema);
  data._modelSchema = schema;
};

data.getModelSchema = function getModelSchema() {
  return data._modelSchema;
};

data._setModelSchema = function _setModelSchema(schema, storeNamePrefix) {
  var subModels;
  var currentModel;
  var keys;

  for (var item in schema) {
    currentModel = schema[item];
    if (!_.isObject(currentModel.keys)) {
      currentModel.keys = data._config.defaultKeys;
    } else {
      keys = currentModel.keys;

      if (_.isUndefined(keys.serverKey)) {
        keys.serverKey = data._config.defaultKeys.serverKey;
      }

      if (_.isUndefined(keys.storeKey)) {
        keys.storeKey = data._config.defaultKeys.storeKey;
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
      data._setModelSchema(subModels, currentModel.storeName + '_');
    }
  }
};

data.getDbSchema = function getDbSchema() {
  var output = {};

  data._getDbSchema(data._modelSchema, output);

  return output;
};

data._getDbSchema = function(modelSchema, output) {
  var currentModel;
  var subModels;

  for (var schemaItem in modelSchema) {
    currentModel = modelSchema[schemaItem];
    output[currentModel.storeName] = currentModel.keys;
    subModels = modelSchema[schemaItem].subModels;
    if (_.isObject(subModels)) {
      data._getDbSchema(subModels, output);
    }
  }
};

data._createStreamItem = function(inputItem, keys) {
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

  return data;

});
