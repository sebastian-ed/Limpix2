-- ============================================================
--  LIMPIX – Supabase SQL Setup
--  Pegá esto en: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- 1. TABLA: providers
-- ============================================================
CREATE TABLE IF NOT EXISTS providers (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),

  name          TEXT NOT NULL,
  zone          TEXT NOT NULL,
  description   TEXT NOT NULL,           -- short, for cards
  about         TEXT,                    -- long, for profile
  whatsapp      TEXT NOT NULL,           -- e.g. 5491123456789
  email         TEXT,
  years_experience INTEGER,

  categories    TEXT[],                  -- array: ['Hogareña', 'Profunda']
  price_from    INTEGER,                 -- ARS
  price_to      INTEGER,                 -- ARS (optional)
  extra_info    JSONB DEFAULT '[]',      -- [{key, value}, ...]

  avatar_url    TEXT,
  color         TEXT DEFAULT '#00897b',  -- fallback avatar color
  gallery       TEXT[] DEFAULT '{}',     -- array of image URLs

  active        BOOLEAN DEFAULT true,
  featured      BOOLEAN DEFAULT false,

  -- Legacy / computed fields (optional)
  rating        NUMERIC(3,2) DEFAULT 0,
  review_count  INTEGER DEFAULT 0
);

-- 2. TABLA: reviews
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at    TIMESTAMPTZ DEFAULT now(),

  provider_id   UUID REFERENCES providers(id) ON DELETE CASCADE,
  author_name   TEXT NOT NULL,
  rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text          TEXT NOT NULL,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- 3. ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_providers_active ON providers(active);
CREATE INDEX IF NOT EXISTS idx_reviews_provider ON reviews(provider_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);

-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Providers: lectura pública solo de activos
DROP POLICY IF EXISTS "providers_select_active" ON providers;
CREATE POLICY "providers_select_active" ON providers
  FOR SELECT USING (active = true OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "providers_insert_authenticated" ON providers;
CREATE POLICY "providers_insert_authenticated" ON providers
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "providers_update_authenticated" ON providers;
CREATE POLICY "providers_update_authenticated" ON providers
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "providers_delete_authenticated" ON providers;
CREATE POLICY "providers_delete_authenticated" ON providers
  FOR DELETE USING (auth.role() = 'authenticated');

-- Reviews: lectura pública aprobadas, admins ven todo
DROP POLICY IF EXISTS "reviews_select_approved" ON reviews;
CREATE POLICY "reviews_select_approved" ON reviews
  FOR SELECT USING (status = 'approved' OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "reviews_insert_anyone" ON reviews;
CREATE POLICY "reviews_insert_anyone" ON reviews
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "reviews_update_authenticated" ON reviews;
CREATE POLICY "reviews_update_authenticated" ON reviews
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "reviews_delete_authenticated" ON reviews;
CREATE POLICY "reviews_delete_authenticated" ON reviews
  FOR DELETE USING (auth.role() = 'authenticated');

-- 5. FUNCIÓN: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON providers;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
--  DATOS DE EJEMPLO (opcional, borrá si no querés demo data)
-- ============================================================
INSERT INTO providers (name, zone, description, about, whatsapp, email, categories, price_from, price_to, color, active, featured, years_experience)
VALUES
  (
    'CleanPro Buenos Aires',
    'CABA y GBA Norte',
    'Equipo de 8 profesionales con más de 5 años de experiencia en limpieza hogareña y profunda.',
    'Somos un equipo apasionado por los espacios limpios. Fundados en 2019, trabajamos con productos certificados y personal entrenado. Cobertura completa en CABA y GBA Norte.',
    '5491123456789',
    'contacto@cleanpro.com.ar',
    ARRAY['Limpieza hogareña', 'Limpieza profunda', 'Mudanza'],
    15000, 50000,
    '#00897b',
    true, true, 5
  ),
  (
    'Brillante Argentina',
    'CABA – Microcentro y alrededores',
    'Especialistas en oficinas y espacios comerciales. Certificados en manejo de productos ecológicos.',
    'Más de 7 años de experiencia en limpieza corporativa. Trabajamos con contratos mensuales y servicios puntuales.',
    '5491198765432',
    'info@brillante.com.ar',
    ARRAY['Limpieza de oficinas', 'Post-obra', 'Industrial'],
    12500, 80000,
    '#2196f3',
    true, false, 7
  ),
  (
    'SparkleTeam',
    'GBA Sur y Centro',
    'Servicio premium con productos biodegradables. Certificadas en limpieza hipoalergénica. Ideal para familias.',
    'Equipo 100% femenino especializado en hogares. Usamos exclusivamente productos ecológicos y seguros para niños y mascotas.',
    '5491555555555',
    'hola@sparkleteam.com.ar',
    ARRAY['Limpieza hogareña', 'Limpieza profunda', 'Servicio de mucama', 'Limpieza ecológica'],
    20000, 60000,
    '#e91e63',
    true, false, 4
  );

-- Reseñas de ejemplo
INSERT INTO reviews (provider_id, author_name, rating, text, status)
SELECT id, 'María González', 5, 'Excelente servicio, quedó todo impecable. Muy puntuales y profesionales.', 'approved'
FROM providers WHERE name = 'CleanPro Buenos Aires' LIMIT 1;

INSERT INTO reviews (provider_id, author_name, rating, text, status)
SELECT id, 'Carlos Méndez', 5, 'Contraté para post-obra y el resultado fue increíble. Super recomendable.', 'approved'
FROM providers WHERE name = 'CleanPro Buenos Aires' LIMIT 1;

INSERT INTO reviews (provider_id, author_name, rating, text, status)
SELECT id, 'Laura Pérez', 4, 'Muy buen trabajo en nuestras oficinas. Puntuales y prolijos.', 'approved'
FROM providers WHERE name = 'Brillante Argentina' LIMIT 1;
