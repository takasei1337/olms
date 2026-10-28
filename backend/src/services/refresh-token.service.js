const supabase = require('../config/supabase');

const {
    generateRefreshToken,
    hashRefreshToken,
    getRefreshTokenExpiresAt
} = require('./token.service')

async function saveRefreshToken(userId, tokenHash, expireAt) {
    const {data, error} = await supabase
    .from('refresh_tokens')
    .insert({
        user_id: userId,
        token_hash: tokenHash,
        expires_at: expireAt
    })
    .select('id')
    .single();
    if (error) throw error;

    return data;
}

async function revokeRefreshToken(tokenId) {
    const {data, error} = await supabase
    .from('refresh_tokens')
    .update({
        revoked_at: new Date().toISOString()
    })
    .eq('id', tokenId)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();
    if (error) throw error;
    if (!data) return;
}

async function revokeAllUserRefreshTokens(userId) {
    const {error} = await supabase
    .from('refresh_tokens')
    .update({revoked_at: new Date().toISOString()})
    .eq('user_id', userId)
    .is('revoked_at', null);

    if (error) throw error;
}

async function issueRefreshToken(userId) {
    const refreshToken = generateRefreshToken();
    const tokenHash = hashRefreshToken(refreshToken);
    const expireAt = getRefreshTokenExpiresAt();

    await saveRefreshToken(userId, tokenHash, expireAt);
    return refreshToken;
}

async function findRefreshTokenByHash(tokenHash) {
    const {data, error} = await supabase
    .from('refresh_tokens')
    .select('id, user_id, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

    if (error) throw error;
    return data;
}

async function rotateRefreshToken(oldTokenId, userId) {
    const newRefreshToken = generateRefreshToken();
    const newTokenHash = hashRefreshToken(newRefreshToken);
    const newExpiresAt = getRefreshTokenExpiresAt();

    const {error} = await supabase
    .rpc('rotate_refresh_token', {
        p_old_token_id: oldTokenId,
        p_user_id: userId,
        p_new_token_hash: newTokenHash,
        p_new_expires_at: newExpiresAt
    });

    if (error) throw error;
    return newRefreshToken;
}

module.exports = {
    saveRefreshToken,
    issueRefreshToken,
    findRefreshTokenByHash,
    revokeRefreshToken,
    rotateRefreshToken,
    revokeAllUserRefreshTokens
};