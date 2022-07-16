exports.handlers = {
    beforeParse: function(e) {
      e.source = e.source.replace(/\/\*\*[\s\S]*?@typedef\s*?{\s*?import[\s\S]*?\*\//gm, '')
    }
  }