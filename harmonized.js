(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
      define([], factory);
    } else {
      root.libGlobalName = factory();
    }
}(this, function () {
/**
 * @license almond 0.3.1 Copyright (c) 2011-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice,
        jsSuffixRegExp = /\.js$/;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap, lastIndex,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                name = name.split('/');
                lastIndex = name.length - 1;

                // Node .js allowance:
                if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                    name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                }

                //Lop off the last part of baseParts, so that . matches the
                //"directory" and not name of the baseName's module. For instance,
                //baseName of "one/two/three", maps to "one/two/three.js", but we
                //want the directory, "one/two" for this normalization.
                name = baseParts.slice(0, baseParts.length - 1).concat(name);

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            var args = aps.call(arguments, 0);

            //If first arg is not require('string'), and there is only
            //one arg, it is the array form without a callback. Insert
            //a null so that the following concat is correct.
            if (typeof args[0] !== 'string' && args.length === 1) {
                args.push(null);
            }
            return req.apply(undef, args.concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            callbackType = typeof callback,
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (callbackType === 'undefined' || callbackType === 'function') {
            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback ? callback.apply(defined[name], args) : undefined;

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (config.deps) {
                req(config.deps, config.callback);
            }
            if (!callback) {
                return;
            }

            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        return req(cfg);
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {
        if (typeof name !== 'string') {
            throw new Error('See almond README: incorrect module build, no module name');
        }

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("../bower_components/almond/almond", function(){});



define('harmonizedData', ['lodash'], function(_) {

  var data = {}; // jshint ignore:line

  data._config = {
    defaultKeys: {
      serverKey: 'id',
      storeKey: '_id',
    },
    baseUrl: null,
    dbName: 'harmonizedDb',
    fetchAtStart: false,
    saveLocally: false,
    serverOptions: {
      sendModifiedSince: false,
      protocol: 'http',
      httpHeaders: {
        all: {},
        get: {},
        post: {},
        put: {},
        delete: {},
        function: {},
      },
      hooks: {
        functionReturn: null,
      },
      omitItemDataOnSend: false,
    },
  };

  data._resourceSchema = {};

  data._nextTransactionId = 1;

  /**
   * The HTTP function where the hook is stored
   * (e.g. jQuery $.ajax or angular $http)
   * @return {Promise} The promise of the http request
   */
  data._httpFunction = function() {
    throw new Error('No http function was added');
  };

  // The promise class
  data._promiseClass = null;

  /**
   * The view update hook. It is called every time the view is updated
   */
  data._viewUpdateCb = function() {};

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
        var defaultKeys = _.cloneDeep(this._config.defaultKeys);
        currentModel.keys = defaultKeys;
      } else {
        keys = currentModel.keys;

        if (_.isUndefined(keys.serverKey)) {
          keys.serverKey = this._config.defaultKeys.serverKey;
        }

        if (_.isUndefined(keys.storeKey)) {
          keys.storeKey = this._config.defaultKeys.storeKey;
        }
      }

      if (_.isUndefined(currentModel.storeName)) {
        if (!_.isString(storeNamePrefix)) {
          storeNamePrefix = '';
        }

        currentModel.storeName = storeNamePrefix + item;
      }

      if (_.isUndefined(currentModel.route)) {
        currentModel.route = item;
      }

      if (_.isUndefined(currentModel.baseUrl)) {
        currentModel.baseUrl = data._config.baseUrl;
      }

      if (_.isUndefined(currentModel.saveLocally)) {
        currentModel.saveLocally = data._config.saveLocally;
      }

      if (_.isUndefined(currentModel.serverOptions)) {
        currentModel.serverOptions = _.cloneDeep(data._config.serverOptions);
      }

      if (_.isUndefined(currentModel.fetchAtStart)) {
        currentModel.fetchAtStart = data._config.fetchAtStart;
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
    inputItem = _.cloneDeep(inputItem) || {};
    var item = {
      meta: {
        storeId: inputItem[keys.storeKey],
        serverId: inputItem[keys.serverKey],
        deleted: !!inputItem._deleted,
      },
    };

    // Delete store Id if the key is undefined (e.g. when creating item at the server)
    if (_.isUndefined(keys.storeKey)) {
      delete item.meta.storeId;
    }

    // Remove the metadata from the actual data
    delete inputItem[keys.storeKey];
    delete inputItem[keys.serverKey];
    delete inputItem._deleted;
    item.data = inputItem;

    return item;
  };

  /**
   * Gets the next transaction ID for a new stream item
   * @return {number} a new unique transaction ID
   */
  data.getNextTransactionId = function() {
    return data._nextTransactionId++;
  };

  return data;

});



define('ServerHandler/httpHandler', ['harmonizedData', 'lodash'], function(harmonizedData, _) {
  return {

    /**
     * Sets connection state to true
     * @param  {ServerHandler} serverHandler ServerHandler to set connection on
     */
    connect: function(serverHandler) {
      serverHandler._connected = true;
      serverHandler.pushAll();
    },

    /**
     * Sets connection state to false
     * @param  {ServerHandler} serverHandler ServerHandler to set connection on
     */
    disconnect: function(serverHandler) {
      serverHandler._connected = false;
    },

    /**
     * Fetches data from the server via HTTP
     * @param  {ServerHandler} serverHandler ServerHandler to set last modified
     */
    fetch: function(serverHandler, cb) {
      var httpOptions = {};

      if (_.isObject(serverHandler._options.params)) {
        httpOptions.params = serverHandler._options.params;
      }

      httpOptions.headers = _.merge({}, serverHandler._options.httpHeaders.get, serverHandler._options.httpHeaders.all);

      if (serverHandler._options.sendModifiedSince && serverHandler._lastModified > 0) {
        httpOptions.headers['If-Modified-Since'] =  serverHandler._lastModified;
      }

      httpOptions.url = serverHandler._fullUrl;
      httpOptions.method = 'GET';

      harmonizedData._httpFunction(httpOptions).then(function(response) {
        // Return last modified response
        serverHandler._lastModified = response.header.lastModified;

        // The returned content
        var returnedItems = response.data;
        var responseLenght = returnedItems.length;

        // Go through all returned items
        for (var i = 0; i < responseLenght; i++) {
          var item = harmonizedData._createStreamItem(returnedItems[i], {
            serverKey: serverHandler._keys.serverKey,
          });
          item.meta.action = 'save';

          // Send item to the downstream
          serverHandler.downStream.onNext(item);
        }

        if (_.isFunction(cb)) {
          cb();
        }
      }).catch(function(error) {
        // Catch errors
        serverHandler._broadcastError(error);
      });
    },

    /**
     * Sends a request to the server
     * @param  {ServerHandler} serverHandler  The server handler to get URL
     * @param  {Request} httpOptions          The options for the request
     * @return {Promise}                      The promise of the HTTP request
     */
    sendRequest: function(httpOptions, serverHandler) {
      httpOptions.url = serverHandler._fullUrl;
      httpOptions.method = httpOptions.method || 'GET';

      return harmonizedData._httpFunction(httpOptions);
    },

    /**
     * Push item to the HTTP server
     * @param  {object} item                  item to push
     * @param  {ServerHandler} serverHandler  ServerHandler for individual options
     */
    push: function(item, serverHandler) {
      var httpOptions = {};

      if (_.isObject(serverHandler._options.params)) {
        httpOptions.params = serverHandler._options.params;
      }

      httpOptions.url = serverHandler._fullUrl;

      var action = item.meta.action;
      switch (action) {
        case 'save':
          httpOptions.data = serverHandler._createServerItem(item);
          if (_.isUndefined(item.meta.serverId)) {
            httpOptions.method = 'POST';
            httpOptions.headers = _.merge({}, serverHandler._options.httpHeaders.post, serverHandler._options.httpHeaders.all);
          } else {
            httpOptions.method = 'PUT';
            httpOptions.url = httpOptions.url + item.meta.serverId + '/';
            httpOptions.headers = _.merge({}, serverHandler._options.httpHeaders.put, serverHandler._options.httpHeaders.all);
          }

          break;
        case 'delete':
          httpOptions.method = 'DELETE';
          httpOptions.url = httpOptions.url + item.meta.serverId + '/';
          httpOptions.headers = _.merge({}, serverHandler._options.httpHeaders.delete, serverHandler._options.httpHeaders.all);
          break;
        case 'function':
          httpOptions.method = 'POST';
          httpOptions.headers = _.merge({}, serverHandler._options.httpHeaders.function, serverHandler._options.httpHeaders.all);
          var idPart = (_.isUndefined(item.meta.serverId)) ? '' :  item.meta.serverId + '/';
          httpOptions.url = httpOptions.url + idPart + item.data.fnName + '/';
          httpOptions.data = item.data.fnArgs;
          break;
      }

      harmonizedData._httpFunction(httpOptions).then(function(returnItem) {
        var tempItem = harmonizedData._createStreamItem(returnItem.data, {
          serverKey: serverHandler._keys.serverKey,
        });

        item.meta.serverId = tempItem.meta.serverId || item.meta.serverId;

        // Delete server id if not defined
        if (_.isUndefined(item.meta.serverId)) {
          delete item.meta.serverId;
        }

        if (item.meta.action === 'save' && serverHandler._options.omitItemDataOnSend) {
          item.data = returnItem.data;
          delete item.data[serverHandler._keys.serverKey];
        } else if (item.meta.action === 'delete') {
          item.meta.action = 'deletePermanently';
          item.meta.deleted = true;
        } else if (item.meta.action === 'function') {
          item.data.fnReturn = tempItem.data;
          if (_.isPlainObject(serverHandler._options.hooks) && _.isFunction(serverHandler._options.hooks.functionReturn)) {
            item = serverHandler._options.hooks.functionReturn(item, returnItem.data);
          }
        }

        serverHandler.downStream.onNext(item);
      }).catch(function(error) {
        serverHandler._unpushedList[item.meta.rtId] = item;
        serverHandler._broadcastError(error, item);
      });
    },
  };
});



