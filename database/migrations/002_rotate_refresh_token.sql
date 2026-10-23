
CREATE OR REPLACE FUNCTION public.rotate_refresh_token(
    p_old_token_id UUID,
    p_user_id UUID,
    p_new_token_hash VARCHAR(64),
    p_new_expires_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    -- 1. Thu hồi Refresh Token cũ nếu còn hợp lệ
    UPDATE public.refresh_tokens
    SET revoked_at = NOW()
    WHERE id = p_old_token_id
      AND user_id = p_user_id
      AND revoked_at IS NULL
      AND expires_at > NOW();

    -- Không thu hồi được thì dừng và báo lỗi
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Refresh Token is invalid or already revoked'
        USING ERRCODE = 'PT401';
    END IF;

    -- 2. Lưu Refresh Token mới
    INSERT INTO public.refresh_tokens (
        user_id,
        token_hash,
        expires_at
    )
    VALUES (
        p_user_id,
        p_new_token_hash,
        p_new_expires_at
    );
END;
$$;

-- Chỉ cho phép backend sử dụng function qua service_role
REVOKE ALL ON FUNCTION public.rotate_refresh_token(
    UUID, UUID, VARCHAR, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.rotate_refresh_token(
    UUID, UUID, VARCHAR, TIMESTAMPTZ
) TO service_role;
