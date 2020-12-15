"use strict";

function parseUrlQuery () {
  const data = {
    seed: null
  };

  document.location.search.split(/[?&]/g).map(function(option) {
    option = option.split('=');

    switch (option[0]) {
      case 'seed':
        data.seed = Math.min(9999999, Math.max(60, Math.abs(option[1]|0)));
        break;
    }
  });

  return data;
}

module.exports = parseUrlQuery;