define('ServerHandler/socketHandler', ['harmonizedData'], function(harmonizedData) {
  return {

    /**
     * Connects to the socket and set connection state to true
     * @param  {ServerHandler} serverHandler ServerHandler to set connection on
     */
    connect: function(serverHandler) {
      // TODO implement socket connect
      // Wire with streams
    },

    /**
     * Disconnects from the socket set connection state to false
     * @param  {ServerHandler} serverHandler ServerHandler to set connection on
     */
    disconnect: function(serverHandler) {
      // TODO implement socket disconnect
      // Remove connection with streams
    },

    /**
     * Fetches data from the server via socket
     * @param  {ServerHandler} serverHandler ServerHandler to set last modified
     */
    fetch: function(serverHandler) {
      // TODO implement socket fetch
      // fetch everything
    },

    /**
     * Push item to the socket server
     * @param  {Object} item          item to push
     * @param  {ServerHandler} serverHandler ServerHandler for individual options
     */
    push: function(item, serverHandler) {
      // TODO implement socket push
      // push a single item to the serverHandler
    }
  };
});



define('helper/webStorage', [],function() {
  var webStore = {};

  /**
   * Gets the current active web storage (local or session)
   * @return {Storage} The storage that is active (localStorage or sessionStorage)
   */
  webStore.getWebStorage = function() {
    return webStore._webStorage;
  };

  /* istanbul ignore next */

  /**
   * Gets the localStorage
   *
   * This function exists to make it possible to spy on the local storage
   *
   * @return {Storage} The localStorage
   */
  webStore._getLocalStorage = function() {
    return window.localStorage;
  };

  /* istanbul ignore next */

  /**
   * Gets the sessionStorage
   *
   * This function exists to make it possible to spy on the session storage
   *
   * @return {Storage} The sessionStorage
   */
  webStore._getSessionStorage = function() {
    return window.sessionStorage;
  };

  webStore._webStorage = webStore._getSessionStorage();

  /**
   * Sets the web storage to local or session storage
   * @param  {string} storage     The name of the storage to switch to:
   *                            	Either 'session' for session storage or
   *                            	'local' for local storage
   * @param  {boolean} [doClear]  If true the storage that was set before the
   *                              switch will be cleared
   */
  webStore.setWebStorage = function(storage, doClear) {
    if (doClear) {
      webStore._webStorage.clear();
    }

    switch (storage) {
      case 'session':
        webStore._webStorage = webStore._getSessionStorage();
        break;
      case 'local':
        webStore._webStorage = webStore._getLocalStorage();
        break;
      default:
        webStore._webStorage = webStore._getSessionStorage();
    }
  };

  return webStore;
});



