-- All four catalogue defaults use public.hmc_records; no separate catalogue tables.
-- Run as the database owner in Supabase SQL Editor after the base schema exists.
-- Generated with: node scripts/generate-catalogue-sql.cjs
-- Re-running preserves existing rows, including renamed, inactive and deleted entries.
-- Patient records, payments, prescriptions and legacy customMedicines are unchanged.

begin;

do $$
begin
  if to_regclass('public.hmc_records') is null then
    raise exception 'Run supabase/schema.sql first to create the shared record tables and CRUD functions.';
  end if;
end;
$$;

insert into public.hmc_records (collection, record_id, data, sort_order)
values
  ('procedures', 'default-1', '{"id":"default-1","name":"Left nephrectomy","active":true}'::jsonb, 0),
  ('procedures', 'default-2', '{"id":"default-2","name":"Right nephrectomy","active":true}'::jsonb, 1),
  ('procedures', 'default-3', '{"id":"default-3","name":"Right pyelolithotomy","active":true}'::jsonb, 2),
  ('procedures', 'default-4', '{"id":"default-4","name":"Left pyelolithotomy","active":true}'::jsonb, 3),
  ('procedures', 'default-5', '{"id":"default-5","name":"IOU","active":true}'::jsonb, 4),
  ('procedures', 'default-6', '{"id":"default-6","name":"Cystoscopy","active":true}'::jsonb, 5),
  ('procedures', 'default-7', '{"id":"default-7","name":"Cystolithotomy","active":true}'::jsonb, 6),
  ('procedures', 'default-8', '{"id":"default-8","name":"Cystolitholopaxy","active":true}'::jsonb, 7),
  ('procedures', 'default-9', '{"id":"default-9","name":"Right URS L/C + DJS","active":true}'::jsonb, 8),
  ('procedures', 'default-10', '{"id":"default-10","name":"Left URS L/C + DJS","active":true}'::jsonb, 9),
  ('procedures', 'default-11', '{"id":"default-11","name":"B/L URS L/C + DJS","active":true}'::jsonb, 10),
  ('procedures', 'default-12', '{"id":"default-12","name":"Right ureterolithotomy","active":true}'::jsonb, 11),
  ('procedures', 'default-13', '{"id":"default-13","name":"Left ureterolithotomy","active":true}'::jsonb, 12),
  ('procedures', 'default-14', '{"id":"default-14","name":"Pyeloplasty (right or left)","active":true}'::jsonb, 13)
on conflict (collection, record_id) do nothing;

insert into public.hmc_records (collection, record_id, data, sort_order)
values
  ('rooms', 'default-1', '{"id":"default-1","name":"Room 1","active":true}'::jsonb, 0),
  ('rooms', 'default-2', '{"id":"default-2","name":"Room 2","active":true}'::jsonb, 1),
  ('rooms', 'default-3', '{"id":"default-3","name":"GW Bed 1","active":true}'::jsonb, 2),
  ('rooms', 'default-4', '{"id":"default-4","name":"GW Bed 2","active":true}'::jsonb, 3)
on conflict (collection, record_id) do nothing;

