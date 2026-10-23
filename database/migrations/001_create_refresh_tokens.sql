
CREATE TABLE IF NOT EXISTS public.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES public.users(id),

    token_hash VARCHAR(64) NOT NULL UNIQUE,

    expires_at TIMESTAMPTZ NOT NULL,

    revoked_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_refresh_tokens_expiry
        CHECK (expires_at > created_at),

    CONSTRAINT chk_refresh_tokens_hash_format
        CHECK (token_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id
ON public.refresh_tokens (user_id);

ALTER TABLE public.refresh_tokens
ENABLE ROW LEVEL SECURITY;
