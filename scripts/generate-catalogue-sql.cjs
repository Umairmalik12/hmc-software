// Keep PostgreSQL seed IDs and values identical to the catalogue defaults used by Angular.
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const seedMarker = '-- BEGIN GENERATED HMC CATALOGUE SEEDS';

function stringArray(file, variable) {
  const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true);
  let initializer;
  function find(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === variable) initializer = node.initializer;
    ts.forEachChild(node, find);
  }
  find(source);
  // Some constants apply .map() directly to their literal array.
  if (initializer && ts.isCallExpression(initializer) && ts.isPropertyAccessExpression(initializer.expression)) initializer = initializer.expression.expression;
  if (!initializer || !ts.isArrayLiteralExpression(initializer)) throw new Error('Cannot read ' + variable);
  return initializer.elements.map(item => {
    if (!ts.isStringLiteral(item)) throw new Error(variable + ' contains a non-literal name');
    return item.text;
  });
}
const key = name => name.trim().replace(/\s+/g, ' ').toLowerCase();
const procedures = stringArray('src/app/Services/procedure.service.ts', 'DEFAULT_PROCEDURES');
const rooms = stringArray('src/app/Services/room.service.ts', 'DEFAULT_ROOMS');
const prescriptionNames = stringArray('src/app/Components/precipion/prescription-medicines.ts', 'COMMON_MEDICINES_ARRAY');
const otNames = stringArray('src/app/Components/otslip/ot-medicines.ts', 'OT_MEDICINES');
const options = names => names.map((name, index) => ({ id: 'default-' + (index + 1), name, active: true }));
const prescriptions = Array.from(new Map(prescriptionNames.map(name => {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  return [key(trimmed), { id: 'default:' + encodeURIComponent(key(trimmed)), name: trimmed, active: true }];
})).values());
const ot = otNames.map(name => ({ id: 'default:' + encodeURIComponent(key(name)), name: name.trim(), genericName: '', category: '', type: name.startsWith('INJ.') ? 'Injection' : '', strength: '', unit: '', description: '', active: true, deleted: false }));
const catalogues = [['procedures', options(procedures)], ['rooms', options(rooms)], ['prescriptionMedicineCatalog', prescriptions], ['otMedicineCatalog', ot]];
const quote = value => "'" + String(value).replace(/'/g, "''") + "'";

const intro = `-- All four catalogue defaults use public.hmc_records; no separate catalogue tables.
-- Run as the database owner in Supabase SQL Editor after the base schema exists.
-- Generated with: node scripts/generate-catalogue-sql.cjs
-- Re-running preserves existing rows, including renamed, inactive and deleted entries.
-- Patient records, payments, prescriptions and legacy customMedicines are unchanged.
`;
const preflight = `do $$
begin
  if to_regclass('public.hmc_records') is null then
    raise exception 'Run supabase/schema.sql first to create the shared record tables and CRUD functions.';
  end if;
end;
$$;`;
const inserts = catalogues.map(([collection, items]) => `-- ${collection}: ${items.length} starter options.
insert into public.hmc_records (collection, record_id, data, sort_order)
values
${items.map((item, index) => '  (' + [quote(collection), quote(item.id), quote(JSON.stringify(item)) + '::jsonb', index].join(', ') + ')').join(',\n')}
on conflict (collection, record_id) do nothing;`).join('\n\n');
const report = `-- Report persisted catalogue rows, including existing custom and inactive entries.
select collection,
       count(*) as total_records,
       count(*) filter (where coalesce(data->>'active', 'true') = 'true'
                          and coalesce(data->>'deleted', 'false') <> 'true') as active_records
from public.hmc_records
where collection in ('procedures', 'rooms', 'prescriptionMedicineCatalog', 'otMedicineCatalog')
group by collection
order by collection;
`;
const migration = intro + '\nbegin;\n\n' + preflight + '\n\n' + inserts + '\n\ncommit;\n\n' + report;
const schemaPath = path.join(root, 'supabase/schema.sql');
const base = fs.readFileSync(schemaPath, 'utf8').replace(/\r\n?/g, '\n').split(seedMarker)[0].trimEnd();
const outputs = [
  [path.join(root, 'supabase/migrations/20261118_catalogue_defaults.sql'), migration],
  [schemaPath, base + '\n\n' + seedMarker + '\n' + migration + '-- END GENERATED HMC CATALOGUE SEEDS\n'],
];
for (const [file, contents] of outputs) {
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n') !== contents) throw new Error(path.relative(root, file) + ' is out of date. Run this script without --check.');
  } else fs.writeFileSync(file, contents);
}
console.log(JSON.stringify(Object.fromEntries(catalogues.map(([name, items]) => [name, items.length]))));