define('ServerHandler', ['ServerHandler/httpHandler',
    'ServerHandler/socketHandler', 'helper/webStorage', 'rx'
  ],
  function(httpHandler, socketHandler, webStorage, Rx) {

    /**
     * ServerHandler constructor
     * @param  {Array} route      The route to the server resource, the
     *                            first array entry is the base URL
     * @param  {Object} options   The options for the server handler
     */
    var ServerHandler = function(route, keys, options) {
      var _this = this;

      this._baseUrl = route.splice(0, 1)[0];
      this._resourcePath = route;
      this._fullUrl = this._buildUrl();
      this._options = options || {};
      this._keys = keys;

      // Public streams
      this.upStream = new Rx.Subject();
      this.upStream.subscribe(function(item) {
        if (!_this._connected) {
          _this._unpushedList[item.meta.rtId] = item;
        } else {
          _this._protocol.push(item, _this);
        }
      }, function(err) {});

      this.downStream = new Rx.Subject();
      this.downStream.subscribe(
        /* istanbul ignore next */
        function() {},

        function(error) {
          ServerHandler.errorStream.onNext(error);
        });

      // Instance connection stream that gets input from
      // the global connection stream.
      this.connectionStream = new Rx.Subject();
      this.connectionStream.subscribe(function(state) {
        _this.setConnectionState(state);
      });

      this._connected = false;

      ServerHandler.connectionStream.subscribe(this.connectionStream);

      // List of items that couldn't be pushed to the server (e.g. because of
      // missing connection or offline mode).
      // Key of the items is always the runtime ID, so they can be replaced by
      // newer versions.
      this._unpushedList = {};

      this._lastModified = webStorage.getWebStorage().getItem(
        'harmonized-modified-' + this._resourcePath.join('_')) || 0;

      this._protocol = null;
      var useProtocol;
      if (this._options.protocol === 'websocket') {
        useProtocol = 'websocket';
      } else {
        useProtocol = 'http';
      }

      this._setProtocol(useProtocol);
    };

    ServerHandler.connectionStream = new Rx.Subject();
    ServerHandler.errorStream = new Rx.Subject();

    /**
     * Sets the protocol to HTTP or WebSocket
     * @param {httpHandler|socketHandler} protocol The protocol to set
     */
    ServerHandler.prototype._setProtocol = function setProtocol(protocol) {
      var _this = this;

      function setTheProtocol(newProtocol) {
        if (_this._protocol !== null) {
          _this._protocol.disconnect(_this);
        }

        _this._protocol = newProtocol;
        _this._protocol.connect(_this);
      }

      if (protocol === 'http' && this._protocol !== httpHandler) {
        setTheProtocol(httpHandler);
      } else if (protocol === 'websocket' && this._protocol !==
        socketHandler) {
        setTheProtocol(socketHandler);
      }
    };

    /**
     * Fetches the data from the server
     */
    ServerHandler.prototype.fetch = function fetch(cb) {
      this._protocol.fetch(this, cb);
    };

    /**
     * Sends a custom HTTP request to the server
     * @param  {Object} options The options for the request
     * @return {Promise}        The promise of the custom request
     */
    ServerHandler.prototype.sendHttpRequest = function(options) {
      return httpHandler.sendRequest(options, this);
    }

    /**
     * Pushes all unpushed data to the server
     */
    ServerHandler.prototype.pushAll = function pushAll() {
      for (var item in this._unpushedList) {
        this.upStream.onNext(this._unpushedList[item]);
        delete this._unpushedList[item];
      }
    };

    /**
     * Sets the connection online/offline
     * @param {boolean} state The connection state that should be set
     */
    ServerHandler.prototype.setConnectionState = function setConnectionState(
      state) {
      if (this._connected !== state) {
        if (state) {
          this._protocol.connect(this);
        } else {
          this._protocol.disconnect(this);
        }
      }

    };

    /**
     * Broadcasts an error globally to the error stream
     * @param  {Error} error The error to broadcast
     */
    ServerHandler.prototype._broadcastError = function broadcastError(error, item) {
      if (_.isPlainObject(item)) {
        error.target.transactionId = item.meta.transactionId;
      }

      ServerHandler.errorStream.onNext(error);
    };

    /**
     * Creates a server item in the form to send to the server
     * @param  {Object} item Item that has to be transformed to server server structure
     * @return {Object}      The item in the structure the server accepts
     */
    ServerHandler.prototype._createServerItem = function createServerItem(item) {
      var meta = item.meta || {};
      var serverData = meta.serverData || {};

      var serverItem;

      if (this._options.omitItemDataOnSend) {
        serverItem = serverData;
      } else {
        serverItem = _.extend({}, item.data, serverData);
      }

      return serverItem;
    };

    ServerHandler.prototype._buildUrl = function() {
      var url = this._baseUrl + '/';

      for (var i = 0; i < this._resourcePath.length; i++) {
        url = url + this._resourcePath[i] + '/';
      }

      return url;
    };

    ServerHandler.prototype.setLastModified = function(lastModified) {
      this._lastModified = lastModified;
      var path = this._resourcePath.join('_');
      webStorage.getWebStorage().setItem('harmonized-modified-' + path, lastModified);
    };

    return ServerHandler;
  });



define('DbHandler/BaseHandler', ['helper/webStorage'], function(webStore) {

  /**
   * The database handler constructor
   * @param {IndexedDbHandler|WebSqlHandler} dbHandler The explicit database handler
   * @param {string} storeName                            The name of the database store
   * @param {Object} keys                                 The store and server keys
   */
  var DbHandler = function DbHandler(dbHandler, storeName, keys) {
    var _this = this;

    this._storeName = storeName;
    this._keys = keys;

    // Public streams
    this.downStream = new Rx.Subject();
    this.upStream = new Rx.Subject();

    // Internal pausable upstream
    this._upStream = this.upStream.pausableBuffered(dbHandler._connectionStream);

    // Directly connect to the server if necessary
    if (!dbHandler._db && dbHandler._isConnecting === false) {
      dbHandler._connectionStream.onNext(false);
      dbHandler.connect();
    }

    // Save upstream
    this._saveUpstream = this._upStream.filter(function(item) {
      return item.meta.action === 'save';
    });

    this._saveDownstream = this._saveUpstream.flatMap(function(item) {
      return _this.put(item);
    });

    this._saveSubscribe = this._saveDownstream.subscribe(this.downStream);

    // Delete upstream
    this._deleteUpstream = this._upStream.filter(function(item) {
      return item.meta.action === 'delete';
    });

    this._deleteDownstream = this._deleteUpstream.flatMap(function(item) {
      if (_.isUndefined(item.meta.serverId)) {
        return _this.remove(item);
      } else {
        return _this.put(item);
      }
    });

    this._deleteSubscribe = this._deleteDownstream.subscribe(this.downStream);

    // Delete permanently upstream
    this._deletePermanentlyUpstream = this._upStream.filter(function(item) {
      return item.meta.action === 'deletePermanently';
    });

    this._deletePermanentlyDownstream = this._deletePermanentlyUpstream.map(function(item) {
      _this.remove(item);
      return item;
    });

    this._deletePermanentlySubscribe = this._deletePermanentlyDownstream.subscribe(this.downStream);

    // Initially get the metadata
    this._metaStorageName = 'harmonized-meta-' + this._storeName;
    this._metadata = webStore.getWebStorage().getItem(this._metaStorageName) || {};
  };

  /**
   * Gets the metadata of the database
   * @return {Object} The database metadata
   */
  DbHandler.prototype.getMetadata = function() {
    return this._metadata;
  };

  /**
   * Sets the database metadata
   * @param  {string} key   The key of the metadata entry
   * @param  {*} value      The value of the metadata entry
   */
  DbHandler.prototype.setMetadata = function(key, value) {
    this._metadata[key] = value;
    webStore.getWebStorage().setItem(this._metaStorageName, this._metadata);
  };

  /**
   * Creates a database item in a format that can be saved to the local database
   * @param  {Object} item  The item that has to be transformed to the local
   *                        database format
   * @return {Object}       The item in the database format
   */
  DbHandler.prototype._createDbItem = function(item) {
    // Clone data and arrange it for db
    var putItem = _.cloneDeep(item.data);
    if (!_.isUndefined(item.meta) && !_.isUndefined(item.meta.storeId)) {
      putItem[this._keys.storeKey] = item.meta.storeId;
    }

    if (!_.isUndefined(item.meta) && !_.isUndefined(item.meta.serverId)) {
      putItem[this._keys.serverKey] = item.meta.serverId;
    }

    if (!_.isUndefined(item.meta) && item.meta.action === 'delete') {
      putItem._deleted = true;
    } else {
      putItem._deleted = false;
    }

    return putItem;
  };

  return DbHandler;
});



