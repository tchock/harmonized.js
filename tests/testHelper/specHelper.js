'use strict';

function areElementsEqual(actual, expected, comparer) {
    var i, isOk = true;
    comparer || (comparer = Rx.internals.isEqual);
    if (expected.length !== actual.length) {
        return false;
    }
    for (i = 0; i < expected.length; i++) {
        if (!comparer(expected[i], actual[i])) {
            return false;
        }
    }
    return true;
}

var streamMatchers = {
  toHaveEqualElements: function(util, customEqualityTesters) {
    return {
      compare: function(actual, expected) {
        if (_.isUndefined(expected)) {
          expected = [];
        }

        var result = {};
        result.pass = areElementsEqual(actual, expected);

        if (result.pass === false) {
          result.message = 'expected ' + actual + ' to equal ' + expected;
        }

        return result;
      }
    }
  }
}
