module.exports = opts => {
    const defaults = {};
  
    const options = Object.assign({}, defaults, opts);
  
    return {
      before: handler => {
        
        return handler.context.knex.table("config")
        .then(results => {
            var result = {};
            results.forEach(line => result[line.key] = JSON.parse(line.value ))
            handler.context.config = result;
            return;
          });
      },
      after: null,
      onError: null
    };
  };
  