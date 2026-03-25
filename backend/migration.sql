-- =====================================
-- SAINT PRICE: ATOMIC REBUILD & REFRESH
-- =====================================

-- 1. Empezar de cero (con cuidado)
DROP TABLE IF EXISTS public.transactions;

-- 2. Crear tabla con nombres de columna ultra-estables
CREATE TABLE public.transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount NUMERIC(12, 2) NOT NULL,
    category TEXT NOT NULL,
    memo TEXT NOT NULL,          -- Renombrado de 'description'
    txn_time NUMERIC NOT NULL,   -- Renombrado de 'timestamp'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Permisos explícitos (Crucial para Supabase/PostgREST)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Garantizar que los roles de Supabase puedan ver y tocar las tablas
GRANT ALL ON TABLE public.users TO anon, authenticated, service_role;
GRANT ALL ON SEQUENCE public.users_id_seq TO anon, authenticated, service_role;

GRANT ALL ON TABLE public.transactions TO anon, authenticated, service_role;
GRANT ALL ON SEQUENCE public.transactions_id_seq TO anon, authenticated, service_role;

-- 4. Política de acceso total (El backend filtra los datos)
CREATE POLICY "Full access with backend control" ON public.transactions
    FOR ALL USING (true) WITH CHECK (true);

-- 5. Señal de recarga de esquema
NOTIFY pgrst, 'reload schema';
