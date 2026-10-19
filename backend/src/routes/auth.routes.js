const express = require('express');
const router = express.Router();

router.post('/login', (req, res) => {
   res.status(501).json({
    success: false,
    code: 'NOT_IMPLEMENTED',
    message: 'Login functionality is not implemented yet'
   }) 
});

module.exports = router;