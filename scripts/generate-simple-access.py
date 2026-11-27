"""Generate deployment SQL from source. This script does not connect to a database."""
import ast
import json
import re
from pathlib import Path
from urllib.parse import quote

root = Path(__file__).resolve().parent.parent


def names(path, symbol):
    text = (root / path).read_text(encoding="utf-8-sig")
    match = re.search(r"\b" + re.escape(symbol) + r"\b[^=]*=\s*(\[.*?\])", text, re.S)
    if not match:
        raise ValueError("Cannot read catalogue " + symbol)
    return ast.literal_eval(match.group(1))


def key(name):
    return re.sub(r"\s+", " ", name.strip()).lower()


def encoded(name):
    return quote(key(name), safe="~!*'()-._")


rows = {}


def add(collection, data):
    rows[(collection, data["id"])] = {"collection": collection, "record_id": data["id"], "data": data}


for name in names("src/app/Components/precipion/prescription-medicines.ts", "COMMON_MEDICINES_ARRAY"):
    add("prescriptionMedicineCatalog", {"id": "default:" + encoded(name), "name": re.sub(r"\s+", " ", name.strip()), "active": True})
for name in names("src/app/Components/otslip/ot-medicines.ts", "OT_MEDICINES"):
    add("otMedicineCatalog", {"id": "default:" + encoded(name), "name": name.strip(), "genericName": "", "category": "",
        "type": "Injection" if name.startswith("INJ.") else "", "strength": "", "unit": "", "description": "", "active": True, "deleted": False})
for collection, path, symbol in [
    ("procedures", "src/app/Services/procedure.service.ts", "DEFAULT_PROCEDURES"),
    ("rooms", "src/app/Services/room.service.ts", "DEFAULT_ROOMS"),
    ("labTestCatalog", "src/app/Services/clinical-catalog.service.ts", "DEFAULT_LAB_TESTS"),
]:
    for index, name in enumerate(names(path, symbol), 1):
        add(collection, {"id": "default-" + str(index), "name": name, "active": True})
for name in names("src/app/Models/staff.model.ts", "STAFF_DUTIES"):
    add("staffDutyCatalog", {"id": "default:" + encoded(name), "name": name, "active": True})

seed = """insert into public.hmc_records(collection,record_id,data,sort_order)
select entry ->> 'collection',entry ->> 'record_id',entry -> 'data',0
from jsonb_array_elements($hmc_defaults$
""" + json.dumps(list(rows.values()), ensure_ascii=False, separators=(",", ":")) + """
$hmc_defaults$::jsonb) entry on conflict(collection,record_id) do nothing;
"""
source = (root / "supabase/simple_access_functions.sql").read_text(encoding="utf-8-sig")
tokens = (root / "supabase/token_functions.sql").read_text(encoding="utf-8-sig")
legacy = (root / "supabase/simple_catalogue_legacy.sql").read_text(encoding="utf-8-sig")
sql = "begin;\n\n" + source + "\n" + tokens + "\n" + seed + "\n" + legacy + "\nnotify pgrst, 'reload schema';\ncommit;\n"
(root / "supabase/migrations/20261128_simple_roles_crud.sql").write_text(sql,encoding="utf-8")
(root / "supabase/catalogue_default_records.sql").write_text(seed,encoding="utf-8")
schema_path = root / "supabase/schema.sql"
marker = "-- BEGIN HMC SIMPLE ACCESS"
schema = schema_path.read_text(encoding="utf-8-sig").split(marker, 1)[0].rstrip()
schema = re.sub(r"\bcurrent_role\b", "account_role", schema)
# Earlier setup sections grant these RPCs before the final installation block.
# Keep compatible wrappers there, rather than any former daily-counter logic.
wrappers = []
for function_name in ["create_patient_token_at", "create_patient_token"]:
    pattern = r"create or replace function public\." + function_name + r"\([^$]*?\$\$[\s\S]*?\n\$\$;\s*"
    wrapper = re.search(pattern,tokens).group().rstrip() + "\n"
    wrappers.append(wrapper)
    schema = re.sub(pattern,lambda _match: wrapper,schema)
if "create or replace function public.create_patient_token_at(" not in schema:
    anchor = "revoke all on function public.create_patient_token_at"
    schema = schema.replace(anchor,"\n".join(wrappers) + "\n" + anchor,1)
schema_path.write_text(schema + "\n\n" + marker + "\n" + sql,encoding="utf-8")
token_patch = """begin;
do $$ begin
  if to_regclass('public.patient_token_slips') is null
    or to_regprocedure('public.hmc_has_permission(text,text)') is null
    or to_regprocedure('public.hmc_is_admin()') is null then
    raise exception 'Apply the HMC base schema and simple roles update before this patch.';
  end if;
end $$;
""" + tokens + "\nnotify pgrst, 'reload schema';\ncommit;\n"
(root / "supabase/migrations/20261129_token_number_reuse.sql").write_text(token_patch,encoding="utf-8")
print("Generated comment-free deployment SQL. No database statements were executed.")
