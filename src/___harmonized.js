'use strict';

var Harmonized = function Harmonized() { // jshint ignore:line

};

Harmonized._config = {
  defaultServerKey: 'id',
  defaultStoreKey: '_id',
  baseUrl: null,
  dbName: 'harmonizedDb',
  sendModifiedSince: false
};

Harmonized._resourceSchema = {};
Harmonized._dbSchema = {};

Harmonized.dbVersion = 1;

Harmonized.getStoreKey = function() {
  // TODO implement get store key fn
};

Harmonized.getServerKey = function() {
  // TODO implement get server key fn
};

Harmonized.setModelSchema = function setModelSchema(schema) {
  // TODO validate the schema
  Harmonized._modelSchema = schema;
  Harmonized._dbSchema = {};
  Harmonized._setDbSchema(schema);
};

Harmonized._setDbSchema = function setDbSchema(modelSchema, storeNamePrefix) {
  var newDbSchemaItem;
  var storeName;
  var subModels;

  for (var schemaItem in modelSchema) {
    newDbSchemaItem = {};
    newDbSchemaItem.serverKey = modelSchema[schemaItem].serverKey ||
      Harmonized._config.defaultServerKey;
    newDbSchemaItem.storeKey = modelSchema[schemaItem].storeKey ||
      Harmonized._config.defaultStoreKey;

    storeName = modelSchema[schemaItem].storeName || schemaItem;
    if (_.isString(storeNamePrefix)) {
      storeName = storeNamePrefix + '_' + storeName;
    }

    Harmonized._dbSchema[storeName] = newDbSchemaItem;
    subModels = modelSchema[schemaItem].subModels;
    if (_.isObject(subModels)) {
      Harmonized._setDbSchema(subModels, storeName);
    }
  }
};

Harmonized.getDbSchema = function(store) {
  if (_.isUndefined(store)) {
    return Harmonized._dbSchema;
  }

  return Harmonized._dbSchema[store];
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
