
/**
 * Module dependencies.
 */

var colors = require('ansis')
var utils = require('./utils')
var repeat = utils.repeat
var truncate = utils.truncate

/**
 * Table constructor
 *
 * @param {Object} options
 * @api public
 */

function Table (options) {
  this.options = utils.options({
    chars: {
      'top': '─',
      'top-mid': '┬',
      'top-left': '┌',
      'top-right': '┐',
      'bottom': '─',
      'bottom-mid': '┴',
      'bottom-left': '└',
      'bottom-right': '┘',
      'left': '│',
      'left-mid': '├',
      'mid': '─',
      'mid-mid': '┼',
      'right': '│',
      'right-mid': '┤',
      'middle': '│'
    },
    truncate: '…',
    colWidths: [],
    colAligns: [],
    style: {
      'padding-left': 1,
      'padding-right': 1,
      head: ['red'],
      border: ['gray'],
      compact: false
    },
    head: []
  }, options)

  if (options.borders == false) {
    this.options.chars =  {
      'top': '',
      'top-mid': '',
      'top-left': '',
      'top-right': '',
      'bottom': '',
      'bottom-mid': '',
      'bottom-left': '',
      'bottom-right': '',
      'left': '',
      'left-mid': '',
      'mid': '',
      'mid-mid': '',
      'right': '',
      'right-mid': '',
      'middle': ''
    }
  }
};

/**
 * Inherit from Array.
 */

Table.prototype = new Array

/**
 * Width getter
 *
 * @return {Number} width
 * @api public
 */

Table.prototype.__defineGetter__('width', function () {
  var str = this.toString().split('\n')
  if (str.length) return str[0].length
  return 0
})

/**
 * Render to a string.
 *
 * @return {String} table representation
 * @api public
 */

