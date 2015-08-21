'use strict';

define(['Squire', 'sinon', 'lodash', 'rx', 'rx.testing', 'harmonizedData'],
  function(Squire, sinon, _, Rx, RxTest, harmonizedData) {
    describe('Model', function() {

      var testModel;
      var expectedOptions;
      var injector;
      var scheduler;

      var dbHandlerUpstreamList = [];
      var serverHandlerUpstreamList = [];

      var dbHandlerUpstream;
      var dbHandlerDownstream;

      var serverHandlerUpstream;
      var serverHandlerDownstream;
      var returnedData;

      var fakeHttpFn = function(options) {
        var returnedPromise = {
          then: function(fn) {
            returnedPromise.thenFn = fn;
            return returnedPromise;
          },

          catch: function(fn) {
            returnedPromise.catchFn = fn;
            return returnedPromise;
          }
        };

        setTimeout(function() {
          if (_.isObject(options.params) && options.params
            .shouldFail === true) {
            returnedPromise.catchFn({
              status: 500
            });
          } else {
            returnedPromise.thenFn(returnedData);
          }
        }, 10);

        return returnedPromise;
      };

      var ModelItemMock = function ModelItemMock(model, data, meta) {
        this.getModel = function() {
          return model;
        };

        this.data = data || {};
        this.meta = meta || {};

        this.meta.rtId = this.meta.rtId || this.getModel().getNextRuntimeId();

        this.getModel()._rtIdHash[this.meta.rtId] = this;

        if (!_.isUndefined(this.meta.serverId)) {
          this.getModel()._serverIdHash[this.meta.serverId] = this;
        }

        if (!_.isUndefined(this.meta.storeId)) {
          this.getModel()._storeIdHash[this.meta.storeId] = this;
        }

      };

      var ServerHandlerMock = function ServerHandlerMock(baseUrl,
        route, options) {

        serverHandlerUpstream = new Rx.Subject();
        serverHandlerUpstream.subscribe(function(item) {
          serverHandlerUpstreamList.push(item);
        });

        serverHandlerDownstream = new Rx.Subject();

        this._baseUrl = baseUrl;
        this._route = route;
        this._options = options;

        this.upStream = serverHandlerUpstream;
        this.downStream = serverHandlerDownstream;
        this.fetch = jasmine.createSpy().and.callFake(function(cb) {
          if (_.isFunction(cb)) {
            cb();
          }
        });
        this.sendHttpRequest = fakeHttpFn;
      };

      var dbHandlerFactoryMock = {
        _DbHandler: {
          _db: null,
          _connectionStream: new Rx.Subject()
        }
      };

      dbHandlerFactoryMock.createDbHandler = function createDbHandler(storeName,
        keys) {

        dbHandlerUpstream = new Rx.Subject();
        dbHandlerUpstream.subscribe(function(item) {
          dbHandlerUpstreamList.push(item);
        });

        dbHandlerDownstream = new Rx.Subject();

        return {
          _storeName: storeName,
          _keys: keys,
          upStream: dbHandlerUpstream,
          downStream: dbHandlerDownstream,
          getAllEntries: jasmine.createSpy().and.callFake(function(cb) {
            cb();
          })
        };
      };

      var harmonizedDataMock = {
        _config: {
          fetchAtStart: false
        },
        _createStreamItem: harmonizedData._createStreamItem,
        _modelSchema: {
          test: {
            storeName: 'test',
            baseUrl: 'http://www.testserver.de',
            route: 'test',
            keys: {
              serverKey: 'id',
              storeKey: '_id'
            },
            saveLocally: true
          },
          explicitTest: {
            storeName: 'test',
            baseUrl: 'http://www.testserver.de',
            route: 'test',
            keys: {
              serverKey: 'id',
              storeKey: '_id'
            },
            saveLocally: true
          }
        }
      };

      beforeEach(function() {
        // Scheduler to mock the RxJS timing
        scheduler = new RxTest.TestScheduler();

        dbHandlerUpstreamList = [];
        serverHandlerUpstreamList = [];
      });

      beforeEach(function() {
        expectedOptions = {
          baseUrl: 'http://www.testserver.de',
          route: 'test',
          keys: {
            serverKey: 'id',
            storeKey: '_id'
          },
          storeName: 'test',
          saveLocally: true
        };

        returnedData = undefined;
      });

      beforeEach(function() {
        injector = new Squire();
        injector.mock('ModelItem', ModelItemMock);
        injector.mock('dbHandlerFactory', dbHandlerFactoryMock);
        injector.mock('ServerHandler', ServerHandlerMock);
        injector.mock('harmonizedData', harmonizedDataMock);
      });

      function testInContext(cb, options) {
        injector.require(['Model', 'mocks'], function(Model, mocks) {

          testModel = new Model('test');

          cb({
            Model: Model,
            mocks: mocks.mocks
          });
        });
      }

      it('should create a model without options', function(done) {
        testInContext(function(deps) {
          dbHandlerFactoryMock._DbHandler._db = true;
          spyOn(deps.Model.prototype, '_dbReadyCb').and.stub();
          testModel = new deps.Model('explicitTest');
          expect(testModel._options).toEqual(expectedOptions);

          expect(testModel._dbHandler.getAllEntries).toHaveBeenCalled();
          expect(testModel._dbReadyCb).toHaveBeenCalled();

          dbHandlerFactoryMock._DbHandler._db = null;
          done();
        });
      });

      it('should create a model with options', function(done) {
        testInContext(function(deps) {
          dbHandlerFactoryMock._DbHandler._db = true;
          harmonizedDataMock._config.fetchAtStart = true;
          spyOn(deps.Model.prototype, 'pushChanges').and.stub();
          testModel = new deps.Model('explicitTest', {
            route: 'othertest',
            testOption: 'blub'
          });

          var overwrittenExpectedOptions = _.cloneDeep(expectedOptions);
          overwrittenExpectedOptions.route = 'othertest';
          overwrittenExpectedOptions.testOption = 'blub';
          expect(testModel._options).toEqual(overwrittenExpectedOptions);

          expect(testModel._dbHandler.getAllEntries).toHaveBeenCalled();
          expect(testModel.pushChanges).toHaveBeenCalled();

          harmonizedDataMock._config.fetchAtStart = false;
          dbHandlerFactoryMock._DbHandler._db = null;
          done();
        });
      });

      it('should get all items from the database after a connect', function(done) {
        testInContext(function(deps) {

          testModel = new deps.Model('explicitTest', {
            route: 'othertest',
            testOption: 'blub'
          });

          spyOn(testModel, '_dbReadyCb').and.stub();

          dbHandlerFactoryMock._DbHandler._connectionStream.onNext(true);

          expect(testModel._dbHandler.getAllEntries).toHaveBeenCalled();
          expect(testModel._dbReadyCb).toHaveBeenCalled();

          done();
        });
      });

      it('should get all items', function(done) {
        testInContext(function(deps) {
          new ModelItemMock(testModel, {name: 'Horst'}, {rtId: 123});
          new ModelItemMock(testModel, {name: 'Hans'}, {rtId: 263});
          new ModelItemMock(testModel, {name: 'Dieter'}, {rtId: 469});

          var returnedItems = [];

          testModel.getItems(function(item) {
            returnedItems.push(item);
          });

          var expectedItems = [{
            name: 'Horst'
          }, {
            name: 'Hans'
          }, {
            name: 'Dieter'
          }];

          var i;

          for (i = 0; i < expectedItems.length; i++) {
            expect(returnedItems[i]).not.toBeUndefined();
            expect(returnedItems[i].data).toEqual(expectedItems[i]);
          }

          expect(i).toBe(expectedItems.length);

          done();
        });
      });

      it('should get a specific item', function(done) {
        testInContext(function(deps) {
          testModel._rtIdHash[123] = new ModelItemMock(testModel, {
            name: 'Horst'
          });
          testModel._rtIdHash[263] = new ModelItemMock(testModel, {
            name: 'Hans'
          });
          testModel._rtIdHash[469] = new ModelItemMock(testModel, {
            name: 'Dieter'
          });

          var returnedItem = testModel.getItem(263);

          expect(returnedItem).not.toBeUndefined();
          expect(returnedItem.data).toEqual({
            name: 'Hans'
          });

          // Item 1026 should not be there
          returnedItem = testModel.getItem(1026);
          expect(returnedItem).toBeUndefined();

          done();
        });
      });

      it('should get data from the server', function(done) {
        testInContext(function(deps) {
          testModel.getFromServer();

          expect(testModel._serverHandler.fetch.calls.count()).toBe(1);

          done();
        });
      });

      it('should get the next runtime ID for the model', function(done) {
        testInContext(function(deps) {
          expect(testModel._nextRuntimeId).toBe(1);
          testModel.getNextRuntimeId();
          expect(testModel._nextRuntimeId).toBe(2);

          done();
        });
      });

      it('should receive updated data from the server', function(done) {
        testInContext(function(deps) {

          var existingItem = new ModelItemMock(testModel, {
            name: 'John Cleese'
          }, {
            storeId: 12,
            rtId: 12,
            deleted: false
          });

          new ModelItemMock(testModel, {
            name: 'Terry Gilliam'
          }, {
            serverId: 1025,
            storeId: 13,
            deleted: false
          });

          // Add first entry to the server downstream
          scheduler.scheduleWithAbsolute(1, function() {

            testModel._serverHandler.downStream.onNext({
              meta: {
                serverId: 1000,
                storeId: 12,
                rtId: 12,
                deleted: false,
                action: 'save'
              },
              data: {
                name: 'John Cleese'
              }
            });

          });

          // Add second entry to the server downstream
          scheduler.scheduleWithAbsolute(10, function() {
            testModel._serverHandler.downStream.onNext({
              meta: {
                serverId: 1025,
                storeId: 13,
                deleted: false,
                action: 'save'
              },
              data: {
                name: 'Terry Gilliam'
              }
            });
          });

          scheduler.start();

          var john = {name: 'John Cleese'};

          expect(testModel._serverIdHash[1000]).toBe(existingItem);
          expect(testModel._serverIdHash[1000].data).toEqual(john);
          expect(testModel._storeIdHash[12]).toBe(existingItem);
          expect(testModel._storeIdHash[12].data).toEqual(john);
          expect(testModel._rtIdHash[12]).toBe(existingItem);
          expect(testModel._rtIdHash[12].data).toEqual(john);

          var terry = {name: 'Terry Gilliam'};
          var terryMeta = {
            serverId: 1025,
            storeId: 13,
            rtId: 1,
            deleted: false
          };

          // Check terry to be correctly saved
          expect(testModel._serverIdHash[1025] instanceof ModelItemMock).toBeTruthy();
          expect(testModel._serverIdHash[1025].data).toEqual(terry);
          expect(testModel._serverIdHash[1025].meta).toEqual(terryMeta);

          // If rtId hash item 13 is the same as serverId hash item 1025 and
          // storeId hash item 13, then serverId item and storeId item are also
          // the same!
          expect(testModel._rtIdHash[1]).toBe(testModel._serverIdHash[1025]);
          expect(testModel._rtIdHash[1]).toBe(testModel._storeIdHash[13]);

          // Check if data are passed to the database upstream
          expect(dbHandlerUpstreamList.length).toEqual(2);
          expect(dbHandlerUpstreamList[0].data).toEqual(john);
          expect(dbHandlerUpstreamList[0].meta).toEqual({
            serverId: 1000,
            storeId: 12,
            rtId: 12,
            deleted: false,
            action: 'save'
          });
          expect(dbHandlerUpstreamList[1].data).toEqual(terry);
          expect(dbHandlerUpstreamList[1].meta).toEqual({
            serverId: 1025,
            storeId: 13,
            rtId: 1,
            deleted: false,
            action: 'save'
          });

          done();
        });
      });

      it('should receive new data from the server', function(done) {
        testInContext(function(deps) {

          // Add first entry to the server downstream
          scheduler.scheduleWithAbsolute(1, function() {
            testModel._serverHandler.downStream.onNext({
              meta: {
                serverId: 1000,
                action: 'save'
              },
              data: {
                name: 'John Cleese'
              }
            });
          });

          // Add second entry to the server downstream
          scheduler.scheduleWithAbsolute(10, function() {
            testModel._serverHandler.downStream.onNext({
              meta: {
                serverId: 1025,
                action: 'save'
              },
              data: {
                name: 'Terry Gilliam'
              }
            });
          });

          scheduler.start();

          expect(_.size(testModel._storeIdHash)).toBe(0);
          expect(_.size(testModel._rtIdHash)).toBe(2);
          expect(_.size(testModel._serverIdHash)).toBe(2);

          var john = {name: 'John Cleese'};
          expect(testModel._serverIdHash[1000].data).toEqual(john);
          expect(testModel._serverIdHash[1000].meta).toEqual({
            serverId: 1000,
            rtId: 1,
            action: 'save'
          });

          var terry = {name: 'Terry Gilliam'};
          var terryMeta = {
            serverId: 1025,
            rtId: 2,
            action: 'save'
          };

          // Check terry to be correctly saved
          expect(testModel._serverIdHash[1025] instanceof ModelItemMock).toBeTruthy();
          expect(testModel._serverIdHash[1025].data).toEqual(terry);
          expect(testModel._serverIdHash[1025].meta).toEqual(terryMeta);

          // New Items should always be send to the server through the new item.
          // So the upstream item lists should be empty.
          expect(serverHandlerUpstreamList.length).toEqual(0);
          expect(dbHandlerUpstreamList.length).toEqual(2);

          expect(dbHandlerUpstreamList[0].meta.serverId).toEqual(1000);
          expect(dbHandlerUpstreamList[1].meta.serverId).toEqual(1025);

          done();
        });
      });

      it('should receive updated data from the database', function(done) {
        testInContext(function(deps) {
          var existingItem = new ModelItemMock(testModel, {
            name: 'John Cleese'
          }, {
            serverId: 1000,
            storeId: 12,
            rtId: 12,
            deleted: false
          });

          new ModelItemMock(testModel, {
            name: 'Terry Gilliam'
          }, {
            serverId: 1025,
            rtId: 13,
            deleted: false
          });

          // Add first entry to the server downstream
          scheduler.scheduleWithAbsolute(1, function() {
            testModel._dbHandler.downStream.onNext({
              meta: {
                serverId: 1000,
                storeId: 12,
                rtId: 12,
                action: 'save',
                deleted: false
              },
              data: {
                name: 'John Cleese'
              }
            });
          });

          // Add second entry to the server downstream
          scheduler.scheduleWithAbsolute(10, function() {
            testModel._dbHandler.downStream.onNext({
              meta: {
                serverId: 1025,
                storeId: 13,
                rtId: 13,
                action: 'save',
                deleted: false
              },
              data: {
                name: 'Terry Gilliam'
              }
            });
          });

          scheduler.start();

          var john = {name: 'John Cleese'};
          expect(testModel._serverIdHash[1000]).toBe(existingItem);
          expect(testModel._serverIdHash[1000].data).toEqual(john);
          expect(testModel._storeIdHash[12]).toBe(existingItem);
          expect(testModel._storeIdHash[12].data).toEqual(john);
          expect(testModel._rtIdHash[12]).toBe(existingItem);
          expect(testModel._rtIdHash[12].data).toEqual(john);

          var terry = {name: 'Terry Gilliam'};
          var terryMeta = {
            serverId: 1025,
            storeId: 13,
            rtId: 13,
            deleted: false
          };

          // Check terry to be correctly saved
          expect(testModel._serverIdHash[1025] instanceof ModelItemMock).toBeTruthy();
          expect(testModel._serverIdHash[1025].data).toEqual(terry);
          expect(testModel._serverIdHash[1025].meta).toEqual(terryMeta);

          // If rtId hash item 13 is the same as serverId hash item 1025 and
          // storeId hash item 13, then serverId item and storeId item are also
          // the same!
          expect(testModel._rtIdHash[13]).toBe(testModel._serverIdHash[1025]);
          expect(testModel._rtIdHash[13]).toBe(testModel._storeIdHash[13]);

          // Check if data are passed to the database upstream
          expect(dbHandlerUpstreamList.length).toEqual(0);
          expect(serverHandlerUpstreamList.length).toEqual(0);

          done();
        });
      });

      it('should receive new data from the database', function(done) {
        testInContext(function(deps) {

          // Add first entry to the server downstream
          scheduler.scheduleWithAbsolute(1, function() {
            testModel._dbHandler.downStream.onNext({
              meta: {
                storeId: 1
              },
              data: {
                name: 'John Cleese'
              }
            });
          });

          // Add second entry to the server downstream
          scheduler.scheduleWithAbsolute(10, function() {
            testModel._dbHandler.downStream.onNext({
              meta: {
                storeId: 2
              },
              data: {
                name: 'Terry Gilliam'
              }
            });
          });

          scheduler.start();

          expect(_.size(testModel._storeIdHash)).toBe(2);
          expect(_.size(testModel._rtIdHash)).toBe(2);

          var john = {name: 'John Cleese'};
          expect(testModel._storeIdHash[1].data).toEqual(john);
          expect(testModel._storeIdHash[1].meta).toEqual({
            storeId: 1,
            rtId: 1
          });

          var terry = {name: 'Terry Gilliam'};
          var terryMeta = {
            storeId: 2,
            rtId: 2
          };

          // Check terry to be correctly saved
          expect(testModel._storeIdHash[2] instanceof ModelItemMock).toBeTruthy();
          expect(testModel._storeIdHash[2].data).toEqual(terry);
          expect(testModel._storeIdHash[2].meta).toEqual(terryMeta);

          // Check if data are passed to the database upstream
          expect(dbHandlerUpstreamList.length).toEqual(0);
          expect(serverHandlerUpstreamList.length).toEqual(0);

          expect(dbHandlerUpstreamList).toEqual(serverHandlerUpstreamList);

          done();
        });
      });

      it('should get the itemUrl with serverId given', function(done) {
        testInContext(function(deps) {
          var modelUrl = testModel.getFullRoute();
          expect(modelUrl).toEqual(['http://www.testserver.de', 'test']);

          done();
        });
      });

      it('should check server for deleted items and delete them', function(done) {
        testInContext(function(deps) {

          var downstreamItems = [];
          testModel.downStream.subscribe(function(item) {
            downstreamItems.push(item);
          });

          jasmine.clock().install();

          testModel._serverIdHash = {
            100: {
              meta: {
                serverId: 100,
                storeId: 1
              }
            },
            363: {
              meta: {
                serverId: 363,
                storeId: 2
              }
            },

            // This item should be deleted!
            400: {
              meta: {
                serverId: 400,
                storeId: 3
              }
            }
          };

          // 400 is not available on the server, so we know that 400 should be
          // deleted
          returnedData = [100, 200, 300, 363];

          testModel.checkForDeletedItems();

          // Tick, so the "server response" comes!
          jasmine.clock().tick(11);
          scheduler.start();

          expect(dbHandlerUpstreamList.length).toBe(1);
          expect(dbHandlerUpstreamList[0].meta.serverId).toBe(400);
          expect(dbHandlerUpstreamList[0].meta.action).toBe('deletePermanently');

          expect(downstreamItems.length).toBe(1);
          expect(downstreamItems[0]).toEqual(dbHandlerUpstreamList[0]);

          jasmine.clock().uninstall();
          done();
        });
      });

      it('should get new items from the upstream', function(done) {
        testInContext(function(deps) {
          testModel._rtIdHash[123] = true;

          scheduler.scheduleWithAbsolute(10, function() {
            testModel.upStream.onNext({
              meta: {
                rtId: 123
              },
              data: {
                name: 'Terry Gilliam'
              }
            })
          });

          scheduler.scheduleWithAbsolute(10, function() {
            testModel.upStream.onNext({
              meta: {
                rtId: 124
              },
              data: {
                name: 'Terry Gilliam'
              }
            })
          });

          expect(_.size(testModel._rtIdHash)).toBe(1);

          scheduler.start();

          expect(_.size(testModel._rtIdHash)).toBe(2);

          expect(testModel._rtIdHash[124] instanceof ModelItemMock).toBeTruthy();
          expect(testModel._rtIdHash[124].meta.rtId).toBe(124);
          expect(testModel._rtIdHash[124].data.name).toBe('Terry Gilliam');

          done();
        });
      });

      it('should push changes to the server', function(done) {
        testInContext(function(deps) {
          expect(serverHandlerUpstreamList.length).toBe(0);

          testModel._storeIdHash = {
            123: { meta: { storeId: 123 } },
            124: { meta: { storeId: 124, serverId: 5000 } },
            125: { meta: { storeId: 125, serverId: 5000, deleted: true } },
            126: { meta: { storeId: 126, deleted: true } },
          };

          testModel.pushChanges();

          expect(serverHandlerUpstreamList.length).toBe(3);
          expect(serverHandlerUpstreamList[0].meta.action).toBe('save');
          expect(serverHandlerUpstreamList[0].meta.storeId).toBe(123);
          expect(serverHandlerUpstreamList[1].meta.action).toBe('delete');
          expect(serverHandlerUpstreamList[1].meta.storeId).toBe(125);
          expect(serverHandlerUpstreamList[2].meta.action).toBe('save');
          expect(serverHandlerUpstreamList[2].meta.storeId).toBe(126);
          done();
        });
      });

      it('should create a model without local database', function(done) {
        testInContext(function(deps) {
          spyOn(deps.Model.prototype, '_dbReadyCb').and.stub();

          expect(deps.Model.prototype._dbReadyCb).not.toHaveBeenCalled();

          testModel = new deps.Model('test', {
            saveLocally: false
          });

          expect(testModel._dbHandler._storeName).toBeUndefined();
          expect(testModel._dbReadyCb).toHaveBeenCalled();

          var downStreamItems = [];
          testModel._dbHandler.downStream.subscribe(function(item) {
            downStreamItems.push(item);
          });

          // Test upstream
          scheduler.scheduleWithAbsolute(1, function() {
            testModel._dbHandler.upStream.onNext({
              meta: {
                serverId: 1000,
                storeId: 12,
                rtId: 12,
                action: 'save',
                deleted: false
              },
              data: {
                name: 'John Cleese'
              }
            });
          });

          scheduler.scheduleWithAbsolute(10, function() {
            testModel._dbHandler.upStream.onNext({
              meta: {
                serverId: 1000,
                storeId: 12,
                rtId: 12,
                action: 'delete',
                deleted: false
              },
              data: {
                name: 'John Cleese'
              }
            });
          });

          scheduler.start();

          expect(downStreamItems.length).toBe(2);
          expect(downStreamItems[0].meta.action).toBe('save');
          expect(downStreamItems[1].meta.action).toBe('deletePermanently');

          done();
        });
      });

    });
  });
