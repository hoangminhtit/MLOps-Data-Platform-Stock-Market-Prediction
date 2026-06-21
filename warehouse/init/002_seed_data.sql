INSERT INTO dim_sector (sector_name)
VALUES
    ('Technology'),
    ('Real Estate'),
    ('Financial Services'),
    ('Consumer Cyclical'),
    ('Consumer Defensive'),
    ('Basic Materials'),
    ('Energy'),
    ('Industrials')
ON CONFLICT (sector_name) DO NOTHING;

WITH seed_company(company_name, exchange, industry, sector_name, symbol) AS (
    VALUES
        ('Vingroup JSC', 'HOSE', 'Conglomerate', 'Real Estate', 'VIC'),
        ('Vinhomes JSC', 'HOSE', 'Residential Development', 'Real Estate', 'VHM'),
        ('Binh Minh Plastics JSC', 'HOSE', 'Building Products', 'Basic Materials', 'BMP'),
        ('VietJet Aviation JSC', 'HOSE', 'Airlines', 'Industrials', 'VJC'),
        ('FPT Digital Retail JSC', 'HOSE', 'Specialty Retail', 'Consumer Cyclical', 'FRT'),
        ('Asia Commercial Bank', 'HOSE', 'Banking', 'Financial Services', 'ACB'),
        ('Becamex IDC Corp', 'HOSE', 'Industrial Real Estate', 'Real Estate', 'BCM'),
        ('BIDV Bank', 'HOSE', 'Banking', 'Financial Services', 'BID'),
        ('VietinBank', 'HOSE', 'Banking', 'Financial Services', 'CTG'),
        ('Duc Giang Chemicals', 'HOSE', 'Chemicals', 'Basic Materials', 'DGC'),
        ('FPT Corporation', 'HOSE', 'Information Technology', 'Technology', 'FPT'),
        ('PetroVietnam Gas', 'HOSE', 'Oil & Gas Midstream', 'Energy', 'GAS'),
        ('Vietnam Rubber Group', 'HOSE', 'Rubber Products', 'Basic Materials', 'GVR'),
        ('HDBank', 'HOSE', 'Banking', 'Financial Services', 'HDB'),
        ('Hoa Phat Group', 'HOSE', 'Steel', 'Basic Materials', 'HPG'),
        ('LienVietPostBank', 'HOSE', 'Banking', 'Financial Services', 'LPB'),
        ('Military Bank', 'HOSE', 'Banking', 'Financial Services', 'MBB'),
        ('Masan Group', 'HOSE', 'Packaged Foods', 'Consumer Defensive', 'MSN'),
        ('Mobile World Group', 'HOSE', 'Electronics Retail', 'Consumer Cyclical', 'MWG'),
        ('Petrolimex', 'HOSE', 'Oil & Gas Refining', 'Energy', 'PLX'),
        ('Sabeco', 'HOSE', 'Beverages', 'Consumer Defensive', 'SAB'),
        ('SHB Bank', 'HOSE', 'Banking', 'Financial Services', 'SHB'),
        ('SeABank', 'HOSE', 'Banking', 'Financial Services', 'SSB'),
        ('Apple Inc.', 'NASDAQ', 'Consumer Electronics', 'Technology', 'AAPL'),
        ('Microsoft Corporation', 'NASDAQ', 'Software', 'Technology', 'MSFT'),
        ('NVIDIA Corporation', 'NASDAQ', 'Semiconductors', 'Technology', 'NVDA')
)
INSERT INTO dim_company (company_name, exchange, industry, sector_id)
SELECT sc.company_name, sc.exchange, sc.industry, ds.sector_id
FROM seed_company sc
JOIN dim_sector ds ON ds.sector_name = sc.sector_name
WHERE NOT EXISTS (
    SELECT 1
    FROM dim_company dc
    WHERE dc.company_name = sc.company_name
      AND dc.exchange = sc.exchange
);

WITH seed_stock(symbol, company_name, exchange) AS (
    VALUES
        ('VIC', 'Vingroup JSC', 'HOSE'),
        ('VHM', 'Vinhomes JSC', 'HOSE'),
        ('BMP', 'Binh Minh Plastics JSC', 'HOSE'),
        ('VJC', 'VietJet Aviation JSC', 'HOSE'),
        ('FRT', 'FPT Digital Retail JSC', 'HOSE'),
        ('ACB', 'Asia Commercial Bank', 'HOSE'),
        ('BCM', 'Becamex IDC Corp', 'HOSE'),
        ('BID', 'BIDV Bank', 'HOSE'),
        ('CTG', 'VietinBank', 'HOSE'),
        ('DGC', 'Duc Giang Chemicals', 'HOSE'),
        ('FPT', 'FPT Corporation', 'HOSE'),
        ('GAS', 'PetroVietnam Gas', 'HOSE'),
        ('GVR', 'Vietnam Rubber Group', 'HOSE'),
        ('HDB', 'HDBank', 'HOSE'),
        ('HPG', 'Hoa Phat Group', 'HOSE'),
        ('LPB', 'LienVietPostBank', 'HOSE'),
        ('MBB', 'Military Bank', 'HOSE'),
        ('MSN', 'Masan Group', 'HOSE'),
        ('MWG', 'Mobile World Group', 'HOSE'),
        ('PLX', 'Petrolimex', 'HOSE'),
        ('SAB', 'Sabeco', 'HOSE'),
        ('SHB', 'SHB Bank', 'HOSE'),
        ('SSB', 'SeABank', 'HOSE'),
        ('AAPL', 'Apple Inc.', 'NASDAQ'),
        ('MSFT', 'Microsoft Corporation', 'NASDAQ'),
        ('NVDA', 'NVIDIA Corporation', 'NASDAQ')
)
INSERT INTO dim_stock (symbol, company_id)
SELECT ss.symbol, dc.company_id
FROM seed_stock ss
JOIN dim_company dc ON dc.company_name = ss.company_name AND dc.exchange = ss.exchange
ON CONFLICT (symbol) DO NOTHING;