define('DbHandler/IndexedDbHandler', ['DbHandler/BaseHandler', 'harmonizedData', 'rx', 'lodash'], function(DbHandler, harmonizedData, Rx, _) {

  /**
   * The IndexedDbHandler constructor
   * @param {string} storeName The name of the store of the created handler
   * @param {Object} keys      The store and server keys
   */
  var IndexedDbHandler = function IndexedDbHandler(storeName, keys) {
    this._handlerType = 'IndexedDB';
    DbHandler.call(this, IndexedDbHandler,
      storeName, keys);
  };

  // Connection stream to pause or resume the upstream
  IndexedDbHandler._connectionStream = new Rx.Subject();

  // Database Object
  IndexedDbHandler._db = null;
  IndexedDbHandler._isConnecting = false;

  /* istanbul ignore next */

  /**
   * Get the window.indexedDb object
   *
   * This function exists to make it possible to spy on the local storage
   * @return {IDBFactory} The indexedDb object
   */
  IndexedDbHandler.getDbReference = function() {
    return window.indexedDB;
  };

  /**
   * Connect to the indexeddb handler
   * @return {IDBRequest} The indexedDb request object of the connection
   */
  IndexedDbHandler.connect = function() {
    var dbHandler = IndexedDbHandler;
    if (dbHandler._db !== null || dbHandler._isConnecting) {
      // DB connection is already established
      dbHandler._isConnecting = false;
      return;
    }

    dbHandler._isConnecting = true;
    var request = dbHandler.getDbReference().open('harmonizedDb',
      harmonizedData.dbVersion);

    // Request success
    request.onsuccess = function() {
      dbHandler._db = request.result;
      dbHandler._isConnecting = false;
      dbHandler._connectionStream.onNext(true);
    };

    request.onerror = function(e) {
      dbHandler._connectionStream.onError(new Error(e.target.error.name));
      dbHandler._isConnecting = false;
    };

    // DB needs upgrade
    request.onupgradeneeded = function(e) {
      var db = e.target.result;
      var schema = harmonizedData.getDbSchema();
      var currentStore;
      var i;

      // Remove all stores items
      if (!_.isUndefined(db)) {
        for (i = db.objectStoreNames.length - 1; i >= 0; i--) {
          currentStore = db.objectStoreNames[i];
          db.deleteObjectStore(currentStore);
        }
      }

      for (var store in schema) {
        currentStore = schema[store];
        var objectStore = db.createObjectStore(store, {
          keyPath: currentStore.storeKey,
          autoIncrement: true
        });
        objectStore.createIndex('serverId', currentStore.serverKey, {
          unique: true,
          multiEntry: false
        });
      }
    };

    return request;
  };

  /**
   * Closes the connection to the indexedDb database
   */
  IndexedDbHandler.closeConnection = function() {
    var dbHandler = IndexedDbHandler;
    var db = dbHandler._db;
    /* istanbul ignore else */
    if (db) {
      db.close();
      dbHandler._db = null;
      dbHandler._connectionStream.onNext(false);
    }
  };

  /**
   * Deletes the database
   * @return {IDBRequest} The indexedDB request for the database deletion
   */
  IndexedDbHandler.deleteDb = function() {
    IndexedDbHandler.closeConnection();
    return IndexedDbHandler.getDbReference().deleteDatabase(
      'harmonizedDb');
  };

  IndexedDbHandler.prototype = Object.create(DbHandler.prototype);

  /**
   * Get all entries from the database and put it in the downstream
   */
  IndexedDbHandler.prototype.getAllEntries = function(cb) {
    var _this = this;

    var store = IndexedDbHandler._db.transaction([_this._storeName])
      .objectStore(_this._storeName);

    // Cursor success
    var cursor = store.openCursor();
    cursor.onsuccess = function(e) {
      cursor = e.target.result;
      if (cursor) {
        var cursorItem = cursor.value;
        var newItem = harmonizedData._createStreamItem(cursorItem,
          _this._keys);

        // Set the action depending on the deletion status
        if (newItem.meta.deleted) {
          newItem.meta.action = 'delete';
        } else {
          newItem.meta.action = 'save';
        }

        _this.downStream.onNext(newItem);
        cursor.continue();
      } else {
        // No item left, so call the callback!
        if (_.isFunction(cb)) {
          cb();
        }
      }
    };

    // Error handling
    cursor.onerror = _this.downStream.onError;
  };

  IndexedDbHandler.prototype.getEntry = function(key) {
    var _this = this;

    var transaction = IndexedDbHandler._db.transaction([_this._storeName]);
    var objectStore = transaction.objectStore(_this._storeName);
    var request = objectStore.get(key);

    request.onerror = _this.downStream.onError

    request.onsuccess = function() {
      if (!_.isUndefined(request.result)) {
        var newItem = harmonizedData._createStreamItem(request.result,
          _this._keys);
        _this.downStream.onNext(newItem);
      } else {
        _this.downStream.onError(new Error('Item with id ' + key + ' not found in database'));
      }

    };
  };

  /**
   * Write an item to the database
   * @param  {Object} item  Item that has to be written to the database
   * @return {Rx.Subject}   The stream where the returned item will be put in
   */
  IndexedDbHandler.prototype.put = function(item) {
    var dbHandler = IndexedDbHandler;
    var putStream = new Rx.Subject();

    // Don't do anything if the database connection is not established
    if (!dbHandler._db) {
      putStream.onError(new Error('no database connection established'));
      putStream.onCompleted();
      return putStream;
    }

    var _this = this;
    var i = 0;

    function putNext(e) {
      if (!!e) {
        // Data was received
        if (_.isUndefined(item[i].meta)) {
          item[i].meta = {};
        }

        item[i].meta.storeId = e.target.result;
        putStream.onNext(item[i]);
        i++;
      }

      if (i < item.length) {
        // Save and do next stuff
        var dbItem = _this._createDbItem(item[i]);
        var put = objectStore.put(dbItem);
        put.onsuccess = putNext;
        put.onerror = putError;
      } else {
        putStream.onCompleted();
      }
    }

    function putError() {
      i++;
      putNext();
    }

    // Create singleton array with data, if data is no array
    if (!_.isArray(item)) {
      item = [item];
    }

    var transaction = dbHandler._db.transaction([_this._storeName],
      'readwrite');
    transaction.onerror = function(e) {
      putStream.onError(new Error(e.target.error.name));
    };

    var objectStore = transaction.objectStore(_this._storeName);
    putNext();

    return putStream;
  };

  /**
   * Remove an item from the database
   * @param  {Object} item  Item to remove from the database. Needs serverID!
   * @return {Rx.Subject}   The stream where the removed item will be put in
   */
  IndexedDbHandler.prototype.remove = function(item) {
    var dbHandler = IndexedDbHandler;
    var _this = this;

    var removeStream = new Rx.Subject();

    // Don't do anything if the database connection is not established
    if (!dbHandler._db) {
      removeStream.onError(new Error('no database connection established'));
      removeStream.onCompleted();
      return removeStream;
    }

    var request = dbHandler._db.transaction([_this._storeName],
        'readwrite')
      .objectStore(_this._storeName).delete(item.meta.storeId);

    request.onsuccess = function() {
      item.meta.deleted = true;
      item.meta.action = 'deletePermanently';
      removeStream.onNext(item);
      removeStream.onCompleted();
    };

    request.onerror = removeStream.onError;

    return removeStream;
  };

  return IndexedDbHandler;
});



define('DbHandler/WebSqlHandler', ['DbHandler/BaseHandler'], function(
  DbHandler) {

  var WebSqlHandler = function WebSqlhandler(name, options) {};

  return WebSqlHandler;
});


