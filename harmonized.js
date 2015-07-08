'use strict';

var Harmonized = {}; // jshint ignore:line

Harmonized._config = {
  defaultKeys: {
    serverKey: 'id',
    storeKey: '_id'
  },
  baseUrl: null,
  dbName: 'harmonizedDb',
  sendModifiedSince: false
};

Harmonized._resourceSchema = {};
Harmonized._httpFunction = function() {
  throw new Error('No http function was added');
};

Harmonized.dbVersion = 1;

Harmonized.setModelSchema = function setModelSchema(schema) {
  Harmonized._setModelSchema(schema);
  Harmonized._modelSchema = schema;
};

Harmonized.getModelSchema = function getModelSchema() {
  return Harmonized._modelSchema;
};

Harmonized._setModelSchema = function _setModelSchema(schema, storeNamePrefix) {
  var subModels;
  var currentModel;
  var keys;

  for (var item in schema) {
    currentModel = schema[item];
    if (!_.isObject(currentModel.keys)) {
      currentModel.keys = Harmonized._config.defaultKeys;
    } else {
      keys = currentModel.keys;

      if (_.isUndefined(keys.serverKey)) {
        keys.serverKey = Harmonized._config.defaultKeys.serverKey;
      }

      if (_.isUndefined(keys.storeKey)) {
        keys.storeKey = Harmonized._config.defaultKeys.storeKey;
      }
    }

    if (_.isUndefined(currentModel.storeName)) {
      if (!_.isString(storeNamePrefix)) {
        storeNamePrefix = '';
      }

      currentModel.storeName = storeNamePrefix + item;
    }

    subModels = currentModel.subModels;
    if (_.isObject(subModels)) {
      Harmonized._setModelSchema(subModels, currentModel.storeName + '_');
    }
  }
};

Harmonized.getDbSchema = function getDbSchema() {
  var output = {};

  Harmonized._getDbSchema(Harmonized._modelSchema, output);

  return output;
};

Harmonized._getDbSchema = function(modelSchema, output) {
  var currentModel;
  var subModels;

  for (var schemaItem in modelSchema) {
    currentModel = modelSchema[schemaItem];
    output[currentModel.storeName] = currentModel.keys;
    subModels = modelSchema[schemaItem].subModels;
    if (_.isObject(subModels)) {
      Harmonized._getDbSchema(subModels, output);
    }
  }
};

Harmonized._createStreamItem = function(inputItem, keys) {
  inputItem = _.clone(inputItem);
  var item = {
    meta: {
      storeId: inputItem[keys.storeKey],
      serverId: inputItem[keys.serverKey]
    }
  };

  // Remove the metadata from the actual data
  delete inputItem[keys.storeKey];
  delete inputItem[keys.serverKey];

  item.data = inputItem;

  return item;
};

'use strict';

Harmonized.getWebStorage = function() {
  return Harmonized._webStorage;
};

/* istanbul ignore next */
Harmonized._getLocalStorage = function() {
  return window.localStorage;
};

/* istanbul ignore next */
Harmonized._getSessionStorage = function() {
  return window.sessionStorage;
};

Harmonized._webStorage = Harmonized._getSessionStorage();

Harmonized.setWebStorage = function(storage, doClear) {
  if (doClear) {
    Harmonized._webStorage.clear();
  }

  switch (storage) {
    case 'session':
      Harmonized._webStorage = Harmonized._getSessionStorage();
      break;
    case 'local':
      Harmonized._webStorage = Harmonized._getLocalStorage();
      break;
    default:
      Harmonized._webStorage = Harmonized._getSessionStorage();
  }
};

'use strict';

Harmonized.DbHandler = function DbHandler(dbHandler, storeName, keys) {
  this._storeName = storeName;
  this._keys = keys;

  // Public streams
  this.downstream = new Rx.Subject();
  this.upstream = new Rx.Subject();

  // Internal pausable upstream
  this._upstream = this.upstream.pausableBuffered(dbHandler._connectionStream);

  // Directly connect to the server if necessary
  if (!dbHandler._db && dbHandler._isConnecting === false) {
    dbHandler._connectionStream.onNext(false);
    dbHandler.connect();
  }

  // Save upstream
  this._saveUpstream = this._upstream.filter(function(item) {
    return item.meta.action === 'save';
  });

  this._saveDownstream = this._saveUpstream.map(this.put);
  this._saveSubscribe = this._saveDownstream.subscribe(this.downstream);

  // Delete upstream
  this._deleteUpstream = this._upstream.filter(function(item) {
    return item.meta.action === 'delete';
  });

  this._deleteDownstream = this._deleteUpstream.map(this.remove);
  this._deleteSubscribe = this._deleteDownstream.subscribe(this.downstream);

  // Initially get the metadata
  this._metaStorageName = 'harmonizedMeta_' + this._storeName;
  this._metadata = Harmonized.getWebStorage().getItem(this._metaStorageName) || {};
};

