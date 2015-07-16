'use strict';

define(['Squire', 'lodash', 'rx', 'rx.testing'],
  function(Squire, _, Rx, RxTest) {

    var testParentItem;
    var testModel;
    var testSubModel;
    var expectedOptions;
    var injector;
    var scheduler;

    var dbHandlerUpstreamList = [];
    var serverHandlerUpstreamList = [];

    var dbHandlerUpstream;
    var dbHandlerDownstream;
    var dbReadyStream;

    var serverHandlerUpstream;
    var serverHandlerDownstream;

    var ModelMock = function ModelMock(modelName, options) {
      this.downStream = new Rx.Subject();
      this.upStream = new Rx.Subject();
      this._existingItemDownStream = new Rx.Subject();
      this._dbDownStream = new Rx.Subject();

      this._rtIdHash = {};
      this._serverIdHash = {};
      this._storeIdHash = {};

      this._nextRuntimeId = 1;
      this.getNextRuntimeId = function() {
        return this._nextRuntimeId++;
      };

      this.getUrl = function() {
        return 'http://www.test.de/' + modelName;
      };
    };

    var modelItemMock = function ModelItemMock() {
      this.getUrl = function() {
        return 'blub';
      };
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
      this.fetch = jasmine.createSpy();
    };

    var dbHandlerFactoryMock = {};
    dbHandlerFactoryMock.createDbHandler = function createDbHandler(storeName,
      keys) {

      dbHandlerUpstream = new Rx.Subject();
      dbHandlerUpstream.subscribe(function(item) {
        dbHandlerUpstreamList.push(item);
      });

      dbHandlerDownstream = new Rx.Subject();
      dbReadyStream = new Rx.Subject();

      return {
        _storeName: storeName,
        _keys: keys,
        upStream: dbHandlerUpstream,
        downStream: dbHandlerDownstream,
        readyStream: dbReadyStream,
        getAllEntries: jasmine.createSpy(),
        getEntry: jasmine.createSpy()
      };
    };

    var harmonizedDataMock = {
      _modelSchema: {
        test: {
          storeName: 'test',
          baseUrl: 'http://www.testserver.de/',
          route: 'test',
          keys: {
            serverKey: 'id',
            storeKey: '_id'
          },
          subModels: {
            informations: {
              storeName: 'informations',
              route: 'informations',
              keys: {
                serverKey: 'id',
                storeKey: '_id'
              }
            }
          }
        },
        explicitTest: {
          storeName: 'test',
          baseUrl: 'http://www.testserver.de/',
          route: 'test',
          keys: {
            serverKey: 'id',
            storeKey: '_id'
          }
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
        route: 'informations',
        keys: {
          serverKey: 'id',
          storeKey: '_id'
        },
        storeName: 'test_informations',
        serverOptions: {}
      };
    });

    beforeEach(function() {
      injector = new Squire();

      //injector.mock('ModelItem', ModelItemMock);
      injector.mock('dbHandlerFactory', dbHandlerFactoryMock);
      injector.mock('ServerHandler', ServerHandlerMock);
      injector.mock('harmonizedData', harmonizedDataMock);
    });

    function testInContext(cb, options) {
      injector.require(['SubModel', 'mocks'], function(SubModel, mocks) {

        testModel = new ModelMock('test');
        testParentItem = new ModelItemMock();
        testSubModel = new SubModel('informations', testParentItem, testModel);

        testSubModel._dbHandler.upStream.subscribe(function(item) {
          dbHandlerUpstreamList.push(item);
        });

        testSubModel._serverHandler.upStream.subscribe(function(item) {
          serverHandlerUpstreamList.push(item);
        });

        cb({
          SubModel: SubModel,
          mocks: mocks.mocks
        });
      });
    }

    xit('should create a new submodel with options', function(done) {
      testInContext(function(deps) {
        expect(testModel._options).toEqual(expectedOptions);

        done();
      });
    });

    xit('should create a new submodel with options', function(done) {
      testInContext(function(deps) {
        testSubModel = new deps.SubModel('informations', testParentItem, testModel, {
          route: 'othertest',
          testOption: 'blub'
        });

        expect(testSubModel._model).toBe(testModel);
        expect(testSubModel._parent).toBe(testParentItem);

        var overwrittenExpectedOptions = _.clone(expectedOptions);
        overwrittenExpectedOptions.route = 'othertest';
        overwrittenExpectedOptions.testOption = 'blub';
        expect(testSubModel._options).toEqual();

        done();
      });
    });

    xit('should initially get data from the database AND server', function(done) {
      testInContext(function(deps) {
        testSubModel = new deps.SubModel('informations', testParentItem, testModel);

        // Check if the db data will be immediatly fetched
        expect(testSubModel._dbHandler.getAllEntries.calls.count()).toBe(0);
        expect(testSubModel._dbHandler.getEntry.calls.count()).toBe(1);
        expect(testSubModel._serverHandler.fetch.calls.count()).toBe(1);

        done();
      });
    });

    xit('should get data from the local database', function(done) {
      testInContext(function(deps) {

        testSubModel._serverItems = [1025];

        // Add first entry to the server downstream
        scheduler.scheduleWithAbsolute(1, function() {
          testSubModel._dbHandler.downStream.onNext({
            meta: { storeId: 123 },
            data: {
              serverItems: [1025, 1000],
              storeItems: [60]
            }
          });
        });

        scheduler.start();

        expect(testSubModel._serverItems.length).toBe(1);
        expect(testSubModel._serverItems[0]).toBe(1025);

        expect(testSubModel._storeItems.length).toBe(1);
        expect(testSubModel._storeItems[0]).toBe(60);

        // Check if data are passed to the database upstream
        expect(serverHandlerUpstreamList.length).toEqual(0);
        expect(dbHandlerUpstreamList.length).toEqual(1);
        expect(dbHandlerUpstreamList[0]).toEqual({
          meta: { storeId: 123 },
          data: {
            serverItems: [1025],
            storeItems: [60]
          }
        });

        done();
      });
    });

    xit('should get data from the server', function(done) {
      testInContext(function(deps) {
        testSubModel = new deps.SubModel('testsub', testParentItem, testModel, {
          serverMapFn: function(item) {
            return item.meta.serverId;
          }
        });

        testSubModel._serverItems = [1025];

        // Add first entry to the server downstream
        scheduler.scheduleWithAbsolute(1, function() {
          testSubModel._serverHandler.downStream.onNext({
            meta: { storeId: 123 },
            data: [1000, 1025]
          });
        });

        scheduler.start();

        expect(testSubModel._serverItems.length).toBe(2);
        expect(testSubModel._serverItems[0]).toBe(1000);
        expect(testSubModel._serverItems[1]).toBe(1025);

        // Check if data are passed to the database upstream
        expect(serverHandlerUpstreamList.length).toEqual(0);
        expect(dbHandlerUpstreamList.length).toEqual(1);
        expect(dbHandlerUpstreamList[0].data).toEqual({
          serverItems: [1000, 1025],
          storeItems: []
        });
        expect(dbHandlerUpstreamList[0].meta).toEqual({
          storeId: 123
        });

        done();
      });
    });

    xit('should get all the items from the model', function(done) {
      testInContext(function(deps) {
        testModel._serverIdHash[1000] = {
          meta: { serverId: 1000 },
          data: { name: 'Walter White' }
        };
        testModel._serverIdHash[1025] = {
          meta: { serverId: 1000 },
          data: { name: 'Jesse Pinkman' }
        };
        testModel._storeIdHash[90] = {
          meta: { storeId: 90 },
          data: { name: 'Gustavo Fring' }
        };

        testSubModel._serverItems = [1000, 1025];
        testSubModel._storeItems = [90];

        var returnedItems = [];
        testSubModel.getItems(function(item) {
          returnedItems.push(item);
        });

        var expectedItems = [{
            name: 'Walter White'
          }, {
            name: 'Jesse Pinkman'
          }, {
            name: 'Gustavo Fring'
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

    xit('should get a single item from the model', function(done) {
      testInContext(function(deps) {
        testModel._rtIdHash[123] = {
          meta: { rtId: 123 },
          data: { name: 'Horst' }
        };
        testModel._rtIdHash[263] = {
          meta: { rtId: 263, serverId: 1000 },
          data: { name: 'Hans' }
        };

        testSubModel._serverItems = [1000];

        var returnedItem = testModel.getItem(263);

        expect(returnedItem).not.toBeUndefined();
        expect(returnedItem.data).toEqual({
          name: 'Hans'
        });

        // Item 1026 should not be there
        returnedItem = testModel.getItem(123);
        expect(returnedItem).toBeUndefined();

        done();
      });
    });

    xit('should filter items from the data model', function(done) {
      testInContext(function(deps) {
        // Set the entries of the sub model
        testSubModel._serverItems = [1000, 1025];
        testSubModel._serverItems = [100];

        var modelStreamItems = [];
        testModel.downStream.subscribe(function(item) {
          modelStreamItems.push(item);
        });

        var filteredItems = [];
        testSubModel._filterModelStream.subscribe(function(item) {
          filteredItems.push(item);
        });

        // Add entries from the model downstream
        scheduler.scheduleWithAbsolute(10, function() {
          testModel.downStream.onNext({
            meta: { rtId: 123 },
            data: { name: 'Darth Vader' }
          });
          testModel.downStream.onNext({
            meta: { serverId: 1025, rtId: 125 },
            data: { name: 'Terry Gilliam' }
          });
          testModel.downStream.onNext({
            meta: { storeId: 16 },
            data: { name: 'Walter White' }
          });
          testModel.downStream.onNext({
            meta: { storeId: 100, serverId: 5156, rtId: 124 },
            data: { name: 'Jesse Pinkman' }
          });
          testModel.downStream.onNext({
            meta: { rtId: 18, serverId: 1025 },
            data: { name: 'Gustavo Fring' }
          });
        });

        scheduler.start();

        expect(modelStreamItems.length).toBe(5);
        expect(filteredItems.length).toBe(3);
        expect(filteredItems[0].meta.rtId).toBe(125);
        expect(filteredItems[1].meta.rtId).toBe(124);
        expect(filteredItems[2].meta.rtId).toBe(18);

        done();
      });
    });

    xit('should get known data with existing serverID from the data model downstream', function(done) {
      testInContext(function(deps) {

        // Set the entries of the sub model
        testSubModel._serverItems = [5156];

        // Add entries from the model downstream
        scheduler.scheduleWithAbsolute(10, function() {
          testModel.downStream.onNext({
            meta: { serverId: 5156, rtId: 124 },
            data: { name: 'Jesse Pinkmannnn' }
          });
        });

        scheduler.start();

        expect(testSubModel._serverItems.length).toBe(1);
        expect(testSubModel._serverItems[0]).toBe(5156);
        expect(dbHandlerUpstreamList.length).toBe(0);

        done();
      });
    });

    xit('should get known data with new serverID from the data model downstream', function(done) {
      testInContext(function(deps) {

        // Set the items at the model
        testModel._serverIdHash[128] = 'Vegeta';
        testModel._serverIdHash[130] = 'Son Goku';

        // Set the entries of the sub model
        testSubModel._serverItems = [5156, 128];
        testSubModel._storeItems = [30];

        // Add entries from the model downstream
        scheduler.scheduleWithAbsolute(10, function() {
          testModel.downStream.onNext({
            meta: { serverId: 128, rtId: 1 },
            data: { name: 'Vegeta' }
          });

          testModel.downStream.onNext({
            meta: { serverId: 130, storeId: 30 },
            data: { name: 'Son Goku' }
          });
        });

        scheduler.start();

        expect(testSubModel._serverItems.length).toBe(2);
        expect(testSubModel._storeItems.length).toBe(1);

        expect(dbHandlerUpstreamList.length).toBe(0);
        expect(serverHandlerUpstreamList.length).toBe(1);
        expect(serverHandlerUpstreamList[0]).toEqual({
          meta: { storeId: 30, serverId: 130 }
        });

        scheduler.stop();

        serverHandlerDownstream.onNext({
          meta: { storeId: 30, serverId: 130 }
        });

        scheduler.start();

        expect(testSubModel._serverItems).toEqual([5156, 128, 30]);
        expect(testSubModel._storeItems.length).toBe(0);

        done();
      });
    });

    xit('should get known data with existing storeID from the data model downstream', function(done) {
      testInContext(function(deps) {

        // Set the entries of the sub model
        testSubModel._storeItems = [5156];

        // Add entries from the model downstream
        scheduler.scheduleWithAbsolute(10, function() {
          testModel.downStream.onNext({
            meta: { storeId: 5156, rtId: 124 },
            data: { name: 'Jesse Pinkmannnn' }
          });
        });

        scheduler.start();

        expect(testSubModel._storeItems.length).toBe(1);
        expect(testSubModel.storeItems[0]).toBe(5156);
        expect(dbHandlerUpstreamList.length).toBe(0);

        done();
      });
    });

    xit('should get the runtime id from the data model', function(done) {
      testInContext(function(deps) {
        spyOn(testModel, 'getNextRuntimeId').and.returnValue(9000);
        var nextId = testSubModel.getNextRuntimeId();
        expect(nextId).toBe(9000);
        expect(testModel.getNextRuntimeId.calls.count()).toBe(1);
        done();
      });
    });

    xit('should get a new item on the upstream', function(done) {
      testInContext(function(deps) {

        // Set the entries of the sub model
        testSubModel._serverItems = [5156, 1280];
        testSubModel._storeItems = [];

        scheduler.scheduleWithAbsolute(10, function() {
          testSubModel.upStream.onNext({
            meta: { serverId: 1230, storeId: 128, rtId: 1, action: 'save' },
            data: { name: 'Vegeta' }
          });

          testSubModel.upStream.onNext({
            meta: { storeId: 130, rtId: 2, action: 'save' },
            data: { name: 'Son Goku' }
          });
        });

        scheduler.start();

        expect(testSubModel._serverItems).toEqual([5156, 1280]);
        expect(testSubModel._storeItems).toEqual([128, 130]);

        expect(serverHandlerUpstreamList.length).toBe(1);
        expect(serverHandlerUpstreamList[0]).toEqual({
          meta: { serverId: 1230, storeId: 128 }
        });

        expect(dbHandlerUpstreamList.length).toBe(1);
        expect(dbHandlerUpstreamList[0]).toEqual({
          meta: { serverId: 123 },
          data: {
            serverItems: [5156, 1280],
            storeItems: [128, 130],
            deletedItems: []
          }
        });

        done();
      });
    });

    xit('should ignore an existing item on the upstream', function(done) {
      testInContext(function(deps) {

        // Set the entries of the sub model
        testSubModel._serverItems = [5156, 1280];
        testSubModel._storeItems = [50];

        scheduler.scheduleWithAbsolute(10, function() {
          testSubModel.upStream.onNext({
            meta: { serverId: 5156, storeId: 128, rtId: 1, action: 'save' },
            data: { name: 'Luke Skywalker' }
          });

          testSubModel.upStream.onNext({
            meta: { storeId: 50, rtId: 2, action: 'save' },
            data: { name: 'Darth Vader' }
          });
        });

        scheduler.start();
        expect(serverHandlerUpstreamList.length).toBe(0);
        expect(dbHandlerUpstreamList.length).toBe(0);

        done();
      });
    });

    xit('should delete an existing item on the upstream', function(done) {
      testInContext(function(deps) {

        // Set the entries of the sub model
        testSubModel._serverItems = [5156, 1280];
        testSubModel._storeItems = [50];

        scheduler.scheduleWithAbsolute(10, function() {
          testSubModel.upStream.onNext({
            meta: { serverId: 5156, storeId: 128, rtId: 1, action: 'delete' },
            data: { name: 'Luke Skywalker' }
          });

          testSubModel.upStream.onNext({
            meta: { storeId: 50, rtId: 1, action: 'delete' },
            data: { name: 'Darth Vader' }
          });
        });

        scheduler.start();

        expect(testSubModel._serverItems).toEqual([5156, 1280]);
        expect(testSubModel._storeItems).toEqual([]);
        expect(testSubModel._deletedItems).toEqual([5156]);

        expect(serverHandlerUpstreamList.length).toBe(1);
        expect(serverHandlerUpstreamList[0]).toEqual({
          meta: { serverId: 5156, storeId: 128, action: 'delete' }
        });

        expect(dbHandlerUpstreamList.length).toBe(2);
        expect(dbHandlerUpstreamList[0]).toEqual({
          meta: { serverId: 123 },
          data: {
            serverItems: [5156, 1280],
            storeItems: [50],
            deletedItems: [5156]
          }
        });
        expect(dbHandlerUpstreamList[1]).toEqual({
          meta: { serverId: 123 },
          data: {
            serverItems: [5156, 1280],
            storeItems: [],
            deletedItems: [5156]
          }
        });

        scheduler.stop();

        scheduler.scheduleWithAbsolute(20, function() {
          serverHandlerDownstream.onNext({
            meta: { serverId: 5156, storeId: 128, action: 'deletedPermanently' },
            data: {}
          });
        });

        scheduler.start();

        expect(dbHandlerUpstreamList.length).toBe(3);
        expect(dbHandlerUpstreamList[2]).toEqual({
          meta: { serverId: 123 },
          data: {
            serverItems: [1280],
            storeItems: [],
            deletedItems: []
          }
        });

        done();
      });
    });

    xit('should delete an unknown item on the upstream', function(done) {
      testInContext(function(deps) {
        scheduler.scheduleWithAbsolute(10, function() {
          testSubModel.upStream.onNext({
            meta: { serverId: 123, storeId: 128, rtId: 1, action: 'delete' },
            data: { name: 'Vegeta' }
          });
        });

        scheduler.start();
        expect(serverHandlerUpstreamList.length).toBe(0);
        expect(dbHandlerUpstreamList.length).toBe(0);

        done();
      });
    });

    xit('should get the url of the model', function(done) {
      testInContext(function(deps) {
        spyOn(testParentItem, 'getUrl').and.returnValue('http://hyphe.me/test/123');
        var url = testSubModel.getUrl();

        expect(url).toBe('http://hyphe.me/test/123/informations');
        expect(testparentItem.getUrl.calls.count()).toBe(1);
        done();
      });
    });

  });