define('dbHandlerFactory', ['harmonizedData', 'DbHandler/IndexedDbHandler',
  'DbHandler/WebSqlHandler'
], function(harmonizedData, IndexedDbHandler, WebSqlHandler) {

  /**
   * Initiates the dbHandlerFactory
   */
  var dbHandlerFactory = function dbHandlerFactory() {
    // Check for db support
    if (dbHandlerFactory._getIndexedDb()) {
      // Set IndexedDB if supported
      dbHandlerFactory._DbHandler = IndexedDbHandler;
    } else if (dbHandlerFactory._getWebSql()) {
      // Set WebSQL if supported
      dbHandlerFactory._DbHandler = WebSqlHandler;
    } else {
      // Set no database if no DB support
      dbHandlerFactory._DbHandler = undefined;
    }
  };

  /**
   * Creates a database handler for a specified resource
   * @param  {string} name                        Name of the resource
   * @param  {Object} options                     Options for the db handler
   * @return {IndexedDbHandler|WebSqlHandler}  created db handler or undefined (if no db support)
   */
  dbHandlerFactory.createDbHandler = function(name, keys) {
    if (!!dbHandlerFactory._DbHandler) {
      return new dbHandlerFactory._DbHandler(name, keys);
    } else {
      return undefined;
    }
  };

  /* istanbul ignore next */

  /**
   * Get the indexedDb object if browser implementation or IndexedDbHandler exist
   * @return {IDBFactory} The indexedDB implementation
   */
  dbHandlerFactory._getIndexedDb = function getIndexedDb() {
    if (window.indexedDB && _.isFunction(IndexedDbHandler)) {
      return window.indexedDB;
    }

    return null;
  };

  /* istanbul ignore next */

  /**
   * Get the Web SQL object if browser implementation or WebSqlHandler exist
   * @return {Function} The openDatabase function for WebSQL
   */
  dbHandlerFactory._getWebSql = function getWebSql() {
    if (window.openDatabase && _.isFunction(WebSqlHandler)) {
      return window.openDatabase;
    }

    return null;
  };

  // initialize one time
  dbHandlerFactory();

  return dbHandlerFactory;
});



define('SubModel', ['harmonizedData', 'ServerHandler', 'dbHandlerFactory',
  'modelHandler', 'lodash'
], function(harmonizedData, ServerHandler, dbHandlerFactory, modelHandler,
  _) {

  /**
   * Sets an option to its default value if undefined in custom options
   * @param {Object} options     The options object
   * @param {string} item        The key to the item of the options object
   * @param {Object} modelSchema The schema of the model that contains the
   *                             default values
   */
  function setOptionIfUndefined(options, item, modelSchema) {
    if (_.isUndefined(options[item])) {
      options[item] = modelSchema[item];
    }
  }

  /**
   * Constructor for SubModel
   * @param {string} modelName      The name of the sub model
   * @param {ModelItem} parentItem  The item the sub model belongs to
   * @param {Object} options        The options for the sub model (overwrites default)
   */
  var SubModel = function SubModel(modelName, parentItem, options) {
    var _this = this;

    _this._modelName = modelName;
    _this._options = options || {};

    _this.getParent = function() {
      return parentItem;
    };

    _this._gotServerData = false;
    _this._gotDbData = false;

    // Get the model of the parent item
    var parentItemModel = parentItem.getModel();

    // Set the options defined in the model schema if not manually overwritten
    var modelSchema = parentItemModel._subModelsSchema[modelName];
    var thisOptions = _this._options;
    setOptionIfUndefined(thisOptions, 'route', modelSchema);
    setOptionIfUndefined(thisOptions, 'keys', modelSchema);
    setOptionIfUndefined(thisOptions, 'storeName', modelSchema);

    // Set the model from the sourceModel stated in the sub model schema
    _this._model = modelHandler.getModel(modelSchema.sourceModel);

    // TODO check if should be moved to modelSchema
    if (_.isUndefined(thisOptions.serverOptions)) {
      thisOptions.serverOptions = {};
    }

    // Set server- and database handlers
    _this._serverHandler = new ServerHandler(_this.getFullRoute(),
      thisOptions.serverOptions);
    _this._dbHandler = dbHandlerFactory.createDbHandler(thisOptions.storeName,
      thisOptions.keys);

    _this._serverHandler.downStream.subscribe(function(item) {
      var serverId = item.meta.serverId;
      var action = item.meta.action;
      if (_.isUndefined(serverId)) {
        // Server sends complete list of items
        _this._serverItems = item.data;
        _this._gotServerData = true;

        // Only update database if db data already arrived
        if (_this._gotDbData) {
          _this._updateDb();
        }

        _this._sendAllItemsDownstream();
      } else if (action === 'save') {
        // Server sends only one item
        _this._serverItems.push(serverId);
        _this._storeItems.splice(_this._storeItems.indexOf(item.meta.storeId),
          1);
        _this._updateDb();
        _this._sendItemDownstream('server', serverId);
      } else if (action === 'deletePermanently') {
        var serverItemPos = _this._serverItems.indexOf(serverId);
        var deletedItemPos = _this._deletedItems.indexOf(serverId);
        _this._serverItems.splice(serverItemPos, 1);
        _this._deletedItems.splice(deletedItemPos, 1);
        _this._updateDb();
      }
    });

    // Public downstream
    _this.downStream = new Rx.Subject();

    _this._dbHandler.downStream.subscribe(function(item) {
      // Don't update server items because server has updated it already
      if (!_this._gotServerData) {
        _this._serverItems = item.data.serverItems;
      }

      _this._storeItems = item.data.storeItems;
      _this._deletedItems = item.data.deletedItems;

      _this._gotDbData = true;

      // Update database entry if item was received by the server
      if (_this._gotServerData) {
        _this._updateDb();
      }

      _this._sendAllItemsDownstream();
    });

    // Filter the items from the model downstream
    _this._filterModelStream = _this._model.downStream.filter(function(item) {
      var serverItems = _this._serverItems;
      var storeItems = _this._storeItems;

      var serverId = item.meta.serverId;
      var storeId = item.meta.storeId;

      // Item is included in the submodel by the server id
      if (!_.isUndefined(serverId) && _.includes(serverItems,
          serverId)) {
        return true;
      }

      // Item is included in the submodel by the store id
      if (!_.isUndefined(storeId) && _.includes(storeItems, storeId)) {
        // Server ID is now available, so add to server
        if (!_.isUndefined(serverId)) {
          _this._addToServer(serverId, storeId);
        }

        return true;
      }

      return false;
    });

    // Do something with the filtered items
    _this._filterModelStream.subscribe(_this.downStream);

    // Public upstream
    _this.upStream = new Rx.Subject();

    _this.upStream.subscribe(function(item) {

      var serverItems = _this._serverItems;
      var storeItems = _this._storeItems;

      var serverId = item.meta.serverId;
      var storeId = item.meta.storeId;
      var action = item.meta.action;

      switch (action) {
        case 'save':
          if (!_.isUndefined(serverId) && !_.includes(serverItems,
              serverId)) {
            _this._addToServer(serverId, storeId);
          } else if (_.isUndefined(serverId) && !_.isUndefined(
              storeId) && !_.includes(storeItems, storeId)) {
            _this._storeItems.push(storeId);
            _this._updateDb();
          }

          break;
        case 'delete':
          if (!_.isUndefined(serverId) && _.includes(serverItems,
              serverId)) {
            _this._removeFromServer(serverId);
          } else if (!_.isUndefined(storeId) && _.includes(storeItems,
              storeId)) {
            // Remove from store items list
            _this._storeItems.splice(storeItems.indexOf(storeId), 1);
            _this._updateDb();
          }

          break;
      }
    });

    _this._serverItems = [];
    _this._storeItems = [];
    _this._deletedItems = [];

    // Initially get data
    _this._dbHandler.getEntry(parentItem.meta._storeId);
    _this._serverHandler.fetch();
  };

  /**
   * Updates the database with the current items of the sub model
   */
  SubModel.prototype._updateDb = function() {
    this._dbHandler.upStream.onNext({
      meta: {
        storeId: this.getParent().meta.storeId
      },
      data: {
        storeItems: _.cloneDeep(this._storeItems),
        serverItems: _.cloneDeep(this._serverItems),
        deletedItems: _.cloneDeep(this._deletedItems)
      }
    });
  };

  /**
   * Sends the items of a certain type (server/store) to the downstream
   * @param  {string} idType  The type of the data ('server' or 'store')
   * @param  {*} id           The server or store id
   */
  SubModel.prototype._sendItemDownstream = function(idType, id) {
    var modelItem = this._model['_' + idType + 'IdHash'][id];
    if (!_.isUndefined(modelItem)) {
      this.downStream.onNext({
        meta: _.cloneDeep(modelItem.meta),
        data: _.cloneDeep(modelItem.data)
      });
    }
  };

  /**
   * Sends all items of the sub model to the downstream
   */
  SubModel.prototype._sendAllItemsDownstream = function() {
    var i;
    var modelItem;

    // Get the server items that are not marked to be deleted
    var serverItems = _.difference(this._serverItems, this._deletedItems);

    // Add server items to downstream
    for (i = 0; i < serverItems.length; i++) {
      this._sendItemDownstream('server', serverItems[i]);
    }

    // Add store items to downstream
    for (i = 0; i < this._storeItems.length; i++) {
      this._sendItemDownstream('store', serverItems[i]);
    }
  }

  /**
   * Adds an item to the server to add it the sub resource
   * @param {*} serverId      The server id of the item to add
   * @param {number} storeId  The store id of the item to add
   */
  SubModel.prototype._addToServer = function(serverId, storeId) {
    var storeItems = this._storeItems;

    if (!_.isUndefined(storeId) && !_.includes(storeItems, storeId)) {
      storeItems.push(storeId);
    }

    this._serverHandler.upStream.onNext({
      meta: {
        storeId: storeId,
        serverId: serverId,
        action: 'save'
      }
    });
  };

  /**
   * Removes an item from the server sub resource
   * @param  {*} serverId The server id of the item to remove from the resource
   */
  SubModel.prototype._removeFromServer = function(serverId) {
    var storeItems = this._storeItems;

    this._deletedItems.push(serverId);
    this._serverHandler.upStream.onNext({
      meta: {
        serverId: serverId,
        action: 'delete'
      }
    });

    this._updateDb();
  };

  /**
   * Gets the full resource path to communicate to the server
   * @return {Array} The different segments of the path (URL). The first segmen
   *                 is the base URL to the server
   */
  SubModel.prototype.getFullRoute = function() {
    return this.getParent().getFullRoute().concat([this._options.route]);
  };

  /**
   * Gets the next runtime id from the connected model
   * @return {number} The next unused and unique runtime DI
   */
  SubModel.prototype.getNextRuntimeId = function() {
    return this._model.getNextRuntimeId();
  };

  /**
   * Gets a single item from the submodel
   * @param  {number} rtId The runtime id of the item to get
   * @return {ModelItem}   The requested item. If not available in model or
   *                           or in the sub model, 'undefined' is returned
   */
  SubModel.prototype.getItem = function(rtId) {
    var item = this._model.getItem(rtId);
    if (_.includes(this._serverItems, item.meta.serverId) || _.includes(
        this._storeItems, item.meta.storeId)) {
      return item;
    } else {
      return undefined;
    }
  }

  /**
   * Gets all items of the sub model
   * @param  {Function} itemCb Function that has one of the ModelItems as the
   *                           parameter. Is invoked for every ModelItem in
   *                           the sub model
   */
  SubModel.prototype.getItems = function(itemCb) {
    var modelItem;
    var i;
    for (i = 0; i < this._serverItems.length; i++) {
      modelItem = this._model._serverIdHash[this._serverItems[i]];
      if (!_.isUndefined(modelItem)) {
        itemCb(modelItem);
      }
    }

    for (i = 0; i < this._storeItems.length; i++) {
      modelItem = this._model._storeIdHash[this._storeItems[i]];
      if (!_.isUndefined(modelItem)) {
        itemCb(modelItem);
      }
    }
  }

  return SubModel;

});