Table.prototype.render =
Table.prototype.toString = function () {
  var ret = ''
  var options = this.options
  var style = options.style
  var head = options.head
  var chars = options.chars
  var truncater = options.truncate
  var colWidths = options.colWidths || new Array(this.head.length)
  var totalWidth = 0

  if (!head.length && !this.length) return ''

  if (!colWidths.length) {
    var everyRows = this.slice(0)
    if (head.length) { everyRows = everyRows.concat([head]) };

    everyRows.forEach(function (cells) {
        // horizontal (arrays)
      if (Array.isArray(cells) && cells.length) {
        extractColumnWidths(cells)

        // vertical (objects)
      } else {
        var headerCell = Object.keys(cells)[0]
        var valueCell = cells[headerCell]

        colWidths[0] = Math.max(colWidths[0] || 0, getWidth(headerCell) || 0)

          // cross (objects w/ array values)
        if (Array.isArray(valueCell) && valueCell.length) {
          extractColumnWidths(valueCell, 1)
        } else {
          colWidths[1] = Math.max(colWidths[1] || 0, getWidth(valueCell) || 0)
        }
      }
    })
  };

  totalWidth = (colWidths.length === 1 ? colWidths[0] : colWidths.reduce(
    function (a, b) {
      return a + b
    })) + colWidths.length + 1

  function extractColumnWidths (arr, offset) {
    offset = offset || 0
    arr.forEach(function (cell, i) {
      colWidths[i + offset] = Math.max(colWidths[i + offset] || 0, getWidth(cell) || 0)
    })
  };

  function getWidth (obj) {
    return typeof obj === 'object' && obj && obj.width !== undefined
         ? obj.width
         : ((typeof obj === 'object' && obj !== null ? utils.strlen(obj.text) : utils.strlen(obj)) + (style['padding-left'] || 0) + (style['padding-right'] || 0))
  }

  // draws a line
  function line (line, left, right, intersection) {
    var width = 0
    line = left + repeat(line, totalWidth - 2) + right

    colWidths.forEach(function (w, i) {
      if (i === colWidths.length - 1) return
      width += w + 1
      line = line.substr(0, width) + intersection + line.substr(width + 1)
    })

    return applyStyles(options.style.border, line)
  };

  // draws the top line
  function lineTop () {
    var l = line(chars.top,
               chars['top-left'] || chars.top,
               chars['top-right'] || chars.top,
               chars['top-mid'])
    if (l) {
      ret += l + '\n'
    }
  };

  function generateRow (items, style) {
    var cells = []
    var maxHeight = 0

    // prepare vertical and cross table data
    if (!Array.isArray(items) && typeof items === 'object') {
      var key = Object.keys(items)[0]
      var value = items[key]
      var firstCellHead = true

      if (Array.isArray(value)) {
        items = value
        items.unshift(key)
      } else {
        items = [key, value]
      }
    }

    // transform array of item strings into structure of cells
    items.forEach(function (item, i) {
      var contents = (item === null || item === undefined ? '' : item).toString().split('\n').reduce(function (memo, l) {
        memo.push(string(l, i))
        return memo
      }, [])

      var height = contents.length
      if (height > maxHeight) { maxHeight = height };

      cells.push({ contents: contents, height: height })
    })

    // transform vertical cells into horizontal lines
    var lines = new Array(maxHeight)
    cells.forEach(function (cell, i) {
      cell.contents.forEach(function (line, j) {
        if (!lines[j]) { lines[j] = [] };
        if (style || (firstCellHead && i === 0 && options.style.head)) {
          line = applyStyles(options.style.head, line)
        }

        lines[j].push(line)
      })

      // populate empty lines in cell
      for (var j = cell.height, l = maxHeight; j < l; j++) {
        if (!lines[j]) { lines[j] = [] };
        lines[j].push(string('', i))
      }
    })

    var ret = ''
    lines.forEach(function (line, index) {
      if (ret.length > 0) {
        ret += '\n' + applyStyles(options.style.border, chars.left)
      }

      ret += line.join(applyStyles(options.style.border, chars.middle)) + applyStyles(options.style.border, chars.right)
    })

    return applyStyles(options.style.border, chars.left) + ret
  };

  function applyStyles (styles, subject) {
    if (!subject) {
      return ''
    }

    styles.forEach(function (style) {
      subject = colors[style](subject)
    })

    return subject
  };

  // renders a string, by padding it or truncating it
  function string (str, index) {
    str = String(typeof str === 'object' && str.text ? str.text : str)
    var length = utils.strlen(str)
    var width = colWidths[index] - (style['padding-left'] || 0) - (style['padding-right'] || 0)
    var align = options.colAligns[index] || 'left'

    return repeat(' ', style['padding-left'] || 0) +
         (length === width ? str
             : (length < width
                ? str.padEnd((width + (str.length - length)), ' ', align === 'left' ? 'right'
                  : (align === 'middle' ? 'both' : 'left'))
              : (truncater ? truncate(str, width, truncater) : str))
           ) +
         repeat(' ', style['padding-right'] || 0)
  };

  if (head.length) {
    lineTop()

    ret += generateRow(head, style.head) + '\n'
  }

  if (this.length) {
    this.forEach(function (cells, i) {
      if (!head.length && i === 0) { lineTop() } else {
        if (!style.compact || i < (!!head.length) ? 1 : 0 || cells.length === 0) {
          var l = line(chars.mid
                     , chars['left-mid']
                     , chars['right-mid']
                     , chars['mid-mid'])
          if (l) { ret += l + '\n' }
        }
      }

      if (Array.isArray(cells) && !cells.length) {
        return
      } else {
        ret += generateRow(cells) + '\n'
      };
    })
  }

  var l = line(chars.bottom,
            chars['bottom-left'] || chars.bottom,
            chars['bottom-right'] || chars.bottom,
            chars['bottom-mid'])
  if (l) {
    ret += l
  } else {
    // trim the last '\n' if we didn't add the bottom decoration
    ret = ret.slice(0, -1)
  }

  return ret
}

/**
 * Module exports.
 */

module.exports = Table

module.exports.version = '2.0.0'
