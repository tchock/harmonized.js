'use strict';

describe('HTTP handler', function() {

  var scheduler;

  beforeEach(function() {
    // Scheduler to mock the RxJS timing
    scheduler = new Rx.TestScheduler();

    // Mock the subject to let it use the scheduler
    var OriginalSubject = Rx.Subject;
    spyOn(Rx, 'Subject').and.callFake(function() {
      return new OriginalSubject(scheduler.createObserver(), scheduler.createHotObservable());
    });
  });

  beforeEach(function() {
    jasmine.clock().install();
  });

  afterEach(function() {
    jasmine.clock().uninstall();
  });

  describe('connect function', function() {

    it('should set the connection state to true', function() {
      var sh = {
        downStream: new Rx.Subject(),
        _downStreamSubscribe: null,
        _connected: false,
        setConnectionState: function(state) {
          sh._connected = state;
        }
      };

      scheduler.scheduleWithAbsolute(5, function() {
        Harmonized.ServerHandler.httpHandler.connect(sh);
      });

      expect(sh._connected).toBeFalsy();

      scheduler.start();

      expect(sh._connected).toBeTruthy();
    });

  });

  describe('disconnect function', function() {

    it('should remove the stream connection correctly', function() {
      var sh = {
        downStream: new Rx.Subject(),
        _connected: true,
        setConnectionState: function(state) {
          sh._connected = state;
        }
      };

      scheduler.scheduleWithAbsolute(5, function() {
        Harmonized.ServerHandler.httpHandler.disconnect(sh);
      });

      expect(sh._connected).toBeTruthy();

      scheduler.start();

      expect(sh._connected).toBeFalsy();
    });

  });

  describe('fetch function', function() {
    var sh;
    var receivedOptions;

    beforeEach(function() {
      receivedOptions = null;

      spyOn(Harmonized, '_httpFunction').and.callFake(function(options) {
        receivedOptions = options;
      });

      sh = {
        downStream: new Rx.Subject(),
        _baseUrl: 'http://www.hyphe.me/',
        _resourcePath: 'test/resource/',
        _options: {}
      };
    });

    it('should fetch all data', function() {
      Harmonized.ServerHandler.httpHandler.fetch(sh);

      expect(receivedOptions).toEqual({
        method: 'GET',
        url: 'http://www.hyphe.me/test/resource/'
      });
    });

    it('should fetch data with "modified-since header"', function() {
      Harmonized._config.sendModifiedSince = true;
      sh._lastModified = 1234;

      Harmonized.ServerHandler.httpHandler.fetch(sh);

      expect(receivedOptions).toEqual({
        method: 'GET',
        url: 'http://www.hyphe.me/test/resource/',
        headers: {
          'If-Modified-Since': 1234
        }
      });
    });

    it('should fetch all data with missing last-modified info but activated sendLastModified in config', function() {
      Harmonized._config.sendModifiedSince = true;
      sh._lastModified = undefined;

      Harmonized.ServerHandler.httpHandler.fetch(sh);

      expect(receivedOptions).toEqual({
        method: 'GET',
        url: 'http://www.hyphe.me/test/resource/'
      });
    });

  });

  describe('push function', function() {

    var sh;
    var receivedOptions;
    var postItem;
    var putItem;
    var deleteItem;

    beforeEach(function() {
      receivedOptions = null;

      spyOn(Harmonized, '_httpFunction').and.callFake(function(options) {
        receivedOptions = options;
        var returnedPromise = {
          then: function(fn) {
            returnedPromise.thenFn = fn;
          }
        };
        var returnedData = {};

        switch (options.method) {
          case 'POST':
            returnedData = _.clone(options.data);
            break;
          case 'PUT':
            returnedData = _.clone(options.data);
            break;
          case 'DELETE':
            returnedData = '';
            break;
        }

        setTimeout(function() {
          returnedPromise.thenFn(returnedData);
        }, 10);

        return returnedPromise;
      });

      sh = {
        downStream: new Rx.Subject(),
        _baseUrl: 'http://www.hyphe.me/',
        _resourcePath: 'test/resource/',
        _options: {}
      };
    });

    beforeEach(function() {
      postItem = {
        meta: {
          action: 'save',
          rtId: 12,
          storeId: 11
        },
        data: {
          name: 'HAL-9000'
        }
      };

      putItem = {
        meta: {
          action: 'save',
          rtId: 12,
          serverId: 4103,
          storeId: 11
        },
        data: {
          name: 'HAL-9000'
        }
      };

      postItem = {
        meta: {
          action: 'delete',
          rtId: 12,
          storeId: 11
        },
        data: {
          name: 'HAL-9000'
        }
      };
    });

    xit('should POST an item', function() {
      var returnedItem = null;

      sh.downStream.subscribe(function(item) {
        returnedItem = item;
      });

      scheduler.scheduleWithAbsolute(5, function() {
        Harmonized.ServerHandler.httpHandler.push(sh, postItem);
        expect(returnedItem).toBeNull();
        jasmine.clock().tick(10);
      });

      scheduler.start();

      expect(receivedOptions).toEqual({
        method: 'POST',
        url: 'http://www.hyphe.me/test/resource/',
        data: {
          name: 'HAL-9000'
        }
      });

      expect(returnedItem).toEqual({
        meta: postItem.meta,
        data: postItem.data
      });
    });

    xit('should POST an item with parameters', function() {
      sh._options.params = {
        openPodBayDoor: false,
        iCantDoThatDave: true
      };

      var returnedItem = null;

      sh.downStream.subscribe(function(item) {
        returnedItem = item;
      });

      scheduler.scheduleWithAbsolute(5, function() {
        Harmonized.ServerHandler.httpHandler.push(sh, postItem);
        expect(returnedItem).toBeNull();
        jasmine.clock().tick(10);
      });

      scheduler.start();

      expect(receivedOptions).toEqual({
        method: 'POST',
        url: 'http://www.hyphe.me/test/resource/',
        data: {
          name: 'HAL-9000'
        },
        params: {
          openPodBayDoor: false,
          iCantDoThatDave: true
        }
      });

      expect(returnedItem).toEqual({
        meta: postItem.meta,
        data: postItem.data
      });
    });

    xit('should PUT an item', function() {
      var returnedItem = null;

      sh.downStream.subscribe(function(item) {
        returnedItem = item;
      });

      scheduler.scheduleWithAbsolute(5, function() {
        Harmonized.ServerHandler.httpHandler.push(sh, putItem);
        expect(returnedItem).toBeNull();
        jasmine.clock().tick(10);
      });

      scheduler.start();

      expect(receivedOptions).toEqual({
        method: 'PUT',
        url: 'http://www.hyphe.me/test/resource/4103/',
        data: {
          name: 'HAL-9000'
        }
      });

      expect(returnedItem).toEqual({
        meta: putItem.meta,
        data: putItem.data
      });
    });

    xit('should PUT an item with parameter', function() {
      sh._options.params = {
        openPodBayDoor: false,
        iCantDoThatDave: true
      };

      var returnedItem = null;

      sh.downStream.subscribe(function(item) {
        returnedItem = item;
      });

      scheduler.scheduleWithAbsolute(5, function() {
        Harmonized.ServerHandler.httpHandler.push(sh, putItem);
        expect(returnedItem).toBeNull();
        jasmine.clock().tick(10);
      });

      scheduler.start();

      expect(receivedOptions).toEqual({
        method: 'PUT',
        url: 'http://www.hyphe.me/test/resource/4103/',
        data: {
          name: 'HAL-9000'
        },
        params: {
          openPodBayDoor: false,
          iCantDoThatDave: true
        }
      });

      expect(returnedItem).toEqual(postItem.data);

      expect(returnedItem).toEqual({
        meta: putItem.meta,
        data: putItem.data
      });
    });

    xit('should DELETE an item', function() {
      var returnedItem = null;

      sh.downStream.subscribe(function(item) {
        returnedItem = item;
      });

      scheduler.scheduleWithAbsolute(5, function() {
        Harmonized.ServerHandler.httpHandler.push(sh, deleteItem);
        expect(returnedItem).toBeNull();
        jasmine.clock().tick(10);
      });

      scheduler.start();

      expect(receivedOptions).toEqual({
        method: 'DELETE',
        url: 'http://www.hyphe.me/test/resource/4103/'
      });

      expect(returnedItem).toEqual({
        meta: deleteItem.meta,
        data: deleteItem.data
      });
    });

    xit('should DELETE an item with parameter', function() {
      sh._options.params = {
        openPodBayDoor: false,
        iCantDoThatDave: true
      };

      var returnedItem = null;

      sh.downStream.subscribe(function(item) {
        returnedItem = item;
      });

      scheduler.scheduleWithAbsolute(5, function() {
        Harmonized.ServerHandler.httpHandler.push(sh, deleteItem);
        expect(returnedItem).toBeNull();
        jasmine.clock().tick(10);
      });

      scheduler.start();

      Harmonized.ServerHandler.httpHandler.push(sh, deleteItem);

      expect(receivedOptions).toEqual({
        method: 'DELETE',
        url: 'http://www.hyphe.me/test/resource/4103/',
        params: {
          openPodBayDoor: false,
          iCantDoThatDave: true
        }
      });

      expect(returnedItem).toEqual({
        meta: deleteItem.meta,
        data: deleteItem.data
      });
    });

    xit('should fail and add item to the unpushedList', function() {

    });

  });

});
