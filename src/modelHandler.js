'use strict';

define('modelHandler', ['Model', 'harmonizedData', 'dbHandlerFactory', 'lodash'],
  function(Model, harmonizedData, dbHandlerFactory, _) {

    var modelHandler = {

      /**
       * Initializes the model handler. Builds all the model instances from the
       * model schema specified in the harmonizedData module
       */
      init: function init() {
        var currentSchema;
        for (var modelName in harmonizedData._modelSchema) {
          currentSchema = _.clone(harmonizedData._modelSchema[modelName]);
          delete currentSchema.subModels;
          modelHandler._modelList[modelName] = new Model(modelName,
            currentSchema);
        }

        if (harmonizedData._config.fetchAtStart) {
          modelHandler.getFromServer();
        }
      },

      /**
       * Destroys the models of the handler and the entire database
       */
      destroy: function destroy() {
        modelHandler._modelList = {};
        dbHandlerFactory._DbHandler.deleteDb();
      },

      /**
       * Gets the model with the specified name
       * @param  {string} modelName The name of the model to get
       * @return {Model}            The model with the specified name
       */
      getModel: function getModel(modelName) {
        return modelHandler._modelList[modelName];
      },

      /**
       * Pushes all unpushed data of all models to the servers
       */
      pushAll: function pushAll() {
        var modelList = modelHandler._modelList;
        for (var modelName in modelList) {
          modelList[modelName].pushAll();
        }
      },

      /**
       * Fetches data from the servers of all models. This function is ideal to
       * call for at the beginning, when the offline mode is important
       */
      getFromServer: function getFromServer() {
        var modelList = modelHandler._modelList;
        for (var modelName in modelList) {
          modelList[modelName].getFromServer();
        }
      },



      _modelList: {}
    };

    return modelHandler;

  });
