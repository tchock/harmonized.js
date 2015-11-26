'use strict';

define('modelHandler', ['Model', 'harmonizedData', 'dbHandlerFactory', 'lodash'],
  function(Model, harmonizedData, dbHandlerFactory, _) {

    var modelHandler = {

      /**
       * Initializes the model handler. Builds all the model instances from the
       * model schema specified in the harmonizedData module
       */
      init: function init() {
        harmonizedData.generateModelSchema();

        var currentSchema;
        for (var modelName in harmonizedData._modelSchema) {
          currentSchema = _.cloneDeep(harmonizedData._generatedModelSchema[modelName]);
          delete currentSchema.subModels;
          modelHandler._modelList[modelName] = new Model(modelName,
            currentSchema);
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
          modelList[modelName]._serverHandler.pushAll();
        }
      },

      /**
       * Fetches data from the servers of all models. This function is ideal to
       * call for at the beginning, when the offline mode is important
       * @param {array} exceptions  A list of exceptions not fetched from the server
       */
      getFromServer: function getFromServer(exceptions) {
        var modelList = modelHandler._modelList;
        for (var modelName in modelList) {
          console.log('exceptions');
          console.log(exceptions);
          console.log(modelName);
          if (!_.includes(exceptions, modelName)) {
            modelList[modelName].getFromServer();
          }
        }
      },

      _modelList: {}
    };

    return modelHandler;

  });
