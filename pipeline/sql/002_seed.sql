-- ============================================================================
--  Reference data. Idempotent: safe to re-run on every deploy.
--  Areas and populations are the INSEE 2021 figures for the 20 arrondissements.
-- ============================================================================

USE paris_fraicheur;

INSERT INTO sources (slug, label, is_required) VALUES
  ('fontaines-a-boire',                        'Fontaines a boire',        TRUE),
  ('espaces_verts',                            'Espaces verts',            TRUE),
  ('ilots-de-fraicheur-equipements-activites', 'Equipements et activites', FALSE)
AS new
ON DUPLICATE KEY UPDATE
  label       = new.label,
  is_required = new.is_required;

INSERT INTO arrondissements (code, number, label, name, area_km2, population) VALUES
  ('75001',  1,  '1er', 'Louvre',                   1.826,  16266),
  ('75002',  2,  '2e',  'Bourse',                   0.992,  20796),
  ('75003',  3,  '3e',  'Temple',                   1.171,  34115),
  ('75004',  4,  '4e',  'Hotel-de-Ville',           1.601,  28088),
  ('75005',  5,  '5e',  'Pantheon',                 2.541,  58850),
  ('75006',  6,  '6e',  'Luxembourg',               2.154,  40916),
  ('75007',  7,  '7e',  'Palais-Bourbon',           4.088,  50434),
  ('75008',  8,  '8e',  'Elysee',                   3.881,  36453),
  ('75009',  9,  '9e',  'Opera',                    2.179,  59629),
  ('75010', 10,  '10e', 'Entrepot',                 2.892,  88148),
  ('75011', 11,  '11e', 'Popincourt',               3.666, 145184),
  ('75012', 12,  '12e', 'Reuilly',                 16.324, 141494),
  ('75013', 13,  '13e', 'Gobelins',                 7.146, 178493),
  ('75014', 14,  '14e', 'Observatoire',             5.621, 133428),
  ('75015', 15,  '15e', 'Vaugirard',                8.502, 231301),
  ('75016', 16,  '16e', 'Passy',                   16.305, 165446),
  ('75017', 17,  '17e', 'Batignolles-Monceau',      5.669, 167288),
  ('75018', 18,  '18e', 'Buttes-Montmartre',        6.005, 191135),
  ('75019', 19,  '19e', 'Buttes-Chaumont',          6.786, 184870),
  ('75020', 20,  '20e', 'Menilmontant',             5.984, 191772)
AS new
ON DUPLICATE KEY UPDATE
  label      = new.label,
  name       = new.name,
  area_km2   = new.area_km2,
  population = new.population;
