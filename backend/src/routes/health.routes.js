const crypto = require('node:crypto');
const express = require('express');

const router = express.Router();

function resolveTestTargetFingerprint() {
  if (process.env.OLMS_TEST_TARGET_FINGERPRINT) {
    return process.env.OLMS_TEST_TARGET_FINGERPRINT;
  }
  if (process.env.NODE_ENV === 'test' && process.env.SUPABASE_URL) {
    try {
      const host = new URL(process.env.SUPABASE_URL).host.toLowerCase();
      return crypto
        .createHash('sha256')
        .update(`olms-test-target:${host}`)
        .digest('hex')
        .slice(0, 16);
    } catch {
      return null;
    }
  }
  return null;
}

router.get('/health', (req, res) => {
  const fingerprint = resolveTestTargetFingerprint();
  if (fingerprint) {
    res.set('X-OLMS-Target-Fingerprint', fingerprint);
  }
  res.status(200).json({
    status: 'ok',
    service: 'olms-backend'
  });
});

module.exports = router;
