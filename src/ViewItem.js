'use strict';

define('ViewItem', ['lodash', 'rx', 'ViewCollection', 'harmonizedData', 'ServerHandler'],
  function(_, Rx, ViewCollection, harmonizedData, ServerHandler) {

    /**
     * Constructor of the ViewItem
     * @param {ViewCollection} viewCollection   The collection of the item
     * @param {Object} [data]                   The data of the item
     * @param {Object} [meta]                   The metadata of the item
     * @param {boolean} [addToCollection]       true if item should be added
     *                                          directly, false if not
     */
    var ViewItem = function ViewItem(viewCollection, data, meta, subData, addToCollection) {
      var _this = this;

      // If item is user created (by the collections .new() method), this is false
      _this._wasAlreadySynced = (subData !== null && subData !== undefined);

      /**
       * Gets the collection of the item
       * @return {ViewCollection} The collection of the item
       */
      _this.getCollection = function() {
        return viewCollection;
      };

      _this._streams = {};

      _this._streams.upStream = viewCollection.upStream;

      _this._streams.downStream = Rx.Observable.merge(viewCollection.downStream, viewCollection.functionReturnStream)
        .filter(function(item) {
          return item.meta.rtId === _this._meta.rtId;
        });

      _this._streams.saveDownStream = _this._streams.downStream.filter(function(item) {
        return item.meta.action === 'save';
      });

      // Subscription for the save downstream
      _this._streams.saveDownStreamSub = _this._streams.saveDownStream.subscribe(function(item) {
        _this._save(item.data, item.meta);
      });

      // Subscription for the delete downstream
      _this._streams.deleteDownStream = _this._streams.downStream.filter(function(item) {
        return item.meta.action === 'delete' || item.meta.action === 'deletePermanently';
      });

      // Subscription for the delete downstream
      _this._streams.deleteDownStreamSub = _this._streams.deleteDownStream.subscribe(function() {
        _this._delete();
      });

      _this._streams.functionDownStream = viewCollection.functionReturnStream.filter(function(item) {
        return item.meta.rtId === _this._meta.rtId;
      });

      _this._meta = meta || {};
      _this._meta = _.cloneDeep(_this._meta);
      delete _this._meta.action;

      // Add the content
      for (var key in data) {
        _this[key] = data[key];
      }

      if (subData !== null && subData !== undefined) {
        _this._addSubCollections(subData);
      }

      _this._meta.addedToCollection = false;
      if (addToCollection) {
        _this._meta.addedToCollection = true;
        viewCollection.push(_this);
        viewCollection.incrementVersion();
        viewCollection._items[_this._meta.rtId] = _this;
        harmonizedData._viewUpdateCb();
      }

      // Add item to the items list, if runtime ID is set
      if (_.isUndefined(_this._meta.rtId)) {
        viewCollection._items[_this._meta.rtId] = _this;
      }

    };

    /**
     * Sends item to the upstream (to the model)
     * @param {string} action       The action that should be added (save or delete)
     * @param {Object} [data]       Data to send instead of item data
     * @param {Object} serverData   Data that will additionally send to the server.
     *                              Is ignored by everything else
     */
    ViewItem.prototype._sendItemToUpStream = function(action, data, serverData) {
      var itemData = {};
      var itemMeta = {};

      var model = this.getCollection()._model;

      if (_.isUndefined(this._meta.rtId)) {
        this._meta.rtId = model.getNextRuntimeId();
      }

      var viewCollection = this.getCollection();

      // Add item to collection if not yet in it
      if (this._meta.addedToCollection === false) {
        this._meta.addedToCollection = true;
        viewCollection.push(this);
        viewCollection.incrementVersion();
        harmonizedData._viewUpdateCb();
      }

      // Add item to the items list, if not already in list
      if (_.isUndefined(viewCollection._items[this._meta.rtId])) {
        viewCollection._items[this._meta.rtId] = this;
      }

      itemMeta.rtId = this._meta.rtId;
      itemMeta.transactionId = harmonizedData.getNextTransactionId();

      if (!_.isUndefined(this._meta.serverId)) {
        itemMeta.serverId = this._meta.serverId;
      }

      if (!_.isUndefined(this._meta.storeId)) {
        itemMeta.storeId = this._meta.storeId;
      }

      itemMeta.action = action;

      itemMeta.serverData = serverData;

      // Set data to send
      if (_.isObject(data)) {
        // If the data argument is an object, send this data
        itemData = data;
      } else {
        // Otherwise send the data of the item
        for (var item in this) {
          if (this._isPropertyData(item)) {
            itemData[item] = this[item];
          }
        }
      }

      // Push to upstream
      this._streams.upStream.onNext({
        data: itemData,
        meta: itemMeta,
      });

      return itemMeta.transactionId;
    };

    /**
     * Saves the item and updates the data of the model, server and local
     * database. If item is not yet in the collection, it adds itself.
     * @param {Object} serverData   Data that will additionally send to the server.
     *                              Is ignored by everything else
     * @return {Promise}            The action promise to execute further actions
     */
    ViewItem.prototype.save = function(serverData) {
      var transactionId = this._sendItemToUpStream('save', undefined, serverData);
      return this._returnActionPromise('saveDownStream', transactionId);
    };

    /**
     * Save function for the save downstream. Updates the data and metadata
     * @param  {Object} data The new data of the item
     * @param  {Object} meta The new metadata of the item
     */
    ViewItem.prototype._save = function(data, meta) {
      // Set metadata
      if (!_.isUndefined(meta.storeId)) {
        this._meta.storeId = meta.storeId;
      }

      if (!_.isUndefined(meta.serverId)) {
        this._meta.serverId = meta.serverId;
      }

      // Remove all old data
      for (var item in this) {
        if (this._isPropertyData(item)) {
          delete this[item];
        }
      }

      // Add new data
      for (var key in data) {
        this[key] = data[key];
      }

      // Add sub model view collections to the item if not happened before
      if (!this._wasAlreadySynced) {
        var model = this.getCollection()._model;
        var modelItem = model.getItem(this._meta.rtId);
        var subData = modelItem.subData;
        if (_.isPlainObject(subData)) {
          // Add sub collections if subdata is set
          this._addSubCollections(subData);
        }

        this._wasAlreadySynced = true;
      }

      harmonizedData._viewUpdateCb();
    };

    /**
     * Deletes the item from the database, server, model and view collection
     * @return {Promise}     The action promise to execute further actions
     */
    ViewItem.prototype.delete = function() {
      var transactionId;
      if (this._meta.rtId) {
        // Only send to upstream if there is a runtime ID
        transactionId = this._sendItemToUpStream('delete');
      }

      // Delete the item from the view collection
      this._delete();
      this.getCollection().incrementVersion();

      return this._returnActionPromise('deleteDownStream', transactionId);
    };

    /**
     * Internal delete function. Sets the delete flag, deletes the item from the
     * collection and disposes the downstream subscriptions of the item
     */
    ViewItem.prototype._delete = function() {
      // Set metadata deleted flag
      this._meta.deleted = true;

      // Delete from collection
      if (this._meta.addedToCollection) {
        var collection = this.getCollection();
        for (var i = collection.length - 1; i >= 0; i--) {
          if (collection[i] === this) {
            collection.splice(i, 1);
          }
        }
      }

      this._streams.saveDownStreamSub.dispose();
      this._streams.deleteDownStreamSub.dispose();
      harmonizedData._viewUpdateCb();
    };

    /**
     * Resets the item to the model entry
     */
    ViewItem.prototype.reset = function() {
      var item = this.getCollection()._model.getItem(this._meta.rtId);
      this._save(_.cloneDeep(item.data), _.cloneDeep(item.meta));
    };

    /**
     * Checks if a given property is a dataentry of the item
     * @param  {string} property  Property to test for dataentry
     * @return {boolean}          If true, the property is a dataentry
     */
    ViewItem.prototype._isPropertyData = function(property) {
      return this.hasOwnProperty(property) &&
        property !== '_meta' &&
        property !== 'getCollection' &&
        property !== '_streams' &&
        property !== '_wasAlreadySynced' &&
        !_.includes(this._subDataList, property);
    };

    /**
     * Adds sub collections to the item. The collections resemble the sub models
     * of the model item
     * @param {Object} subData object containing the sub data of the model item
     */
    ViewItem.prototype._addSubCollections = function(subData) {
      this._subDataList = Object.keys(subData);
      for (var subModel in subData) {
        if (subData.hasOwnProperty(subModel)) {
          this[subModel] = new ViewCollection(subData[subModel]);
        }
      }
    };

    /**
     * Calls a HTTP function on the server
     * @param  {string} name The name of the function
     * @param  {Object} args The arguments for the function
     * @return {Promise}     The action promise to execute further actions
     */
    ViewItem.prototype.callFn = function(name, args) {
      var transactionId = this._sendItemToUpStream('function', {
        fnName: name,
        fnArgs: args,
      });

      return this._returnActionPromise('downStream', transactionId);
    };

    /**
     * Returns the action promise for a given transaction id
     * @param  {number} transactionId The transaction ID to hear on the stream
     * @return {Promise}              The promise object
     */
    ViewItem.prototype._returnActionPromise = function(stream, transactionId) {
      var Promise = harmonizedData._promiseClass;
      if (Promise !== null) {
        var deferred = Promise.defer();

        var successSub;
        var errorSub;

        if (transactionId) {
          successSub = this._streams[stream].filter(function(item) {
            return item.meta.transactionId === transactionId;
          }).subscribe(function(item) {
            deferred.resolve(item);
            successSub.dispose();
            errorSub.dispose();
          });

          errorSub = ServerHandler.errorStream.filter(function(error) {
            return error.target.transactionId === transactionId;
          }).subscribe(function(error) {
            if (error.target.status === -1) {
              deferred.notify();
            } else {
              deferred.reject(error);
              successSub.dispose();
              errorSub.dispose();
            }
          });
        } else {
          deferred.reject(new Error('Item as no runtime id'));
        }

        return deferred.promise;
      }
    };

    return ViewItem;
  });
