var capnp = require('capnp-ts')
module.exports = toJSON;

function toJSON (capnpObject, struct) {
  if (typeof capnpObject !== 'object' || !capnpObject._capnp) {
    return capnpObject;
  }
  if (Array.isArray(capnpObject)) {
    return capnpObject.map(toJSON);
  }
  struct = struct || capnpObject.constructor;
  let which = capnpObject.which ? capnpObject.which() : -1;
  let unionCapsName = null;
  let unionName = null;

  if (capnpObject.constructor._capnp.displayName.startsWith('List')) {
    return capnpObject.toArray().map((n) => toJSON(n));
  }

  let data = {};

  Object.keys(capnpObject.constructor.prototype).forEach(function (method) {
    if (!method.startsWith('get')) {
      return;
    }
    var name = method.substr(3);
    var capsName = '';
    var wasLower = false;

    for (let i = 0, len = name.length; i < len; ++i) {
      if (name[i].toLowerCase() !== name[i]) {
        if (wasLower) {
          capsName += '_'
        }
        wasLower = false;
      } else {
        wasLower = true;
      }
      capsName += name[i].toUpperCase();
    }

    var camelName = name[0].toLowerCase() + name.substr(1);
    if (which === struct[capsName]) {
      assignGetter(data, camelName, capnpObject, method);
      unionName = name;
      unionCapsName = capsName;
    } else if (struct[capsName] === undefined) {
      assignGetter(data, camelName, capnpObject, method);
    }
  });

  return data;
}

function assignGetter(data, name, capnpObject, method) {
  Object.defineProperty(data, name, {
    enumerable: true,
    configurable: true,
    get: function () {
      var value = capnpObject[method]();
      switch (value.constructor.name) {
        case 'Uint64':
        case 'Int64':
          // just tostring all 64 bit ints
          value = value.toString();
          break;
        case 'Data':
          value = Buffer.from(value.toUint8Array()).toString('base64')
          break;
        case 'Pointer':
          try {
            value = capnp.Text.fromPointer(value).get()
          } catch(err) {
            value = undefined;
          }
          break;
        default:
          value = toJSON(value);
          break;
      }
      Object.defineProperty(data, name, {
        configurable: false,
        writable: false,
        value: value
      });
      return value;
    }
  });
}