insert into public.hmc_records (collection, record_id, data, sort_order)
values
  ('prescriptionMedicineCatalog', 'default:mixel', '{"id":"default:mixel","name":"MIXEL","active":true}'::jsonb, 0),
  ('prescriptionMedicineCatalog', 'default:polymalt-f', '{"id":"default:polymalt-f","name":"POLYMALT-F","active":true}'::jsonb, 1),
  ('prescriptionMedicineCatalog', 'default:qsarten', '{"id":"default:qsarten","name":"QSARTEN","active":true}'::jsonb, 2),
  ('prescriptionMedicineCatalog', 'default:mediton', '{"id":"default:mediton","name":"MEDITON","active":true}'::jsonb, 3),
  ('prescriptionMedicineCatalog', 'default:cycin', '{"id":"default:cycin","name":"CYCIN","active":true}'::jsonb, 4),
  ('prescriptionMedicineCatalog', 'default:dayfort', '{"id":"default:dayfort","name":"DAYFORT","active":true}'::jsonb, 5),
  ('prescriptionMedicineCatalog', 'default:dypime', '{"id":"default:dypime","name":"DYPIME","active":true}'::jsonb, 6),
  ('prescriptionMedicineCatalog', 'default:vinzet', '{"id":"default:vinzet","name":"VINZET","active":true}'::jsonb, 7),
  ('prescriptionMedicineCatalog', 'default:molam', '{"id":"default:molam","name":"MOLAM","active":true}'::jsonb, 8),
  ('prescriptionMedicineCatalog', 'default:cebect', '{"id":"default:cebect","name":"CEBECT","active":true}'::jsonb, 9),
  ('prescriptionMedicineCatalog', 'default:mevet', '{"id":"default:mevet","name":"MEVET","active":true}'::jsonb, 10),
  ('prescriptionMedicineCatalog', 'default:militrium', '{"id":"default:militrium","name":"MILITRIUM","active":true}'::jsonb, 11),
  ('prescriptionMedicineCatalog', 'default:kineton', '{"id":"default:kineton","name":"KINETON","active":true}'::jsonb, 12),
  ('prescriptionMedicineCatalog', 'default:ectafin', '{"id":"default:ectafin","name":"ECTAFIN","active":true}'::jsonb, 13),
  ('prescriptionMedicineCatalog', 'default:abbacus', '{"id":"default:abbacus","name":"ABBACUS","active":true}'::jsonb, 14),
  ('prescriptionMedicineCatalog', 'default:azitma', '{"id":"default:azitma","name":"AZITMA","active":true}'::jsonb, 15),
  ('prescriptionMedicineCatalog', 'default:onato', '{"id":"default:onato","name":"ONATO","active":true}'::jsonb, 16),
  ('prescriptionMedicineCatalog', 'default:tpenta%20ir', '{"id":"default:tpenta%20ir","name":"TPENTA IR","active":true}'::jsonb, 17),
  ('prescriptionMedicineCatalog', 'default:montika', '{"id":"default:montika","name":"MONTIKA","active":true}'::jsonb, 18),
  ('prescriptionMedicineCatalog', 'default:peridone', '{"id":"default:peridone","name":"PERIDONE","active":true}'::jsonb, 19),
  ('prescriptionMedicineCatalog', 'default:mofest', '{"id":"default:mofest","name":"MOFEST","active":true}'::jsonb, 20),
  ('prescriptionMedicineCatalog', 'default:oxidil', '{"id":"default:oxidil","name":"OXIDIL","active":true}'::jsonb, 21),
  ('prescriptionMedicineCatalog', 'default:nivador', '{"id":"default:nivador","name":"NIVADOR","active":true}'::jsonb, 22),
  ('prescriptionMedicineCatalog', 'default:lacasil', '{"id":"default:lacasil","name":"LACASIL","active":true}'::jsonb, 23),
  ('prescriptionMedicineCatalog', 'default:trimetabol', '{"id":"default:trimetabol","name":"TRIMETABOL","active":true}'::jsonb, 24),
  ('prescriptionMedicineCatalog', 'default:slate', '{"id":"default:slate","name":"SLATE","active":true}'::jsonb, 25),
  ('prescriptionMedicineCatalog', 'default:caricef', '{"id":"default:caricef","name":"CARICEF","active":true}'::jsonb, 26),
  ('prescriptionMedicineCatalog', 'default:brino', '{"id":"default:brino","name":"BRINO","active":true}'::jsonb, 27),
  ('prescriptionMedicineCatalog', 'default:emflox', '{"id":"default:emflox","name":"EMFLOX","active":true}'::jsonb, 28),
  ('prescriptionMedicineCatalog', 'default:solplus', '{"id":"default:solplus","name":"SOLPLUS","active":true}'::jsonb, 29),
  ('prescriptionMedicineCatalog', 'default:cyntol', '{"id":"default:cyntol","name":"CYNTOL","active":true}'::jsonb, 30),
  ('prescriptionMedicineCatalog', 'default:prujex', '{"id":"default:prujex","name":"PRUJEX","active":true}'::jsonb, 31),
  ('prescriptionMedicineCatalog', 'default:diricin', '{"id":"default:diricin","name":"DIRICIN","active":true}'::jsonb, 32),
  ('prescriptionMedicineCatalog', 'default:molox', '{"id":"default:molox","name":"MOLOX","active":true}'::jsonb, 33),
  ('prescriptionMedicineCatalog', 'default:levocil', '{"id":"default:levocil","name":"LEVOCIL","active":true}'::jsonb, 34),
  ('prescriptionMedicineCatalog', 'default:helowic', '{"id":"default:helowic","name":"HELOWIC","active":true}'::jsonb, 35),
  ('prescriptionMedicineCatalog', 'default:lacasia', '{"id":"default:lacasia","name":"LACASIA","active":true}'::jsonb, 36),
  ('prescriptionMedicineCatalog', 'default:acasia', '{"id":"default:acasia","name":"ACASIA","active":true}'::jsonb, 37),
  ('prescriptionMedicineCatalog', 'default:realoza%20dr', '{"id":"default:realoza%20dr","name":"REALOZA DR","active":true}'::jsonb, 38),
  ('prescriptionMedicineCatalog', 'default:bactcid', '{"id":"default:bactcid","name":"BACTCID","active":true}'::jsonb, 39),
  ('prescriptionMedicineCatalog', 'default:deebo', '{"id":"default:deebo","name":"DEEBO","active":true}'::jsonb, 40),
  ('prescriptionMedicineCatalog', 'default:xetoplus', '{"id":"default:xetoplus","name":"XETOPLUS","active":true}'::jsonb, 41),
  ('prescriptionMedicineCatalog', 'default:ovelcin', '{"id":"default:ovelcin","name":"OVELCIN","active":true}'::jsonb, 42),
  ('prescriptionMedicineCatalog', 'default:laxcell', '{"id":"default:laxcell","name":"LAXCELL","active":true}'::jsonb, 43),
  ('prescriptionMedicineCatalog', 'default:mofloten', '{"id":"default:mofloten","name":"MOFLOTEN","active":true}'::jsonb, 44),
  ('prescriptionMedicineCatalog', 'default:ketocell', '{"id":"default:ketocell","name":"KETOCELL","active":true}'::jsonb, 45),
  ('prescriptionMedicineCatalog', 'default:uristat', '{"id":"default:uristat","name":"URISTAT","active":true}'::jsonb, 46),
  ('prescriptionMedicineCatalog', 'default:zantum', '{"id":"default:zantum","name":"ZANTUM","active":true}'::jsonb, 47),
  ('prescriptionMedicineCatalog', 'default:mirabet', '{"id":"default:mirabet","name":"MIRABET","active":true}'::jsonb, 48),
  ('prescriptionMedicineCatalog', 'default:vtig%20plus', '{"id":"default:vtig%20plus","name":"VTIG PLUS","active":true}'::jsonb, 49),
  ('prescriptionMedicineCatalog', 'default:vezitic', '{"id":"default:vezitic","name":"VEZITIC","active":true}'::jsonb, 50),
  ('prescriptionMedicineCatalog', 'default:ketoride', '{"id":"default:ketoride","name":"KETORIDE","active":true}'::jsonb, 51),
  ('prescriptionMedicineCatalog', 'default:maxflow', '{"id":"default:maxflow","name":"MAXFLOW","active":true}'::jsonb, 52),
  ('prescriptionMedicineCatalog', 'default:maxflow-d', '{"id":"default:maxflow-d","name":"MAXFLOW-D","active":true}'::jsonb, 53),
  ('prescriptionMedicineCatalog', 'default:ezumac', '{"id":"default:ezumac","name":"EZUMAC","active":true}'::jsonb, 54),
  ('prescriptionMedicineCatalog', 'default:cystalgon', '{"id":"default:cystalgon","name":"CYSTALGON","active":true}'::jsonb, 55),
  ('prescriptionMedicineCatalog', 'default:calamox', '{"id":"default:calamox","name":"CALAMOX","active":true}'::jsonb, 56),
  ('prescriptionMedicineCatalog', 'default:pregy', '{"id":"default:pregy","name":"PREGY","active":true}'::jsonb, 57),
  ('prescriptionMedicineCatalog', 'default:effiflox', '{"id":"default:effiflox","name":"EFFIFLOX","active":true}'::jsonb, 58),
  ('prescriptionMedicineCatalog', 'default:novidate', '{"id":"default:novidate","name":"NOVIDATE","active":true}'::jsonb, 59),
  ('prescriptionMedicineCatalog', 'default:tonoflex-p', '{"id":"default:tonoflex-p","name":"TONOFLEX-P","active":true}'::jsonb, 60),
  ('prescriptionMedicineCatalog', 'default:2sum', '{"id":"default:2sum","name":"2SUM","active":true}'::jsonb, 61),
  ('prescriptionMedicineCatalog', 'default:antial', '{"id":"default:antial","name":"ANTIAL","active":true}'::jsonb, 62),
  ('prescriptionMedicineCatalog', 'default:orglu', '{"id":"default:orglu","name":"ORGLU","active":true}'::jsonb, 63),
  ('prescriptionMedicineCatalog', 'default:ontive', '{"id":"default:ontive","name":"ONTIVE","active":true}'::jsonb, 64),
  ('prescriptionMedicineCatalog', 'default:silidate', '{"id":"default:silidate","name":"SILIDATE","active":true}'::jsonb, 65),
  ('prescriptionMedicineCatalog', 'default:itp', '{"id":"default:itp","name":"ITP","active":true}'::jsonb, 66),
  ('prescriptionMedicineCatalog', 'default:dicloran', '{"id":"default:dicloran","name":"DICLORAN","active":true}'::jsonb, 67),
  ('prescriptionMedicineCatalog', 'default:kinz', '{"id":"default:kinz","name":"KINZ","active":true}'::jsonb, 68),
  ('prescriptionMedicineCatalog', 'default:sildoso', '{"id":"default:sildoso","name":"SILDOSO","active":true}'::jsonb, 69),
  ('prescriptionMedicineCatalog', 'default:vitig%20plus', '{"id":"default:vitig%20plus","name":"VITIG PLUS","active":true}'::jsonb, 70),
  ('prescriptionMedicineCatalog', 'default:vitig', '{"id":"default:vitig","name":"VITIG","active":true}'::jsonb, 71),
  ('prescriptionMedicineCatalog', 'default:c-one', '{"id":"default:c-one","name":"C-ONE","active":true}'::jsonb, 72),
  ('prescriptionMedicineCatalog', 'default:urizak', '{"id":"default:urizak","name":"URIZAK","active":true}'::jsonb, 73),
  ('prescriptionMedicineCatalog', 'default:bone-care', '{"id":"default:bone-care","name":"BONE-CARE","active":true}'::jsonb, 74),
  ('prescriptionMedicineCatalog', 'default:ferro-one', '{"id":"default:ferro-one","name":"FERRO-ONE","active":true}'::jsonb, 75),
  ('prescriptionMedicineCatalog', 'default:mequine', '{"id":"default:mequine","name":"MEQUINE","active":true}'::jsonb, 76),
  ('prescriptionMedicineCatalog', 'default:quspar', '{"id":"default:quspar","name":"QUSPAR","active":true}'::jsonb, 77),
  ('prescriptionMedicineCatalog', 'default:bone-care-c', '{"id":"default:bone-care-c","name":"BONE-CARE-C","active":true}'::jsonb, 78),
  ('prescriptionMedicineCatalog', 'default:balatine', '{"id":"default:balatine","name":"BALATINE","active":true}'::jsonb, 79),
  ('prescriptionMedicineCatalog', 'default:carneo', '{"id":"default:carneo","name":"CARNEO","active":true}'::jsonb, 80),
  ('prescriptionMedicineCatalog', 'default:esoin', '{"id":"default:esoin","name":"ESOIN","active":true}'::jsonb, 81),
  ('prescriptionMedicineCatalog', 'default:nubrel-forte', '{"id":"default:nubrel-forte","name":"NUBREL-FORTE","active":true}'::jsonb, 82),
  ('prescriptionMedicineCatalog', 'default:bruffen', '{"id":"default:bruffen","name":"BRUFFEN","active":true}'::jsonb, 83),
  ('prescriptionMedicineCatalog', 'default:sangibon', '{"id":"default:sangibon","name":"SANGIBON","active":true}'::jsonb, 84),
  ('prescriptionMedicineCatalog', 'default:gavacison', '{"id":"default:gavacison","name":"GAVACISON","active":true}'::jsonb, 85),
  ('prescriptionMedicineCatalog', 'default:palmonive', '{"id":"default:palmonive","name":"PALMONIVE","active":true}'::jsonb, 86),
  ('prescriptionMedicineCatalog', 'default:citralka', '{"id":"default:citralka","name":"CITRALKA","active":true}'::jsonb, 87),
  ('prescriptionMedicineCatalog', 'default:toralac', '{"id":"default:toralac","name":"TORALAC","active":true}'::jsonb, 88),
  ('prescriptionMedicineCatalog', 'default:provas', '{"id":"default:provas","name":"PROVAS","active":true}'::jsonb, 89)