define('ModelItem', ['SubModel', 'rx', 'lodash'], function(SubModel, Rx, _) {

  /**
   * Creates the action filter stream and subscribes the callback for the action
   * to that stream
   * @param  {Rx.Observable}  stream  The stream where the data comes in
   * @param  {string}         action  The action to filter
   * @param  {Function}       cb      The function to call when the action occurs
   */
  function createActionFilter(modelItem, stream, action) {
    var filter = stream.filter(function(item) {
      return item.meta.action === action;
    });

    modelItem['_' + action + 'StreamSub'] = filter.subscribe(function(item) {
      modelItem[action](item);
    });
  }

  /**
   * The ModelItem constructor
   * @param {Model} parentModel The model the item belongs to
   * @param {Object} data       The data of the item
   * @param {Object} meta       The metadata of the item (e.g. IDs, deletedFlag)
   */
  var ModelItem = function ModelItem(parentModel, data, meta) {
    var _this = this;
    _this.data = data || {};
    _this.meta = meta || {};
    _this.subData = {};

    // Go through all described submodels for this item
    for (var subModel in parentModel._subModelsSchema) {
      if (parentModel._subModelsSchema.hasOwnProperty(subModel)) {
        _this.subData[subModel] = new SubModel(subModel, _this);
      }
    }

    // Set the runtime ID
    // If runtime ID is set in metadata, let it stay that way.
    // If runtime ID is not set in metadata, get a new runtime ID from the model
    _this.meta.rtId = _this.meta.rtId || parentModel.getNextRuntimeId();

    var filterThisItem = function(item) {
      return item.meta.rtId === _this.meta.rtId && !_this.meta.deleted;
    };

    // filtered streams to the streams of the model
    _this._dbDownStream = parentModel._dbDownStream.filter(filterThisItem);
    _this._updateStreams = Rx.Observable.merge(parentModel.upStream,
      parentModel._existingItemDownStream).filter(filterThisItem);

    /**
     * Gets the model of the item. This is needed as a function to prevent
     * circular dependency
     * @return {Model} The model of the item
     */
    _this.getModel = function() {
      return parentModel;
    }

    // Add item to the runtime ID hash
    parentModel._rtIdHash[_this.meta.rtId] = _this;

    // Add item to the server ID hash if server ID is available
    if (!_.isUndefined(_this.meta.serverId)) {
      parentModel._serverIdHash[_this.meta.serverId] = _this;
    }

    // Add item to the store ID hash if store ID is available
    if (!_.isUndefined(_this.meta.storeId)) {
      parentModel._storeIdHash[_this.meta.storeId] = _this;
    }

    // Delete permanently when item was deleted permanently in database
    createActionFilter(_this, _this._dbDownStream, 'deletePermanently');

    // Filter update streams for this item to be saved
    createActionFilter(_this, _this._updateStreams, 'save');

    // Filter update streams for this item to be marked as deleted
    createActionFilter(_this, _this._updateStreams, 'delete');

    // Initially send the item back downstream, so all associated views get
    // informed of the new item
    var initialSendMeta = _.cloneDeep(_this.meta);
    initialSendMeta.action = 'save';
    parentModel.downStream.onNext({
      meta: initialSendMeta,
      data: _.cloneDeep(_this.data)
    });

    return _this;
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
   */
  ModelItem.prototype.save = function(item) {
    this.meta = _.cloneDeep(item.meta);
    delete this.meta.action;
    this.data = _.cloneDeep(item.data);
    return item;
  };

  /**
   * Mark the model item as deleted
   * @param  {Object} item  The stream item
   */
  ModelItem.prototype.delete = function(item) {
    this.meta.deleted = true;
  };

  /**
   * Delete the model item permanently from the model
   * @param  {Object} item  The stream item
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

    // Unsubscribe all streams
    this._deletePermanentlyStreamSub.dispose();
    this._deleteStreamSub.dispose();
    this._saveStreamSub.dispose();
  };

  return ModelItem;
});



define('Model', ['harmonizedData', 'ModelItem', 'ServerHandler', 'dbHandlerFactory', 'lodash', ],
  function(harmonizedData, ModelItem, ServerHandler, dbHandlerFactory, _) {

    /**
     * Sets an option to its default value if undefined in custom options
     * @param {Object} options     The options object
     * @param {string} item        The key to the item of the options object
     * @param {Object} modelSchema The schema of the model that contains the
     *                             default values
     */
    function setOptionIfUndefined(options, item, modelSchema) {
      if (_.isUndefined(options[item])) {
        options[item] = modelSchema[item];
      }
    }

    /**
     * The map function to synchronize the metadata of the ModelItem with the
     * metadata of the stream item from the database or server downstream
     * @param  {Model} model  The Model where the metadata will be changed
     * @return {Object}       The item with the updated metadata
     */
    function downStreamMap(model, source) {
      return function(item) {
        var knownItem = model._rtIdHash[item.meta.rtId] || model._serverIdHash[
          item.meta.serverId] || model._storeIdHash[item.meta.storeId];
        if (!_.isUndefined(knownItem)) {
          // Sync known item metadata with item metadata
          knownItem.meta.rtId = knownItem.meta.rtId || item.meta.rtId;
          knownItem.meta.serverId = knownItem.meta.serverId || item.meta.serverId;
          knownItem.meta.storeId = knownItem.meta.storeId || item.meta.storeId;
          knownItem.meta.deleted = item.meta.deleted || knownItem.meta.deleted;

          // Add known data to item
          var itemAction = item.meta.action;
          _.extend(item.meta, knownItem.meta);
          item.meta.action = itemAction;

          // Add to server ID hash if server ID is known and item not in hash
          if (!_.isUndefined(item.meta.serverId) && _.isUndefined(model
              ._serverIdHash[item.meta.serverId])) {
            model._serverIdHash[item.meta.serverId] = knownItem;
          }

          // Add to store ID hash if store ID is known and item not in hash
          if (!_.isUndefined(item.meta.storeId) && _.isUndefined(model._storeIdHash[
              item.meta.storeId])) {
            model._storeIdHash[item.meta.storeId] = knownItem;
          }

        }

        return item;
      };
    };

    /**
     * The constructor of the Model
     * @param {string} modelName Name of the model
     * @param {Object} [options]   The options to overwrite the default model options
     */
    var Model = function Model(modelName, options) {
      var _this = this;

      _this._modelName = modelName;
      _this._options = options || {};

      // Set the options defined in the model schema if not manually overwritten
      var modelSchema = harmonizedData._modelSchema[modelName];
      var thisOptions = _this._options;
      for (var optKey in modelSchema) {
        if (modelSchema.hasOwnProperty(optKey)) {
          setOptionIfUndefined(thisOptions, optKey, modelSchema);
        }
      }

      _this._subModelsSchema = modelSchema.subModels;

      // Set server- and database handlers
      _this._serverHandler = new ServerHandler(_this.getFullRoute(), thisOptions.keys, thisOptions.serverOptions);

      // Build db handler if data should be saved locally or build the db handler
      // stub, to fake a database call. This is simpler to write extra logic for
      // the case, that no data will be saved locally.
      if (thisOptions.saveLocally) {
        _this._buildDbHandler();
      } else {
        _this._buildDbHandlerStub();
      }

      // The downstreams with map function to add not added hash ids
      _this._serverDownStream = _this._serverHandler.downStream.map(downStreamMap(_this, 'server'));
      _this._dbDownStream = _this._dbHandler.downStream.map(downStreamMap(_this, 'database'));

      // Add already available items to the database
      _this._serverDownStream.subscribe(_this._dbHandler.upStream);

      // Public upstream
      _this.upStream = new Rx.Subject();

      // Create a stream for data received from the upstream not yet in the model
      _this.upStream.filter(function(item) {
        return _.isUndefined(_this._rtIdHash[item.meta.rtId]);
      }).subscribe(function(item) {
        new ModelItem(_this, item.data, item.meta);
      });

      // public upstream => serverHandler upstream & dbHandler upstream
      _this.upStream.subscribe(_this._serverHandler.upStream);
      _this.upStream.subscribe(_this._dbHandler.upStream);

      // Public downstream
      _this.downStream = new Rx.Subject();

      // Internal downstream merged from the database and server downstreams
      _this._downStream = Rx.Observable.merge(_this._serverDownStream,
        _this._dbDownStream);

      // Only add already existing model items to the public downstream
      _this._existingItemDownStream = _this._downStream.filter(function(item) {
        return !_.isUndefined(item.meta.rtId);
      });

      _this._existingItemDownStream.subscribe(_this.downStream);

      // Create a stream for data received from the downstream not yet in the model
      _this._downStream.filter(function(item) {
        return _.isUndefined(item.meta.rtId);
      }).subscribe(function(item) {
        _this._createNewItem(item);
      });

      // Hashs for ModelItems
      _this._rtIdHash = {};
      _this._serverIdHash = {};
      _this._storeIdHash = {};

      _this._nextRuntimeId = 1;

      // Get data from db and server

      return _this;
    };

    /**
     * Creates a new item
     * @param  {Object} item The stream item with metadata and data
     */
    Model.prototype._createNewItem = function(item) {
      var newModel = new ModelItem(this, item.data, item.meta);
      item.meta = _.cloneDeep(newModel.meta);
      delete item.meta.action;
    };

    /**
     * Builds the database handler (will only be called in the constructor)
     */
    Model.prototype._buildDbHandler = function() {
      var _this = this;
      _this._dbHandler = dbHandlerFactory.createDbHandler(_this._options.storeName, _this._options.keys);

      // Listen to the database to be connected, to get all entries
      dbHandlerFactory._DbHandler._connectionStream.subscribe(function(state) {
        if (state === true) {
          _this._dbHandler.getAllEntries(function() {
            _this._dbReadyCb();
          });
        }
      });

      // Get all entries, if the database is already connected
      if (dbHandlerFactory._DbHandler._db !== null) {
        _this._dbHandler.getAllEntries(function() {
          _this._dbReadyCb();
        });
      }
    };

    /**
     * Builds a stub for the database handler, because there will be no saving into
     * the local database.
     */
    Model.prototype._buildDbHandlerStub = function() {
      this._dbHandler = {
        downStream: new Rx.Subject(),
        upStream: new Rx.Subject(),
      };

      // Subscribe the downstream directly to the upstream
      this._dbHandler.upStream.map(function(item) {
        // Set action to "deletePermanently" if action was delete
        // to permanently delete item in Model
        item.meta.action = (item.meta.action === 'delete') ? 'deletePermanently' : item.meta.action;
        return item;
      }).subscribe(this._dbHandler.downStream);

      // No DB, so db is immediately ready ;)
      this._dbReadyCb();
    };

    /**
     * Get all items of the model
     * @return {Array} List of all ModelItems
     */
    Model.prototype.getItems = function(itemCb) {
      var hash = this._rtIdHash;
      for (var item in hash) {
        itemCb(hash[item]);
      }
    };

    /**
     * Gets a single item of the model
     * @param  {number} rtId  Runtime ID of the item to get
     * @return {ModelItem}    The ModelItem with the selected runtime ID
     */
    Model.prototype.getItem = function(rtId) {
      return this._rtIdHash[rtId];
    };

    /**
     * This function will be called after the database query got all items!
     * This is useful to only ask for the server entries if the database
     * items are ready.
     */
    Model.prototype._dbReadyCb = function() {
      var _this = this;
      if (harmonizedData._config.fetchAtStart) {
        _this.getFromServer(function() {
          _this.pushChanges();
        });
      }
    };

    Model.prototype.pushChanges = function() {
      // Push the items to the server that have to be saved
      for (var storeId in this._storeIdHash) {
        if (this._storeIdHash.hasOwnProperty(storeId)) {
          var currentItem = this._storeIdHash[storeId];
          var itemMeta = _.cloneDeep(currentItem.meta);
          var itemData = _.cloneDeep(currentItem.data);

          if (_.isUndefined(currentItem.meta.serverId)) {

            delete itemMeta.serverId;
            itemMeta.action = 'save';

            this._serverHandler.upStream.onNext({
              meta: itemMeta,
              data: itemData,
            });
          } else if (currentItem.meta.deleted) {
            itemMeta.action = 'delete';
            this._serverHandler.upStream.onNext({
              meta: itemMeta,
              data: itemData,
            });
          }
        }
      }
    };

    /**
     * Request a fetch of data from the server. The requested data will be pushed
     * to the ServerHandler downstream
     */
    Model.prototype.getFromServer = function(cb) {
      this._serverHandler.fetch(cb);
    };

    /**
     * Checks for items that are deleted on the server and removes them locally.
     */
    Model.prototype.checkForDeletedItems = function() {
      var _this = this;

      // TODO make params configurable
      this._serverHandler.sendHttpRequest({
        params: {
          view: 'keys',
        },
      }).then(function(items) {
        // Get to know the locally known server ids
        var localServerIds = [];
        for (var serverId in _this._serverIdHash) {
          if (_this._serverIdHash.hasOwnProperty(serverId)) {
            localServerIds.push(parseInt(serverId));
          }
        }

        var deletedItemIds = _.difference(localServerIds, items);

        var keys = _this._options.keys;
        for (var i = 0; i < deletedItemIds.length; i++) {

          // Create the stream item
          var currentItem = _this._serverIdHash[deletedItemIds[i]];
          var streamItem = {
            meta: _.cloneDeep(currentItem.meta),
            data: _.cloneDeep(currentItem.data),
          };
          streamItem.meta.action = 'deletePermanently';

          // Send to the streams
          _this.downStream.onNext(streamItem);
          _this._dbHandler.upStream.onNext(streamItem);
        }
      });
    };

    /**
     * Gets the next runtime ID for a new item
     * @return {number} a new model-unique runtime ID
     */
    Model.prototype.getNextRuntimeId = function() {
      return this._nextRuntimeId++;
    };

    /**
     * Gets the full URL to the resource of the server
     * @return {String} URL to the resource of the server
     */
    Model.prototype.getFullRoute = function() {
      return [this._options.baseUrl, this._options.route];
    };

    return Model;

  });



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
          currentSchema = _.cloneDeep(harmonizedData._modelSchema[modelName]);
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

      _this._streams.saveDownStream = viewCollection.downStream.filter(function(item) {
        return item.meta.rtId === _this._meta.rtId && item.meta.action === 'save';
      });

      // Subscription for the save downstream
      _this._streams.saveDownStreamSub = _this._streams.saveDownStream.subscribe(function(item) {
        _this._save(item.data, item.meta);
      });

      // Subscription for the delete downstream
      _this._streams.deleteDownStream = viewCollection.downStream.filter(function(item) {
        return item.meta.rtId === _this._meta.rtId && (item.meta.action === 'delete' ||
          item.meta.action === 'deletePermanently');
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

      return this._returnActionPromise('functionDownStream', transactionId);
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
            deferred.reject(error);
            successSub.dispose();
            errorSub.dispose();
          });
        } else {
          deferred.reject(new Error('Item as no runtime id'));
        }

        return deferred.promise;
      }
    };

    return ViewItem;
  });



