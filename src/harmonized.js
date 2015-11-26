define('harmonized', ['harmonizedData', 'modelHandler', 'ServerHandler',
    'ViewCollection'
  ],
  function(harmonizedData, modelHandler, ServerHandler, ViewCollection) {
    var harmonized = {

      /**
       * Sets the model schema
       * @param  {Object} schema The model schema
       */
      setModelSchema: function(schema) {
        harmonizedData.setModelSchema(schema);
      },

      /**
       * Sets the http function and the optional config
       * @param  {Function} httpFunction    The http function for server calls
       * @param  {Function} [viewUpdateCb]  The callback that is called whenever
       *                                    something in the view is updated
       */
      setup: function(httpFunction, viewUpdateCb) {
        harmonizedData._httpFunction = httpFunction;

        if (_.isFunction(viewUpdateCb)) {
          harmonizedData._viewUpdateCb = viewUpdateCb;
        }
      },

      setPromiseClass: function(promiseClass) {
        harmonizedData._promiseClass = promiseClass;
      },

      /**
       * Sets the config
       * @param  {Object} config The configuration (or partial configuration)
       */
      setConfig: function(config) {
        if (_.isObject(config)) {
          _.merge(harmonizedData._config, config);
        }
      },

      /**
       * Builds all models defined in the model schema
       */
      build: function() {
        modelHandler.init();
      },

      /**
       * Destroys all models and deletes the database. If you want to use
       * harmonized after calling this function. You first need to build the
       * models again with ``harmonized.build()``
       */
      destroy: function() {
        modelHandler.destroy();
      },

      /**
       * Pushes all unpushed data of all models
       */
      pushAll: function() {
        modelHandler.pushAll();
      },

      /**
       * Gets data from the servers of all models
       * @param {array} exceptions  A list of exceptions not fetched from the server
       */
      getFromServer: function(exceptions) {
        modelHandler.getFromServer(exceptions);
      },

      /**
       * Sets all connections online
       */
      setOnline: function() {
        ServerHandler.connectionStream.onNext(true);
      },

      /**
       * Sets all connections offline
       */
      setOffline: function() {
        ServerHandler.connectionStream.onNext(false);
      },

      /**
       * Creates a new view collection
       * @param  {string} modelName   The name of the model the collection
       *                              belongs to
       * @param  {Function} mapUpFn   A transform function to the model
       * @param  {Function} mapDownFn A transform function from the model
       * @return {ViewCollection}     The created view collection
       */
      createViewModel: function(modelName, mapUpFn, mapDownFn) {
        var model = modelHandler.getModel(modelName);
        return new ViewCollection(model, mapUpFn, mapDownFn);
      },

      errorStream: ServerHandler.errorStream,
    };

    return harmonized;

  });
