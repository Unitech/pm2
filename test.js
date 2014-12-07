var re_literal = /\$\{([^\{\}]+)\}/g,
    re_filters = /^(esc|upper|lower|def\(\'[^\']+\'\)|replace\(\'[^\']+\',\s*\'[^\']*\'(,\s*\'[ig]+\')?\)|substr\(\d+(,\s*\d+)?\)|capitalize)$/;

var filters = {
  esc       : function(){
    return this.value.replace(/([\\\'\"])/g, '\\$1');
  },
  upper     : function(){
    return this.value.toUpperCase();
  },
  lower     : function(){
    return this.value.toLowerCase();
  },
  def       : function(text){
    return this.value.length == 0 ? text : this.value;
  },
  replace   : function(re, text, flags){
    return this.value.replace(new RegExp(re, flags || 'g'), text)
  },
  substr    : function(){
    return String.prototype.substr.apply(this.value, arguments);
  },
  capitalize: function(){
    var l = this.value.length;
    if (l > 0) {
      return this.value[0].toUpperCase() + (l > 1 ? this.value.substr(1).toLowerCase() : '');
    }
  }
};

var defineProps = Object.defineProperties;

function wrapProtos(store){
  var ps = {};
  Object.keys(filters).forEach(function(key){
    ps[key] = {
      get: function(){
        return build(this.value, (store ? this._filters : []).concat(key));
      }
    };
  });
  return ps;
}
var proto = defineProps(function P(){
}, wrapProtos(true));

function build(val, _filters){
  var builder = function(){
    return applyFilter.apply(builder, arguments);
  };

  builder.value = val;
  builder._filters = _filters;
  builder.__proto__ = proto;
  return builder;
}

function applyFilter(){
  var filter = this._filters.shift();
  while (filter) {
    this.value = filters[filter].apply(this, arguments);
    filter = this._filters.shift()
  }
  return this;
}

function SubsFilter(val){
  if (!(this instanceof SubsFilter)) {
    return new SubsFilter(val);
  }
  this.value = val;
};

defineProps(SubsFilter.prototype, wrapProtos());

/**
 * Literal substitutions
 * @param text
 * @param data
 * @returns {*|XML|string|void}
 * @constructor
 */
function Subs(text, data){
  if(!re_literal.test(text)){
    return text;
  }
  return text.replace(re_literal, function(match, content, position){
    var cts = content.split('|').map(function(c){
      return c.trim();
    });
    if (cts.length <= 0) {
      return '';
    }
    if (cts.length == 1) {
      return data[cts[0]] || '';
    }

    var val = data[cts.shift()] || '';

    var methods = [];
    cts.forEach(function(c){
      re_filters.test(c) && methods.push(c);
    })

    if (methods.length == 0) {
      return val;
    }

    var funcStr = 'return fn(val).' + methods.join('.');
    if(!/\)$/.test(funcStr)){
      funcStr += '()';
    }
    var fn = new Function('val', 'fn', funcStr + '.value');
    return fn(val, SubsFilter);
  });
};


var str = "${ name | replace('-\\\\w+$', '') }.pid";
var result = Subs(str, {
  name    : 'first-log'
});

console.log(result);