Harmonized.DbHandler.prototype.getMetadata = function() {
  return this._metadata;
};

Harmonized.DbHandler.prototype.setMetadata = function(key, value) {
  this._metadata[key] = value;
  Harmonized.getWebStorage().setItem(this._metaStorageName, this._metadata);
};

Harmonized.DbHandler.prototype._createDbItem = function(item) {
  // Clone data and arrange it for db
  var putItem = _.clone(item.data);
  if (!_.isUndefined(item.meta) && !_.isUndefined(item.meta.storeId)) {
    putItem[this._keys.storeKey] = item.meta.storeId;
  }

  if (!_.isUndefined(item.meta) && !_.isUndefined(item.meta.serverId)) {
    putItem[this._keys.serverKey] = item.meta.serverId;
  }

  return putItem;
};

'use strict';

Harmonized.IndexedDbHandler = function IndexedDbHandler(storeName, keys) {
  this._handlerType = 'IndexedDB';
  Harmonized.DbHandler.call(this, Harmonized.IndexedDbHandler, storeName, keys);
};

// Connection stream to pause or resume the upstream
Harmonized.IndexedDbHandler._connectionStream = new Rx.Subject();

// Database Object
Harmonized.IndexedDbHandler._db = null;
Harmonized.IndexedDbHandler._isConnecting = false;

/* istanbul ignore next */
Harmonized.IndexedDbHandler.getDbReference = function() {
  return window.indexedDB;
};

Harmonized.IndexedDbHandler.connect = function() {
  var dbHandler = Harmonized.IndexedDbHandler;
  if (dbHandler._db !== null || dbHandler._isConnecting) {
    // DB connection is already established
    dbHandler._isConnecting = false;
    return;
  }

  dbHandler._isConnecting = true;
  var request = dbHandler.getDbReference().open('harmonizedDb',
    Harmonized.dbVersion);

  // Request success
  request.onsuccess = function() {
    dbHandler._db = request.result;
    dbHandler._isConnecting = false;
    dbHandler._connectionStream.onNext(true);
  };

  request.onerror = function(e) {
    dbHandler._connectionStream.onError(new Error(e.error.name));
    dbHandler._isConnecting = false;
  };

  // DB needs upgrade
  request.onupgradeneeded = function(e) {
    var db = e.result;
    var schema = Harmonized.getDbSchema();
    var currentStore;
    var i;

    // Remove all stores items
    for (i = db.objectStoreNames.length - 1; i >= 0; i--) {
      currentStore = db.objectStoreNames[i];
      db.deleteObjectStore(currentStore);
    }

    for (var store in schema) {
      currentStore = schema[store];
      var objectStore = db.createObjectStore(store, {
        keyPath: currentStore.storeId,
        autoIncrement: true
      });
      objectStore.createIndex('serverId', currentStore.serverId, {
        unique: true,
        multiEntry: false
      });
    }
  };

  return request;
};

Harmonized.IndexedDbHandler.closeConnection = function() {
  var dbHandler = Harmonized.IndexedDbHandler;
  var db = dbHandler._db;
  /* istanbul ignore else */
  if (db) {
    db.close();
    dbHandler._db = null;
    dbHandler._connectionStream.onNext(false);
  }
};

Harmonized.IndexedDbHandler.deleteDb = function() {
  Harmonized.IndexedDbHandler.closeConnection();
  return Harmonized.IndexedDbHandler.getDbReference().deleteDatabase(
    'harmonizedDb');
};

Harmonized.IndexedDbHandler.prototype = Object.create(Harmonized.
  DbHandler.prototype);