define('ViewCollection', ['ViewItem', 'rx', 'lodash'], function(ViewItem, Rx, _) {

  /**
   * The ViewCollection constructor
   * @param {Model} model         The model of the view collection
   * @param {Function} mapDownFn  Function to change data to the view format
   * @param {Function} mapUpFn    Function to change data to the model format
   */
  var ViewCollection = function ViewCollection(model, mapDownFn, mapUpFn) {
    // Make the collection act as an array
    var collection = Object.create(Array.prototype);
    collection = Array.apply(collection);

    collection._model = model;
    collection._items = {};

    // Set the map functions to the ones in the parameter or to default
    collection._mapDownFn = mapDownFn || function(item) {
      return item;
    };

    collection._mapUpFn = mapUpFn || function(item) {
      return item;
    };

    // map the downstream to show the data as the view needs it
    collection.downStream = model.downStream.filter(function(item) {
      // Don't let returning function in the downstream
      return item.meta.action !== 'function';
    }).map(function(item) {
      var newItem = _.cloneDeep(item);
      newItem.data = collection._mapDownFn(newItem.data);
      return newItem;
    });

    // Filters items that are not in the view model yet
    collection.downStream.filter(function(item) {
      return _.isUndefined(collection._items[item.meta.rtId]) && !item.meta.deleted;
    }).subscribe(function(item) {
      var subData = collection._model._rtIdHash[item.meta.rtId].subData;
      new ViewItem(collection, item.data, item.meta, subData, true);
    });

    // map the upstream to transform the data to the model format
    collection.upStream = new Rx.Subject();
    collection.upStream.map(function(item) {
      var newItem = _.cloneDeep(item);
      newItem.data = collection._mapUpFn(newItem.data);
      return newItem;
    }).subscribe(model.upStream);

    collection.functionReturnStream = model.downStream.filter(function(item) {
      return item.meta.action === 'function';
    });

    // Inject all items of the ViewController prototype to the created instance
    ViewCollection.injectClassMethods(collection);

    // Get all model items
    model.getItems(function(item) {
      new ViewItem(collection, item.data, item.meta, null, true);
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
      var data = this._mapDownFn(_.cloneDeep(itemToAdd.data));
      newViewItem = new ViewItem(this, data, _.cloneDeep(itemToAdd.meta), itemToAdd.subData, true);
    }

    return newViewItem;
  };

  /**
   * Gets data from the server
   */
  ViewCollection.prototype.fetch = function() {
    this._model.getFromServer();
  }

  /**
   * Creates a new view item with reference to the collection
   * @return {ViewItem} The created view item
   */
  ViewCollection.prototype.new = function(addToCollection) {
    var add = addToCollection || false;
    return new ViewItem(this, {}, {}, null, add);
  };

  ViewCollection.prototype.callFn = function(name, args) {
    this.upStream.onNext({
      meta: {
        action: 'function'
      },
      data: {
        fnName: name,
        fnArgs: args
      }
    });
  };

  return ViewCollection;
});

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
          _.extend(harmonizedData._config, config);
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
       */
      getFromServer: function() {
        modelHandler.getFromServer();
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

      errorStream: ServerHandler.errorStream

    };

    return harmonized;

  });


require(["harmonized"]);
  define('lodash', function() {
    return _;
  });
  define('rx', function() {
    return Rx;
  });
  window.harmonized = require('harmonized');
}));
