'use strict';

describe('HTTP handler', function() {

  describe('connect function', function() {
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

    xit('should wire the streams correctly', function() {
      var streamWired = false;

      var sh = {
        downStream: new Rx.Subject(),
        _downStreamSubscribe: null
      };

      sh.downStream.subscribe(function(item) {
        streamWired = true;
      });

      scheduler.scheduleWithAbsolute(5, function() {
        Harmonized.ServerHandler.httpHandler.connect(sh);
      });

      scheduler.start();

      expect(streamWired).toBeTruthy();
      expect(sh._downStreamSubscribe instanceof Disposable).toBeTruthy();
    });

  });

  describe('disconnect function', function() {

    xit('should remove the stream connection correctly', function() {
      var sh = {
        downStream: new Rx.Subject()
      };

      sh._downStreamSubscribe = sh.downStream.subscribe(function() {});

      var downStreamSubscribe = sh._downStreamSubscribe;

      spyOn(sh._downStreamSubscribe, 'dispose').and.stub();

      scheduler.scheduleWithAbsolute(5, function() {
        Harmonized.ServerHandler.httpHandler.disconnect(sh);
      });

      scheduler.start();

      expect(streamWired).toBeTruthy();
      expect(downStreamSubscribe.dispose).toHaveBeenCalled();
      expect(sh._downStreamSubscribe).toBe(null);
    });

  });

  describe('fetch function', function() {
    var sh;
    var receivedOptions;

    beforeEach(function() {
      receivedOptions = null;

      spyOn(Harmonized, 'httpFunction').and.callFake(function(options) {
        receivedOptions = options;
      });

      sh = {
        downStream: new Rx.Subject(),
        _baseUrl: 'http://www.hyphe.me/',
        _resourcePath: 'test/resource/',
        _options: {}
      };
    });

    xit('should fetch all data', function() {
      Harmonized.ServerHandler.httpHandler.fetch(sh);

      expect(receivedOptions).toEqual({
        method: 'GET',
        url: 'http://www.hyphe.me/test/resource/'
      });
    });

    xit('should fetch data with "modified-since header"', function() {
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

    xit('should fetch all data with missing last-modified info but activated sendLastModified in config', function() {
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
