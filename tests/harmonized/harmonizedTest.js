define(['Squire', 'rx', 'rx.testing',], function(Squire, Rx, RxTest) {
  describe('harmonized', function() {
    var injector;
    var scheduler;
    var connectionStreamItems;

    var harmonizedDataMock = {
      _config: {
        hallo: 'dave',
        bye: 'dave'
      },
      setModelSchema: jasmine.createSpy()
    };

    var modelHandlerMock = {
      init: jasmine.createSpy(),
      destroy: jasmine.createSpy(),
      pushAll: jasmine.createSpy(),
      getFromServer: jasmine.createSpy(),
      getModel: jasmine.createSpy().and.callFake(function(modelName) {
        return modelName;
      })
    };

    var ServerHandlerMock = {
      connectionStream: new Rx.Subject()
    };

    ServerHandlerMock.connectionStream.subscribe(function(state) {
      connectionStreamItems.push(state);
    });

    var ViewCollectionMock = function(model, mapUpFn, mapownFn) {
      return arguments;
    };

    beforeEach(function() {
      // Scheduler to mock the RxJS timing
      scheduler = new RxTest.TestScheduler();
    });

    beforeEach(function() {
      connectionStreamItems = [];
    });

    beforeEach(function() {
      injector = new Squire();
      injector.mock('harmonizedData', harmonizedDataMock);
      injector.mock('modelHandler', modelHandlerMock);
      injector.mock('ServerHandler', ServerHandlerMock);
      injector.mock('ViewCollection', ViewCollectionMock);
    });

    function testInContext(cb, options) {
      injector.require(['harmonized', 'mocks'], function(harmonized, mocks) {

        cb({
          harmonized: harmonized,
          mocks: mocks.mocks
        });
      });
    }

    it('should set the model schema', function(done) {
      testInContext(function(deps) {
        deps.harmonized.setModelSchema();
        expect(harmonizedDataMock.setModelSchema.calls.count()).toBe(1);

        done();
      });
    });

    it('should set the http function and config', function(done) {
      testInContext(function(deps) {

        deps.harmonized.setup('blub');

        expect(harmonizedDataMock._httpFunction).toBe('blub');

        var updateCb = function() {
          var a = 'hello';
        };

        deps.harmonized.setup('testFn', updateCb);

        expect(harmonizedDataMock._config).toEqual({
          hallo: 'dave',
          bye: 'dave'
        });

        deps.harmonized.setConfig({
          test: true,
          hallo: 'david'
        });

        expect(harmonizedDataMock._config).toEqual({
          hallo: 'david',
          bye: 'dave',
          test: true
        });

        expect(harmonizedDataMock._httpFunction).toBe('testFn');
        expect(harmonizedDataMock._viewUpdateCb).toBe(updateCb);

        done();
      });
    });

    it('set the promise class', function(done) {
      testInContext(function(deps) {
        deps.harmonized.setPromiseClass('test');
        expect(harmonizedDataMock._promiseClass).toBe('test');

        done();
      });
    });

    it('should build the model', function(done) {
      testInContext(function(deps) {
        deps.harmonized.build();
        expect(modelHandlerMock.init.calls.count()).toBe(1);

        done();
      });
    });

    it('should destroy the model structure and the db', function(done) {
      testInContext(function(deps) {
        deps.harmonized.destroy();
        expect(modelHandlerMock.destroy.calls.count()).toBe(1);

        done();
      });
    });

    it('should push all data', function(done) {
      testInContext(function(deps) {
        deps.harmonized.pushAll();
        expect(modelHandlerMock.pushAll.calls.count()).toBe(1);

        done();
      });
    });

    it('should get from the server', function(done) {
      testInContext(function(deps) {
        deps.harmonized.getFromServer();
        expect(modelHandlerMock.getFromServer.calls.count()).toBe(1);

        done();
      });
    });

    it('should set harmonized online', function(done) {
      testInContext(function(deps) {

        deps.harmonized.setOnline();
        scheduler.start();

        expect(connectionStreamItems.length).toBe(1);
        expect(connectionStreamItems[0]).toBeTruthy();

        done();
      });
    });

    it('should set harmonized offline', function(done) {
      testInContext(function(deps) {

        deps.harmonized.setOffline();
        scheduler.start();

        expect(connectionStreamItems.length).toBe(1);
        expect(connectionStreamItems[0]).toBeFalsy();

        done();
      });
    });

    it('should create a view model', function(done) {
      testInContext(function(deps) {

        var createdCollection = deps.harmonized.createViewModel('testModel', 'upfn', 'downfn');

        expect(modelHandlerMock.getModel.calls.count()).toBe(1);
        expect(createdCollection[0]).toBe('testModel');
        expect(createdCollection[1]).toBe('upfn');
        expect(createdCollection[2]).toBe('downfn');

        done();
      });
    });

  });
});
