'use strict';

define('ModelHandler', ['Model', 'harmonizedData', 'lodash'], function(Model,
  harmonizedData, _) {

  var ModelHandler = {

    /**
     * Initializes the model handler. Builds all the model instances from the
     * model schema specified in the harmonizedData module
     */
    init: function init() {
      var currentSchema;
      for (var modelName in harmonizedData._modelSchema) {
        currentSchema = _.clone(harmonizedData._modelSchema[modelName]);
        delete currentSchema.subModels;
        ModelHandler._modelList[modelName] = new Model(modelName, currentSchema);
      }
    },

    /**
     * Gets the model with the specified name
     * @param  {string} modelName The name of the model to get
     * @return {Model}            The model with the specified name
     */
    getModel: function getModel(modelName) {
      return ModelHandler._modelList[modelName];
    },

    /**
     * Pushes all unpushed data of all models to the servers
     */
    pushAll: function pushAll() {
      var modelList = ModelHandler._modelList;
      for (var modelName in modelList) {
        modelList[modelName].pushAll();
      }
    },

    /**
     * Fetches data from the servers of all models. This function is ideal to
     * call for at the beginning, when the offline mode is important
     */
    getFromServer: function getFromServer() {
      var modelList = ModelHandler._modelList;
      for (var modelName in modelList) {
        modelList[modelName].getFromServer();
      }
    },

    /**
     * Sets all models online
     */
    setOnline: function setOnline() {
      ModelHandler._globalConnectionState = true;
      var modelList = ModelHandler._modelList;
      for (var modelName in modelList) {
        modelList[modelName].setOnline();
      }
    },

    /**
     * Sets all models offline
     */
    setOffline: function setOffline() {
      ModelHandler._globalConnectionState = false;
      var modelList = ModelHandler._modelList;
      for (var modelName in modelList) {
        modelList[modelName].setOffline();
      }
    },

    /**
     * Gets the global connection state
     * @return {boolean} if true, it is online, if false offline
     */
    getConnectionState: function getConnectionState() {
      return ModelHandler._globalConnectionState;
    },

    _modelList: {}
  };

  return ModelHandler;

});
