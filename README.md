# harmonized.js

Harmonized.js is a data model for JavaScript and is based on RxJS. The philosophy behind harmonized.js is to build it as open and flexible as possible. At the moment the possibilities are kinda narrow, but in the future it will be customizable to the structure of your server-client infrastructure.

This is the base data model. That means it does not work properly as a standalone library. To make it work properly it needs a framework which implements promise based http/ajax requests (like jQuery or AngularJS). Actually there is a AngularJS implementation available that also calls the digest() function to update the views when something in the data model happens.

## Installation

The installation of harmonized.js is fairly simple. If you use Bower in your projects you simply have to install it with the following command:

````
bower install https://github.com/tchock/harmonized.js.git
````

Because this is a private repository, you have to create a ssh key and add it to bitbucket. On the bitbucket site there is a guide how to do that.

## Implementation

To implement harmonized.js you first have to include some dependencies:

* RxJS (http://www.reactivex.io)
* Lodash (http://www.lodash.com)

### Injecting your http handler

To use your implementation, you have to use the ``setup()`` method of the global ``harmonized`` object:

````JS
harmonized.setup(httpFunction, updateViewCallback);
````

This has to be done to inject the "promise ready" http/ajax implementation and an optional update view callback function (AngularJS needs the ``$rootScope.digest()`` function to be called to update the views, you can use it to initiate rendering or updating of your views if you need that).

It is advised to wrap this setup function with the setup of your implementation like so:

````JS
myHarmonized.init = function(config) {
  var httpFn = function(httpOptions) {
    // your http/ajax implementation
  };

  var updateCb = function() {
    // your update/rendering stuff
  };

  harmonized.setup(httpFn, updateCb);
  harmonized.setConfig(config).
};
````

The httpFunction is an important hook for your implementation. Because there are many libraries that include http requests with ``Promise`` support, harmonized.js was build to work with them instead to implement an additional AJAX library or rely on jQuery to be used.

This function has just one parameter: The http options. They are noted as an ``Object``. The basic structure of the httpOptions parameter was designed like the options of the AngularJS $http module. That means they can be directly passed through the $http() function.

The httpFunction has to return a promise.

### Configuring harmonized.js

You can configure harmonized to your liking. This can be done with the ``harmonized.setConfig(config)`` function. You see an example of usage in the code snippet above.

The configuration function can be used to set default values for your models, so that you don't have to set shared options for every single model. Because of that, you have to set the configuration BEFORE setting the model schema.

Following default values can be set:

* **defaultKeys** (*Object*): The default keys (server and store IDs)
    * **serverKey** (*string*): The default key for the server (server ID) (default: "id")
    * **storeKey** (*string*): The default key for the local database (server ID) (default: "\_id")
* **baseUrl** (*string*): The default base URL of your server (e.g. 'http://www.hyphe.me')

Those default values can be overwritten by the model specification.

Following global configurations can be set:
* **dbName** (*string*): The name of the local database (default: ``"harmonizedDb"``)
* **sendModifiedSince** (*boolean*): If ``true`` the requests to the server will be sent with the ``If-Modified-Since`` HTTP header, so only new/updated items will be received from the server. This has to be supported by the server API (default: ``false``).
* **fetchAtStart** (*boolean*): If ``true`` the models will fetch their data after initialization (when all data was received from the local database). When ``false`` the requests have to be made manually through the fetch method if the view model (default ``false``).

### Defining your infrastructure

After configuring your default values, you are able to set the mode schema to define your model infrastructure. Actually you can do this without even touching the config before, but then you have to define everything for every defined model. The model schema is set  by the ``harmonized.setModelSchema(schema)`` function.

A single model is described by an ``Object`` with the definition for this model inside it. The model schema is an ``Object`` persisting of these model objects with the model name as the key and the definition as the value. Lets say you have two models: "cars" and "passengers", each just using the default configuration. Then your schema looks like this:

````JS
harmonized.setModelSchema({
  cars: {},
  passengery: {}
});
````

When you want your models to have extra configuration you can do this in the objects for each model:

````JS
harmonized.setModelSchema({
  cars: {
    baseUrl: 'http://cars.hyphe.me',
    route: 'autos'
  },
  passengers: {
    storeName: 'localPlanes'
  }
});
````

The model can be defined with the following options:

* **baseUrl** (*string*): The base URL to the server of the model (default: config baseUrl).
* **keys** (*Object*): The identifier keys (server and store IDs).
    * **serverKey** (*string*): The key of the server identifier (default: config defaultKeys.serverKey).
    * **storeKey** (*string*): The key of the local storage identifier (default: config defaultKeys.storeKey).
* **route** (*string*): The part of the route to the resource on the server. If the data is located at "http://hyphe.me/cars", your route will be "cars" (default: the model name).
* **storeName** (*string*): The name of the local database store/table (default: the model name).


Inside the model you also can define sub models, sub models are models that belong to its parent model and get the data of another model (e.g. passengers that are going by a specific car):

````JS
harmonized.setModelSchema({
  cars: {
    subModels: {
      passengers: {
        sourceModel: 'passengers',
        storeName: 'passengers_of_cars', // by default "cars_passengers"
      }
    }
  },
  passengers: {}
});
````

There is an extra mandatory option for sub models:

* **sourceModel** (*string*): The name of the model the sub model gets the data of (and filters it with the data from the server).

This sub model has the same options as the model, with some minor differences:

* The default value for **storeName** is: parentModelName_modelName
* sub models can't persist of sub models (this may come later)
* The route property appends to the route of the parent: If the route to the parent is "http://hyphe.me/cars", and the route to the sub model resource is "http://hyphe.me/cars/passengers", the route is called "passengers". The default of that value is the sub model name.

## Initialization

To initialize harmonized.js the ``setModelSchema(schema)`` function has to be called with the "model schema" as a parameter. The model Schema is the blueprint of all models used with harmonized. It describes all top level models with its default options (like the name of the database store, the base url to the server, the route fragment to the server or the keys (server and store ID) to use). They also describe the sub models that can be nested inside models. But more to the model schema above.

To finally build the models and (if not happened yet) the databases automatically, you just have to call the ``build()`` function.

Besides the model schema, the setup function described above has to be called. So if you want to initialize harmonized.js completely you could also add it to the wrapping function:

````JS
myHarmonized.init = function(modelSchema, config) {
  var httpFn = function(httpOptions) {
    // your http/ajax implementation
  };

  harmonized.setup(httpFn);
  harmonized.setConfig(config);
  harmonized.setModelSchema({});
  harmonized.build();
};
````

## Using harmonized

Now the models are build and ready to use! To do that you have to build a view model. This can be done with the ``createViewModel(modelName, mapUpFn, mapDownFn)`` function:

````JS
var carsViewCollection = harmonized.createViewModel('cars');
````

Through the view model concept your view models can also have different data than the original model (e.g. a percentage value calculated out of two values of the model). This is done through the mapping functions (second and third parameter of the function).

The map down function is used to transform the data from the model to the view model data. The map up function does the exact opposite. This functions have just one parameter: The (cloned) data of the item. You can change it as you like without changing the original data.
If you have a car that only has the kW value saved but you need horse power, than you have to do this like that:

````JS
var carsViewCollection = harmonized.createViewModel('cars',
  // The map down function (transform from model)
  function(item) {
    item.hp = item.kw * 1.34102;
    delete item.kw;
    return item;
  },
  // The map up function (transform to model)
  function(item) {
    item.kw = item.hp * 0.7457;
    delete item.hp;
    return item;
  };
````

You always have to return the changed item (this will maybe changed in the future).

### Handling the data

When the view model is created, you can read and write the data in this model.

The view model consists of two parts: The view collection, which you get returned when creating a view model and the view item.

The view collection is an extended array. You can work with it as it would be an array (you should not use the array manipulating functions like ``splice()`` or ``push()`` because harmonized.js manages that array).

The view collection has two functions to manage its data:

* **fetch()**: Fetches data from the server. If you have the config option ``fetchAtStart`` checked, you don't need to do this initially to get the server data. If you have an (websocket) service that tells you when new data is available, this function can be used to fetch the new data.
* **new()**: Creates a new view item that will be added to the collection after it was saved

The elements of the array are the view items. This is where you work with your data most of the time! The view item can be extended with properties like it would be a plain ``Object``:

````JS
carsViewCollection[12].manufacturer = 'VW';
carsViewCollection[12].model = 'Golf';
````

You won't change the original model with that changes until you save them. These methods are available in a view item:

* **save()**: Saves the changes made on the view item to the model, local database and server.
* **delete()**: Deletes the item from the model, local database and server.
* **reset()**: Resets the item to the state of its model.

### Destroying the whole model and database structure

If you want to destroy the model and database structure (e.g. for logging out a user) there is the ``destroy()`` method:

````JS
harmonized.destroy();
````

After that you have to remove your created view models and items too. After destruction it is possible to build the model again with ``harmonized.build()``. Before rebuilding it, it is also possible to change the config (e.g. disable fetching data at the creation of the model):

````JS
harmonized.destroy();
harmonized.setConfig({
  fetchAtStart: false
});
harmonized.build();
````
