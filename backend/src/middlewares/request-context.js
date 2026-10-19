const {randomUUID} = require('node:crypto');

function requestContext(req, res, next) {
    req.traceId = `req_${randomUUID()}`;
    next();
}

module.exports = requestContext;