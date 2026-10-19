const express = require('express');
const validateLogin = require('../middlewares/validate-login');
const router = express.Router();

router.post('/login', validateLogin, (req, res) => {
   res.status(501).json({
    success: false,
    code: 'NOT_IMPLEMENTED',
    message: 'Login functionality is not implemented yet',
    trace_id: req.traceId,
    timestamp: new Date().toISOString()
   }) 
});

module.exports = router;