Harmonized.IndexedDbHandler.prototype.getAllEntries = function() {
  var _this = this;

  var store = Harmonized.IndexedDbHandler._db.transaction([_this._storeName])
    .objectStore(_this._storeName);

  // Cursor success
  var cursor = store.openCursor();
  cursor.onsuccess = function(e) {
    cursor = e.target.result;
    if (cursor) {
      var cursorItem = cursor.value;
      _this.downstream.onNext(Harmonized._createStreamItem(cursorItem,
        _this._keys));
      cursor.continue();
    }
  };

  // Error handling
  cursor.onerror = _this.downstream.onError;
};

Harmonized.IndexedDbHandler.prototype.put = function(item) {
  var dbHandler = Harmonized.IndexedDbHandler;
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

  var transaction = dbHandler._db.transaction([_this._storeName], 'readwrite');
  transaction.onerror = function(e) {
    putStream.onError(new Error(e.error.name));
  };

  var objectStore = transaction.objectStore(_this._storeName);
  putNext();

  return putStream;
};

Harmonized.IndexedDbHandler.prototype.remove = function(item) {
  var dbHandler = Harmonized.IndexedDbHandler;
  var _this = this;

  var removeStream = new Rx.Subject();

  // Don't do anything if the database connection is not established
  if (!dbHandler._db) {
    removeStream.onError(new Error('no database connection established'));
    removeStream.onCompleted();
    return removeStream;
  }

  var request = dbHandler._db.transaction([_this._storeName], 'readwrite')
    .objectStore(_this._storeName).delete(item.meta.storeId);

  request.onsuccess = function() {
    item.meta.deleted = true;
    removeStream.onNext(item);
    removeStream.onCompleted();
  };

  request.onerror = removeStream.onError;

  return removeStream;
};

'use strict';

Harmonized.WebSqlHandler = function WebSqlhandler(name, options) {

};

'use strict';

Harmonized.dbHandlerFactory = function dbHandlerFactory() {
  // Check for db support
  if (Harmonized.dbHandlerFactory._getIndexedDb()) {
    // Set IndexedDB if supported
    Harmonized.dbHandlerFactory._DbHandler = Harmonized.IndexedDbHandler;
  } else if (Harmonized.dbHandlerFactory._getWebSql()) {
    // Set WebSQL if supported
    Harmonized.dbHandlerFactory._DbHandler = Harmonized.WebSqlHandler;
  } else {
    // Set no database if no DB support
    Harmonized.dbHandlerFactory._DbHandler = undefined;
  }
};

Harmonized.dbHandlerFactory.createDbHandler = function(name, options) {
  if (!!Harmonized.dbHandlerFactory._DbHandler) {
    return new Harmonized.dbHandlerFactory._DbHandler(name, options);
  } else {
    return undefined;
  }
};

Harmonized.dbHandlerFactory._getDbStructure = function getDbStructure() {
  // TODO extract db structure from resource definition
  return {};
};

/* istanbul ignore next */
Harmonized.dbHandlerFactory._getIndexedDb = function getIndexedDb() {
  if (window.indexedDB && _.isFunction(Harmonized.IndexedDbHandler)) {
    return window.indexedDb;
  }

  return null;
};

/* istanbul ignore next */
Harmonized.dbHandlerFactory._getWebSql = function getWebSql() {
  if (window.openDatabase && _.isFunction(Harmonized.WebSqlHandler)) {
    return window.openDatabase;
  }

  return null;
};

'use strict';

Harmonized.ServerHandler = function(baseUrl, resourcePath, options) {
  var _this = this;

  this._baseUrl = baseUrl;
  this._resourcePath = resourcePath;
  this._options = options;

  // Public streams
  this.upStream = new Rx.Subject();
  this.upStream.subscribe(function(item) {
    if (!_this._connected) {
      _this._unpushedList[item.meta.rtId] = item;
    } else {
      _this._protocol.push(item, _this);
    }
  });

  this.downStream = new Rx.Subject();

  // Instance connection stream that gets input from
  // the global connection stream.
  this.connectionStream = new Rx.Subject();
  this.connectionStream.subscribe(function(state) {
    _this.setConnectionState(state);
  });

  Harmonized.ServerHandler.connectionStream.subscribe(this.connectionStream);

  // List of items that couldn't be pushed to the server (e.g. because of
  // missing connection or offline mode).
  // Key of the items is always the runtime ID, so they can be replaced by newer
  // versions.
  this._unpushedList = {};

  // TODO implement last modified
  this._lastModified = 0;

  // Connection stuff
  this._connectionStream = new Rx.Subject();
  this._connected = false;
  this._protocol = null;
  var useProtocol;
  if (options.protocol === 'websocket') {
    useProtocol = 'websocket';
  } else {
    useProtocol = 'http';
  }

  this._setProtocol(useProtocol);
};

