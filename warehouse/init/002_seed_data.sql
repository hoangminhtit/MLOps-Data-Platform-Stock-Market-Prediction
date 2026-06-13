INSERT INTO dim_sector (sector_name)
VALUES ('Technology')
ON CONFLICT (sector_name) DO NOTHING;

INSERT INTO dim_company (company_name, exchange, industry, sector_id)
SELECT 'Apple Inc.', 'NASDAQ', 'Consumer Electronics', sector_id
FROM dim_sector
WHERE sector_name = 'Technology'
  AND NOT EXISTS (
      SELECT 1 FROM dim_company WHERE company_name = 'Apple Inc.' AND exchange = 'NASDAQ'
  );

INSERT INTO dim_company (company_name, exchange, industry, sector_id)
SELECT 'Microsoft Corporation', 'NASDAQ', 'Software', sector_id
FROM dim_sector
WHERE sector_name = 'Technology'
  AND NOT EXISTS (
      SELECT 1 FROM dim_company WHERE company_name = 'Microsoft Corporation' AND exchange = 'NASDAQ'
  );

INSERT INTO dim_company (company_name, exchange, industry, sector_id)
SELECT 'NVIDIA Corporation', 'NASDAQ', 'Semiconductors', sector_id
FROM dim_sector
WHERE sector_name = 'Technology'
  AND NOT EXISTS (
      SELECT 1 FROM dim_company WHERE company_name = 'NVIDIA Corporation' AND exchange = 'NASDAQ'
  );

INSERT INTO dim_stock (symbol, company_id)
SELECT 'AAPL', company_id FROM dim_company WHERE company_name = 'Apple Inc.'
ON CONFLICT (symbol) DO NOTHING;

INSERT INTO dim_stock (symbol, company_id)
SELECT 'MSFT', company_id FROM dim_company WHERE company_name = 'Microsoft Corporation'
ON CONFLICT (symbol) DO NOTHING;

INSERT INTO dim_stock (symbol, company_id)
SELECT 'NVDA', company_id FROM dim_company WHERE company_name = 'NVIDIA Corporation'
ON CONFLICT (symbol) DO NOTHING;
