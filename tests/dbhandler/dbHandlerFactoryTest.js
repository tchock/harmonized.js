'use strict';

define(['Squire', 'sinon'], function(Squire, sinon) {
  describe('DB Handler Factory', function() {

    var injector;

    beforeEach(function() {
      injector = new Squire();
      // Create spies
      injector.mock('DbHandler/IndexedDbHandler', function() {
        return 'IndexedDbHandler';
      });
      injector.mock('DbHandler/WebSqlHandler', function() {
        return 'WebSqlHandler';
      })

    });

    beforeEach(function() {
      // TODO create resource definition
    });

    beforeEach(function() {
      // TODO other db configuration
    });

    it('should create a IndexedDB DB Handler', function(done) {
      injector.store('dbHandlerFactory');
      injector.require(['dbHandlerFactory',
        'DbHandler/IndexedDbHandler', 'mocks'
      ], function(dbHandlerFactory, IndexedDbHandler, mocks) {
        // Creates spies to mock available indexeddb
        sinon.stub(mocks.store.dbHandlerFactory,
          '_getIndexedDb',
          function() {
            return true;
          });

        // Initialized db handler factory
        dbHandlerFactory();

        // Test for correct handler and created handler object
        expect(dbHandlerFactory._DbHandler()).toBe(
          'IndexedDbHandler');
        var handler = dbHandlerFactory.createDbHandler(
          'testStore');
        expect(handler instanceof IndexedDbHandler).toBeTruthy();

        mocks.store.dbHandlerFactory._getIndexedDb.restore();
        done();
      });
    });

    it('should create a WebSQL DB Handler', function(done) {
      injector.store('dbHandlerFactory');
      injector.require(['dbHandlerFactory', 'DbHandler/WebSqlHandler', 'mocks'], function(
        dbHandlerFactory, WebSqlHandler, mocks) {
        // Creates spies to mock missing indexeddb and available websql
        sinon.stub(mocks.store.dbHandlerFactory, '_getIndexedDb', function() {
          return false;
        });
        sinon.stub(mocks.store.dbHandlerFactory, '_getWebSql',function() {
          return true;
        });

        // Initialized db handler factory
        dbHandlerFactory();

        // Test for correct handler and created handler object
        expect(dbHandlerFactory._DbHandler()).toBe(
          'WebSqlHandler');
        var handler = dbHandlerFactory.createDbHandler('testStore');
        expect(handler instanceof WebSqlHandler).toBeTruthy();

        mocks.store.dbHandlerFactory._getIndexedDb.restore();
        done();
      });
    });

    it('should create no DB Handler', function(done) {
      injector.store('dbHandlerFactory');
      injector.require(['dbHandlerFactory', 'mocks'], function(
        dbHandlerFactory, mocks) {
        // Creates spies to mock missing indexeddb and websql
        sinon.stub(mocks.store.dbHandlerFactory, '_getIndexedDb', function() {
          return false;
        });
        sinon.stub(mocks.store.dbHandlerFactory, '_getWebSql', function() {
          return false;
        });

        // Initialized db handler factory
        dbHandlerFactory();

        // Test for correct handler and created handler object
        expect(dbHandlerFactory._DbHandler).toBeUndefined();
        var handler = dbHandlerFactory.createDbHandler('testStore');
        expect(handler).toBeUndefined();

        mocks.store.dbHandlerFactory._getIndexedDb.restore();
        done();
      });
    });

    it('should find the right store definitions', function(done) {
      injector.store('dbHandlerFactory');
      injector.require(['dbHandlerFactory', 'mocks'], function(
        dbHandlerFactory, mocks) {
        var struct = dbHandlerFactory._getDbStructure();
        /*
        expect(localDb.getSearchProperties('testDb', 'test').length).toEqual(0);
        expect(localDb.getSearchProperties('testDb', 'newtest').length).toEqual(1);
        expect(localDb.getSearchProperties('testDb', 'othertest').length).toEqual(2);
        */
        // TODO check if the store definitions are right
        // TODO Check if content of search properties array is correct

        done();
      });
    });

    it('should get server and store key names', function(done) {
      injector.store('dbHandlerFactory');
      injector.require(['dbHandlerFactory', 'mocks'], function(
        dbHandlerFactory, mocks) {
        // TODO check for correct server and store keys
        done();
      });

    });


  });

});
