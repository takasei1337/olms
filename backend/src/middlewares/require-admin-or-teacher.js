const authService = require('../services/auth.service');

async function requireAdminOrTeacher(req, res, next) {
    try {
        const user = await authService.findActiveUserById(req.auth.sub);

        if (!user) {
            return res.status(401).json({
                success: false,
                code: 'INVALID_ACCESS_TOKEN',
                message: 'User does not exist or is inactive.',
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        if (user.role !== 'ADMIN' && user.role !== 'TEACHER') {
            return res.status(403).json({
                success: false,
                code: 'FORBIDDEN',
                message: 'Admin or Teacher permission is required.',
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        req.currentUser = user;
        next();
    } catch (error) {
        next(error);
    }
}

module.exports = requireAdminOrTeacher;

