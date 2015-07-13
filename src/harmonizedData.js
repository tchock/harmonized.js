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

  /**
   * The HTTP function where the hook is stored
   * (e.g. jQuery $.ajax or angular $http)
   * @return {Promise} The promise of the http request
   */
  data._httpFunction = function() {
    throw new Error('No http function was added');
  };

  data.dbVersion = 1;

  /**
   * Sets the model schema
   * @param {Object} schema The schema to set
   */
  data.setModelSchema = function setModelSchema(schema) {
    data._setModelSchema(schema);
    data._modelSchema = schema;
  };

  /**
   * Gets the model schema
   * @return {Object} The model schema
   */
  data.getModelSchema = function getModelSchema() {
    return data._modelSchema;
  };

  /**
   * Internal function to set the model schema
   * @param {Object} schema             The model schema
   * @param {string} [storeNamePrefix]  The prefix for the store
   */
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

  /**
   * Gets the database schema
   * @return {Object} The database schema
   */
  data.getDbSchema = function getDbSchema() {
    var output = {};

    data._getDbSchema(data._modelSchema, output);

    return output;
  };

  /**
   * Internal function to get the database schema
   * @param  {Object} modelSchema The model schema
   * @param  {Object} output      The database schema
   */
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

  /**
   * Creates a stream item to send through the streams
   * @param  {Object} inputItem Item to create a stream item from
   * @param  {Object} keys      The store and server key
   * @return {Object}           The stream item
   */
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
