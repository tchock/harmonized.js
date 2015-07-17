# harmonized.js

Harmonized.js is a data model for JavaScript and is based on RxJS. The philosophy behind harmonized.js is to build it as open and flexible as possible. At the moment the possibilities are kinda narrow, but in the future it will be customizable to the structure of your server-client infrastructure.

This is the base data model. That means it does not work properly as a standalone library. To make it work properly it needs a framework which implements promise based http/ajax requests (like jQuery or AngularJS). Actually there is a AngularJS implementation available that also calls the digest() function to update the views when something in the data model happens.

## Installation

The installation of harmonized.js is fairly simple. If you use Bower in your projects you simply have to install it with the following command:

````
bower install git@bitbucket.org:hyphe/web-harmonized.js.git
````

Because this is a private repository, you have to create a ssh key and add it to bitbucket. On the bitbucket site there is a guide how to do that.

## Implementation

To implement harmonized.js you first have to include some dependencies:

* RxJS (http://www.reactivex.io)
* Lodash (http://www.lodash.com)

TODO: Check how to exclude them in the build so they can be loaded externally

To build your implementation, you have to use the ``setup()`` method of the global ``harmonized`` object:

````JS
harmonized.setup(httpFunction, config);
````

It is advised to wrap this setup function with the setup of your implementation like so:

````JS
myHarmonized.init = function(config) {
  var httpFn = function(httpOptions) {
    // your http/ajax implementation
  };

  harmonized.setup(httpFn, config);
};
````

The httpFunction is an important hook for your implementation. Because there are many libraries that include http requests with ``Promise`` support, harmonized.js was build to work with them instead to implement an additional AJAX library or rely on jQuery to be used.

This function has just one parameter: The http options. They are noted as an ``Object``. The basic structure of the httpOptions parameter was designed like the options of the AngularJS $http module. That means they can be directly passed through the $http() function.

The httpFunction has to return the promise of the $http() function.

Additional to the httpFunction there is the config parameter. It inherits the default config for your harmonized.js environment. More on the config parameter later.

## Initialization

To initialize harmonized.js the ``setModelSchema()`` function has to be called with the "model schema" as a parameter. The model Schema is the blueprint of all models used with harmonized. It describes all top level models with its default options (like the name of the database store, the base url to the server, the route fragment to the server or the keys (server and store ID) to use). They also describe the sub models that can be nested inside models. But more to the model schema later.

Besides the model schema, the setup function described above has to be called. So if you want to initialize harmonized.js completely you could also add it to the wrapping function:

````JS
myHarmonized.init = function(modelSchema, config) {
  var httpFn = function(httpOptions) {
    // your http/ajax implementation
  };

  harmonized.setup(httpFn, config);
  harmonized.setModelSchema({})
};
````