Harmonized.ServerHandler.connectionStream = new Rx.Subject();

Harmonized.ServerHandler.prototype._setProtocol = function setProtocol(protocol) {
  var _this = this;
  var httpHandler = Harmonized.ServerHandler.httpHandler;
  var socketHandler = Harmonized.ServerHandler.socketHandler;

  function setTheProtocol(newProtocol) {
    if (_this._protocol !== null) {
      _this._protocol.disconnect();
    }

    _this._protocol = newProtocol;
    _this._protocol.connect();
  }

  if (protocol === 'http' && this._protocol !== httpHandler) {
    setTheProtocol(httpHandler);
  } else if (protocol === 'websocket' && this._protocol !== socketHandler) {
    setTheProtocol(socketHandler);
  }
};

Harmonized.ServerHandler.prototype.fetch = function fetch() {
  this._protocol.fetch();
};

Harmonized.ServerHandler.prototype.pushAll = function pushAll() {
  for (var item in this._unpushedList) {
    this.upStream.onNext(this._unpushedList[item]);
    delete this._unpushedList[item];
  }
};

Harmonized.ServerHandler.prototype.setConnectionState = function setConnectionState(state) {
  if (state) {
    this._connected = true;
    this.pushAll();
  } else {
    this._connected = false;
  }
};

Harmonized.ServerHandler.prototype._createServerItem = function createServerItem(item) {
  // Clone data and arrange it for db
  var serverItem = _.clone(item.data);

  if (!_.isUndefined(item.meta) && !_.isUndefined(item.meta.serverId)) {
    serverItem[this._options.serverKey] = item.meta.serverId;
  }

  return serverItem;
};

'use strict';

Harmonized.ServerHandler.httpHandler = {
  connect: function(serverHandler) {
    serverHandler.setConnectionState(true);
  },

  disconnect: function(serverHandler) {
    serverHandler.setConnectionState(false);
  },

  fetch: function(serverHandler) {
    var httpOptions = {};
    if (Harmonized._config.sendModifiedSince && serverHandler._lastModified != null) {
      httpOptions.headers = {
        'If-Modified-Since': serverHandler._lastModified
      };
    }

    httpOptions.url = serverHandler._baseUrl + serverHandler._resourcePath;
    httpOptions.method = 'GET';

    Harmonized._httpFunction(httpOptions);
  },

  push: function(item, serverHandler) {
    var httpOptions = {};

    if (_.isObject(serverHandler._options.params)) {
      httpOptions.params = serverHandler._options.params;
    }

    httpOptions.url = serverHandler._baseUrl + serverHandler._resourcePath;

    if (item.meta.action === 'delete') {
      httpOptions.method = 'DELETE';
      httpOptions.url = httpOptions.url + item.meta.serverId + '/';
    }

    if (item.meta.action === 'save') {
      httpOptions.data = item.data;
      if (_.isUndefined(item.meta.serverId)) {
        httpOptions.method = 'POST';
      } else {
        httpOptions.method = 'PUT';
        httpOptions.url = httpOptions.url + item.meta.serverId + '/';
      }
    }

    Harmonized._httpFunction(httpOptions).then(function(returnItem) {
      item.data = returnItem;
      serverHandler.downStream.onNext(item);
    }).catch(function(error) {
      serverHandler._unpushedList[item.meta.rtId] = item;
      serverHandler.downStream.onError(error);
    });
  }
};

Harmonized.ServerHandler.socketHandler = {
  connect: function(serverHandler) {
    // TODO implement http connect
    // Wire with streams
  },

  disconnect: function(serverHandler) {
    // TODO implement http disconnect
    // Remove connection with streams
  },

  fetch: function(serverHandler) {
    // TODO implement http fetch
    // fetch everything
  },

  push: function(item, serverHandler) {
    // TODO implement http push
    // push a single item to the serverHandler
  }
};


