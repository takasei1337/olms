const express = require('express');
const validateLogin = require('../middlewares/validate-login');
const {checkCredentials, findActiveUserById} = require('../services/auth.service')

const {
   generateAccessToken, 
   hashRefreshToken,
   REFRESH_TOKEN_TTL_DAYS
} = require('../services/token.service');

const { 
   issueRefreshToken,
   findRefreshTokenByHash, 
   revokeRefreshToken,
   rotateRefreshToken
} = require('../services/refresh-token.service');

const router = express.Router();
const refreshCookieOptions = {
   httpOnly: true,
   secure: process.env.NODE_ENV === 'production',
   sameSite: 'lax',
   path: '/api/v1/auth',
   maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
};

router.post('/login', validateLogin, async (req, res) => {
   const {username, password} = req.body;
   const user = await checkCredentials(username, password);

   if (!user) {
      return res.status(401).json({
         success: false,
         code: 'INVALID_CREDENTIALS',
         message: 'Tên đăng nhập hoặc mật khẩu không chính xác.',
         trace_id: req.traceId,
         timestamp: new Date().toISOString()
      });
   }

   const safeUser = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      status: user.status
   }

   const accessToken = generateAccessToken(safeUser);
   const refreshToken = await issueRefreshToken(safeUser.id);
   res.cookie('olms_refresh', refreshToken, refreshCookieOptions);

   res.status(200).json({
      success: true,
      data: {
         access_token: accessToken,
         token_type: 'Bearer',
         expires_in: 900,
         user: safeUser
      },
      trace_id: req.traceId,
      timestamp: new Date().toISOString()
   });
});

router.post('/refresh', async (req, res) => {
   const refreshToken = req.cookies?.olms_refresh;
   
   if (!refreshToken) {
      return res.status(401).json({
         success: false,
         code: 'REFRESH_TOKEN_MISSING',
         message: 'Refresh Token is required.',
         trace_id: req.traceId,
         timestamp: new Date().toISOString()
      });
   }

   if (!/^[0-9a-f]{64}$/.test(refreshToken)) {
      return res.status(401).json({
         success: false,
         code: 'INVALID_REFRESH_TOKEN',
         message: 'Refresh Token is invalid.',
         trace_id: req.traceId,
         timestamp: new Date().toISOString()
      });
   }

   const tokenHash = hashRefreshToken(refreshToken);
   const storedToken = await findRefreshTokenByHash(tokenHash);

   if (!storedToken) {
      return res.status(401).json({
         success: false,
         code: 'INVALID_REFRESH_TOKEN',
         message: 'Refresh Token is invalid.',
         trace_id: req.traceId,
         timestamp: new Date().toISOString()
      });
   }

   if (storedToken.revoked_at !== null) {
      return res.status(401).json({
         success: false,
         code: 'INVALID_REFRESH_TOKEN',
         message: 'Refresh Token is invalid.',
         trace_id: req.traceId,
         timestamp: new Date().toISOString()
      });
   }

   if (new Date(storedToken.expires_at).getTime() <= Date.now()) {
      return res.status(401).json({
         success: false,
         code: 'INVALID_REFRESH_TOKEN',
         message: 'Refresh Token is invalid.',
         trace_id: req.traceId,
         timestamp: new Date().toISOString()
      });
   }

   const user = await findActiveUserById(storedToken.user_id);

   if (!user) {
      return res.status(401).json({
         success: false,
         code: 'INVALID_REFRESH_TOKEN',
         message: 'Refresh Token is invalid.',
         trace_id: req.traceId,
         timestamp: new Date().toISOString()
      });
   }

   const accessToken = generateAccessToken(user);
   
   let newRefreshToken;

   try {
      newRefreshToken = await rotateRefreshToken(storedToken.id, user.id);
   } catch (error) {
      if (error.code === 'PT401') {
         return res.status(401).json({
            success: false,
            code: 'INVALID_REFRESH_TOKEN',
            message: 'Refresh Token is invalid.',
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
         });
      }

      throw error;
   }

   res.cookie('olms_refresh', newRefreshToken, refreshCookieOptions);

   return res.status(200).json({
      success: true,
      data: {
         access_token: accessToken,
         token_type: 'Bearer',
         expires_in: 900
      },
      trace_id: req.traceId,
      timestamp: new Date().toISOString()
   });
});

router.post('/logout', async (req, res) => {
   const refreshToken = req.cookies?.olms_refresh;

   res.clearCookie('olms_refresh', {
      path: '/api/v1/auth',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
   });

   if (!refreshToken) {
      return res.status(200).json({
         success: true,
         message: 'Logged out successfully.',
         trace_id: req.traceId,
         timestamp: new Date().toISOString()
      });
   }

   if (!/^[0-9a-f]{64}$/.test(refreshToken)) {
      return res.status(200).json({
         success: true,
         message: 'Logged out successfully.',
         trace_id: req.traceId,
         timestamp: new Date().toISOString()
      });
   }

   const tokenHash = hashRefreshToken(refreshToken);
   const storedToken = await findRefreshTokenByHash(tokenHash);

   if (!storedToken || storedToken.revoked_at !== null) {
      return res.status(200).json({
         success: true,
         message: 'Logged out successfully.',
         trace_id: req.traceId,
         timestamp: new Date().toISOString()
      });
   }

   await revokeRefreshToken(storedToken.id);

   return res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
      trace_id: req.traceId,
      timestamp: new Date().toISOString()
   });
});

module.exports = router;