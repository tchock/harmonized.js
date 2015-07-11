define('ModelItem', ['rx'], function(Rx) {

  /**
   * The ModelItem constructor
   * @param {Model} parentModel The model the item belongs to
   * @param {Object} data       The data of the item
   * @param {Object} meta       The metadata of the item (e.g. IDs, deletedFlag)
   */
  var ModelItem = function ModelItem(parentModel, data, meta) {
    _this = this;
    _this.data = data || {};
    _this.meta = meta || {};

    // Set the runtime ID
    // If runtime ID is set in metadata, let it stay that way.
    // If runtime ID is not set in metadata, get a new runtime ID from the model
    _this.meta.rtId = _this.meta.rtId || parentModel.getNextRuntimeId();

    // Function to filter the current item on the basis of the runtime ID
    function filterThisItem(item) {
      return item.meta.rtId === _this.meta.rtId;
    }

    // filtered streams to the streams of the model
    _this._dbDownStream = parentModel._dbDownStream.filter(filterThisItem);
    _this._updateStreams = Rx.Observable.merge(parentModel.upStream,
        parentModel._existingItemDownStream).filter(filterThisItem);

    /**
     * Gets the model of the item. This is needed as a function to prevent
     * circular dependency
     * @return {Model} The model of the item
     */
    _this.getModel = function getModel() {
      return parentModel;
    }

    // Add item to the runtime ID hash
    _this.getModel()._rtIdHash[_this.meta.rtId] = _this;

    // Add item to the server ID hash if server ID is available
    if (!_.isUndefined(_this.meta.serverId)) {
      _this.getModel()._serverIdHash[_this.meta.serverId] = _this;
    }

    // Add item to the store ID hash if store ID is available
    if (!_.isUndefined(_this.meta.storeId)) {
      _this.getModel()._storeIdHash[_this.meta.storeId] = _this;
    }

    // Delete permanently when item was deleted permanently in database
    _this._dbDownStream.filter(function(item) {
      return item.meta.action === 'deletePermanently';
    }).subscribe(_this.deletePermanently);

    // Filter update streams for this item to be saved
    _this._updateStreams.filter(function(item) {
      return item.meta.action === 'save';
    }).subscribe(_this.save);

    // Filter update streams for this item to be marked as deleted
    _this._updateStreams.filter(function(item) {
      return item.meta.action === 'delete';
    }).subscribe(_this.delete);

    return this;
  };

  /**
   * Gets the full URL of the item
   * @return {String} The full URL to the item resource on the server
   */
  ModelItem.prototype.getUrl = function() {
    var currentPathSegment = this.meta.serverId || '';
    return this.getModel().getUrl() + '/' + currentPathSegment;
  };

  /**
   * Save the model item
   * @param  {Object} item  The stream item
   * @return {Object}       The stream item
   */
  ModelItem.prototype.save = function(item) {
    this.meta = item.meta;
    this.data = item.data;
    return item;
  }

  /**
   * Mark the model item as deleted
   * @param  {Object} item  The stream item
   * @return {Object}       The stream item
   */
  ModelItem.prototype.delete = function(item) {
    this.meta.deleted = true;
    return item;
  }

  /**
   * Delete the model item permanently from the model
   * @param  {Object} item  The stream item
   * @return {Object}       The stream item
   */
  ModelItem.prototype.deletePermanently = function(item) {
    var parentModel = this.getModel();
    delete parentModel._rtIdHash[this.meta.rtId];

    if (!_.isUndefined(this.meta.serverId)) {
      delete parentModel._serverIdHash[this.meta.serverId];
    }

    if (!_.isUndefined(this.meta.storeId)) {
      delete parentModel._storeIdHash[this.meta.storeId];
    }

    return item;
  }



  return ModelItem;
});
