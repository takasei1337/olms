const {findActiveUserById} = require('../services/auth.service');

async function requireAdmin(req, res, next) {
    try {
        const user = await findActiveUserById(req.auth.sub);

        if (!user) {
            return res.status(401).json({
                success: false,
                code: 'INVALID_ACCESS_TOKEN',
                message: 'User does not exist or is inactive.',
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        if (user.role !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                code: 'FORBIDDEN',
                message: 'Admin permission is required.',
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        next();
    } catch (error) {
        next(error);
    }
}

module.exports = requireAdmin;