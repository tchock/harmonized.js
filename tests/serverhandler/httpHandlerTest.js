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

    xit('should POST an item without options', function() {

    });

    xit('should POST an item with options', function() {

    });

    xit('should PUT an item without options', function() {

    });

    xit('should PUT an item with options', function() {

    });

    xit('should DELETE an item without options', function() {

    });

    xit('should DELETE an item with options', function() {

    });

    xit('should fail and add item to the unpushedList', function() {

    });

  });

});