on conflict (collection, record_id) do nothing;

insert into public.hmc_records (collection, record_id, data, sort_order)
values
  ('otMedicineCatalog', 'default:inj.%20avil', '{"id":"default:inj.%20avil","name":"INJ. AVIL","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 0),
  ('otMedicineCatalog', 'default:inj.%20decadron', '{"id":"default:inj.%20decadron","name":"INJ. DECADRON","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 1),
  ('otMedicineCatalog', 'default:inj.%20dermocuim', '{"id":"default:inj.%20dermocuim","name":"INJ. DERMOCUIM","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 2),
  ('otMedicineCatalog', 'default:inj.%20atropine', '{"id":"default:inj.%20atropine","name":"INJ. ATROPINE","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 3),
  ('otMedicineCatalog', 'default:inj.%20tramadol', '{"id":"default:inj.%20tramadol","name":"INJ. TRAMADOL","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 4),
  ('otMedicineCatalog', 'default:inj.%20torlac', '{"id":"default:inj.%20torlac","name":"INJ. TORLAC","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 5),
  ('otMedicineCatalog', 'default:inj.%20kinz', '{"id":"default:inj.%20kinz","name":"INJ. KINZ","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 6),
  ('otMedicineCatalog', 'default:inj.%20oxytocin', '{"id":"default:inj.%20oxytocin","name":"INJ. OXYTOCIN","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 7),
  ('otMedicineCatalog', 'default:inj.%20ibuprofen%20sp', '{"id":"default:inj.%20ibuprofen%20sp","name":"INJ. IBUPROFEN SP","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 8),
  ('otMedicineCatalog', 'default:inj.%20tranexamine%20500mg', '{"id":"default:inj.%20tranexamine%20500mg","name":"INJ. TRANEXAMINE 500MG","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 9),
  ('otMedicineCatalog', 'default:insulin%20contaf%20250mg', '{"id":"default:insulin%20contaf%20250mg","name":"INSULIN CONTAF 250MG","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 10),
  ('otMedicineCatalog', 'default:inj.%20gentamicane%2040mg', '{"id":"default:inj.%20gentamicane%2040mg","name":"INJ. GENTAMICANE 40MG","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 11),
  ('otMedicineCatalog', 'default:inj.%20ketsol%20100mg', '{"id":"default:inj.%20ketsol%20100mg","name":"INJ. KETSOL 100MG","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 12),
  ('otMedicineCatalog', 'default:inj.%20sodium%20bicarba%2025ml', '{"id":"default:inj.%20sodium%20bicarba%2025ml","name":"INJ. SODIUM BICARBA 25ML","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 13),
  ('otMedicineCatalog', 'default:inj.%20flugel%20100ml', '{"id":"default:inj.%20flugel%20100ml","name":"INJ. FLUGEL 100ML","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 14),
  ('otMedicineCatalog', 'default:inj.%20provas%20infusion%20100ml', '{"id":"default:inj.%20provas%20infusion%20100ml","name":"INJ. PROVAS INFUSION 100ML","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 15),
  ('otMedicineCatalog', 'default:inj.%20hamilc%20500ml', '{"id":"default:inj.%20hamilc%20500ml","name":"INJ. HAMILC 500ML","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 16),
  ('otMedicineCatalog', 'default:inj.%20hamicl%20500ml', '{"id":"default:inj.%20hamicl%20500ml","name":"INJ. HAMICL 500ML","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 17),
  ('otMedicineCatalog', 'default:inj.%205%25%20d%2Fw%201000ml', '{"id":"default:inj.%205%25%20d%2Fw%201000ml","name":"INJ. 5% D/W 1000ML","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 18),
  ('otMedicineCatalog', 'default:inj.%20rld%201000ml', '{"id":"default:inj.%20rld%201000ml","name":"INJ. RLD 1000ML","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 19),
  ('otMedicineCatalog', 'default:18g%20iv%20line', '{"id":"default:18g%20iv%20line","name":"18G IV LINE","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 20),
  ('otMedicineCatalog', 'default:20g%20iv%20line', '{"id":"default:20g%20iv%20line","name":"20G IV LINE","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 21),
  ('otMedicineCatalog', 'default:22g%20iv%20line', '{"id":"default:22g%20iv%20line","name":"22G IV LINE","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 22),
  ('otMedicineCatalog', 'default:24g%20iv%20line', '{"id":"default:24g%20iv%20line","name":"24G IV LINE","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 23),
  ('otMedicineCatalog', 'default:b.t%2Fset', '{"id":"default:b.t%2Fset","name":"B.T/SET","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 24),
  ('otMedicineCatalog', 'default:d%2Fset', '{"id":"default:d%2Fset","name":"D/SET","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 25),
  ('otMedicineCatalog', 'default:d%2Fs%205cc', '{"id":"default:d%2Fs%205cc","name":"D/S 5CC","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 26),
  ('otMedicineCatalog', 'default:d%2Fs%2010cc', '{"id":"default:d%2Fs%2010cc","name":"D/S 10CC","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 27),
  ('otMedicineCatalog', 'default:d%2Fs%2020cc', '{"id":"default:d%2Fs%2020cc","name":"D/S 20CC","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 28),
  ('otMedicineCatalog', 'default:d%2Fs%2050cc', '{"id":"default:d%2Fs%2050cc","name":"D/S 50CC","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 29),
  ('otMedicineCatalog', 'default:o.t%20cap', '{"id":"default:o.t%20cap","name":"O.T CAP","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 30),
  ('otMedicineCatalog', 'default:aprean', '{"id":"default:aprean","name":"APREAN","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 31),
  ('otMedicineCatalog', 'default:s.%20gloves%207%201%2F2', '{"id":"default:s.%20gloves%207%201%2F2","name":"S. GLOVES 7 1/2","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 32),
  ('otMedicineCatalog', 'default:s.%20gloves%206%201%2F2', '{"id":"default:s.%20gloves%206%201%2F2","name":"S. GLOVES 6 1/2","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 33),
  ('otMedicineCatalog', 'default:xylocaine%20gel', '{"id":"default:xylocaine%20gel","name":"XYLOCAINE GEL","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 34),
  ('otMedicineCatalog', 'default:lignocaine%20gel', '{"id":"default:lignocaine%20gel","name":"LIGNOCAINE GEL","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 35),
  ('otMedicineCatalog', 'default:nelton%20tube%2F10', '{"id":"default:nelton%20tube%2F10","name":"NELTON TUBE/10","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 36),
  ('otMedicineCatalog', 'default:nelton%20tube%2F12', '{"id":"default:nelton%20tube%2F12","name":"NELTON TUBE/12","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 37),
  ('otMedicineCatalog', 'default:feeding%20tube%2F6%2F8', '{"id":"default:feeding%20tube%2F6%2F8","name":"FEEDING TUBE/6/8","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 38),
  ('otMedicineCatalog', 'default:feeding%20tube%2F8', '{"id":"default:feeding%20tube%2F8","name":"FEEDING TUBE/8","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 39),
  ('otMedicineCatalog', 'default:feeding%20tube%2F10', '{"id":"default:feeding%20tube%2F10","name":"FEEDING TUBE/10","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 40),
  ('otMedicineCatalog', 'default:stomach%20tube%2F18', '{"id":"default:stomach%20tube%2F18","name":"STOMACH TUBE/18","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 41),
  ('otMedicineCatalog', 'default:gauze%20packet', '{"id":"default:gauze%20packet","name":"GAUZE PACKET","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 42),
  ('otMedicineCatalog', 'default:foley''s%20catheter%2F16', '{"id":"default:foley''s%20catheter%2F16","name":"FOLEY''S CATHETER/16","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 43),
  ('otMedicineCatalog', 'default:foley''s%20catheter%2F18', '{"id":"default:foley''s%20catheter%2F18","name":"FOLEY''S CATHETER/18","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 44),
  ('otMedicineCatalog', 'default:foley''s%20catheter%2F20', '{"id":"default:foley''s%20catheter%2F20","name":"FOLEY''S CATHETER/20","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 45),
  ('otMedicineCatalog', 'default:foley''s%20catheter%2F22', '{"id":"default:foley''s%20catheter%2F22","name":"FOLEY''S CATHETER/22","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 46),
  ('otMedicineCatalog', 'default:urine%20bag', '{"id":"default:urine%20bag","name":"URINE BAG","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 47),
  ('otMedicineCatalog', 'default:drainage%20bag', '{"id":"default:drainage%20bag","name":"DRAINAGE BAG","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 48),
  ('otMedicineCatalog', 'default:sponges', '{"id":"default:sponges","name":"SPONGES","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 49),
  ('otMedicineCatalog', 'default:silk%20no.1', '{"id":"default:silk%20no.1","name":"SILK NO.1","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 50),
  ('otMedicineCatalog', 'default:silk%20no.2%2F0', '{"id":"default:silk%20no.2%2F0","name":"SILK NO.2/0","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 51),
  ('otMedicineCatalog', 'default:silk%20no.3%2F0', '{"id":"default:silk%20no.3%2F0","name":"SILK NO.3/0","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 52),
  ('otMedicineCatalog', 'default:vicryl%20no.1', '{"id":"default:vicryl%20no.1","name":"VICRYL NO.1","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 53),
  ('otMedicineCatalog', 'default:vicryl%20no.2', '{"id":"default:vicryl%20no.2","name":"VICRYL NO.2","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 54),
  ('otMedicineCatalog', 'default:vicryl%20no.3%2F0', '{"id":"default:vicryl%20no.3%2F0","name":"VICRYL NO.3/0","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 55),
  ('otMedicineCatalog', 'default:vicryl%20no.4%2F0', '{"id":"default:vicryl%20no.4%2F0","name":"VICRYL NO.4/0","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 56),
  ('otMedicineCatalog', 'default:catgut%20no.1', '{"id":"default:catgut%20no.1","name":"CATGUT NO.1","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 57),
  ('otMedicineCatalog', 'default:catgut%20no.2%2F0', '{"id":"default:catgut%20no.2%2F0","name":"CATGUT NO.2/0","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 58),
  ('otMedicineCatalog', 'default:catgut%20no.3%2F0', '{"id":"default:catgut%20no.3%2F0","name":"CATGUT NO.3/0","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 59),
  ('otMedicineCatalog', 'default:catgut%20no.4%2F0', '{"id":"default:catgut%20no.4%2F0","name":"CATGUT NO.4/0","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 60),
  ('otMedicineCatalog', 'default:proline%202%2F0', '{"id":"default:proline%202%2F0","name":"PROLINE 2/0","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 61),
  ('otMedicineCatalog', 'default:proline%203%2F0', '{"id":"default:proline%203%2F0","name":"PROLINE 3/0","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 62),
  ('otMedicineCatalog', 'default:proline%206%2F0', '{"id":"default:proline%206%2F0","name":"PROLINE 6/0","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 63),
  ('otMedicineCatalog', 'default:proline%208%2F0', '{"id":"default:proline%208%2F0","name":"PROLINE 8/0","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 64),
  ('otMedicineCatalog', 'default:bild%20no.11', '{"id":"default:bild%20no.11","name":"BILD NO.11","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 65),
  ('otMedicineCatalog', 'default:bild%20no.15', '{"id":"default:bild%20no.15","name":"BILD NO.15","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 66),
  ('otMedicineCatalog', 'default:bild%20no.19', '{"id":"default:bild%20no.19","name":"BILD NO.19","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 67),
  ('otMedicineCatalog', 'default:bild%20no.24', '{"id":"default:bild%20no.24","name":"BILD NO.24","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 68),
  ('otMedicineCatalog', 'default:local%20100cc', '{"id":"default:local%20100cc","name":"LOCAL 100CC","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 69)
on conflict (collection, record_id) do nothing;

commit;

select collection,
       count(*) as total_records,
       count(*) filter (where coalesce(data->>'active', 'true') = 'true'
                          and coalesce(data->>'deleted', 'false') <> 'true') as active_records
from public.hmc_records
where collection in ('procedures', 'rooms', 'prescriptionMedicineCatalog', 'otMedicineCatalog')
group by collection
order by collection;
