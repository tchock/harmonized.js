'use strict';

define('ViewCollection', ['ViewItem', 'rx', 'lodash'], function(ViewItem, Rx, _) {

  /**
   * The ViewCollection constructor
   * @param {Model} model     The model the view collection should get the data from
   * @param {Function} mapDownFn Function to change the data to the view format
   * @param {Function} mapUpFn   Function to change the data to the model format
   */
  var ViewCollection = function ViewCollection(model, mapDownFn, mapUpFn) {
    // Make the collection act as an array
    var collection = Object.create(Array.prototype);
    collection = Array.apply(collection);

    collection._model = model;

    // Set the map functions to the ones in the parameter or to default
    collection._mapDownFn = mapDownFn || function(item) {
      return item;
    };

    collection._mapUpFn = mapUpFn || function(item) {
      return item;
    };

    // map the downstream to show the data as the view needs it
    collection.downStream = model.downStream.map(function(item) {
      var newItem = _.clone(item);
      newItem.data = collection._mapDownFn(newItem.data);
      return newItem;
    });

    // map the upstream to transform the data to the model format
    collection.upStream = new Rx.Subject();
    collection.upStream.map(function(item) {
      var newItem = _.clone(item);
      newItem.data = collection._mapUpFn(newItem.data);
      return newItem;
    }).subscribe(model.upStream);

    // Inject all items of the ViewController prototype to the created instance
    ViewCollection.injectClassMethods(collection);

    // Get all model items
    model.getItems(function(item) {
      console.log(item);
      collection.push(new ViewItem(this, item.data, item.meta, true));
    });

    return collection;
  };

  /**
   * Injects all items from the prototype to the created view collection
   * @param  {Object} collection The collection to add the methods to
   * @return {Object}            The collection with the added methods
   */
  ViewCollection.injectClassMethods = function injectClassMethods(
    collection) {
    // Loop over all the prototype methods and add them
    // to the new collection.
    for (var method in ViewCollection.prototype) {
      // Make sure this is a local method.
      /* istanbul ignore else */
      if (ViewCollection.prototype.hasOwnProperty(method)) {
        // Add the method to the collection.
        collection[method] = ViewCollection.prototype[method];
      }
    }

    return collection;
  };

  /**
   * Adds a new item from the model to the view model
   * @param  {number}   rtId The runtime ID of the item to add
   * @return {ViewItem}      The added view item
   */
  ViewCollection.prototype.addItem = function(rtId) {
    var itemToAdd = this._model.getItem(rtId);
    var newViewItem;
    if (!_.isUndefined(itemToAdd)) {
      var data = this._mapDownFn(itemToAdd.data);
      newViewItem = new ViewItem(this, data, itemToAdd.meta, true);
      this.push(newViewItem);
    }

    return newViewItem;
  };

  /**
   * Creates a new view item with reference to the collection
   * @return {ViewItem} The created view item
   */
  ViewCollection.prototype.new = function() {
    return new ViewItem(this, {}, {});
  };

  return ViewCollection;
});
