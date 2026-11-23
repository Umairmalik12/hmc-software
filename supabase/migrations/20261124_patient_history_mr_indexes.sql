-- MR numbers identify a patient; these non-unique indexes support history lookups
-- while allowing any number of visits and transactions for the same patient.
begin;

create index if not exists hmc_records_opd_patient_mr_idx
  on public.hmc_records ((data ->> 'patientId'))
  where collection = 'opdDetails';

create index if not exists hmc_records_mr_number_idx
  on public.hmc_records (collection, (data ->> 'mrNumber'))
  where collection in ('otFormData', 'medicineDetails', 'labDetails', 'inpatientDetails', 'payments');

create index if not exists hmc_records_prescription_patient_mr_idx
  on public.hmc_records ((data #>> '{patient,refId}'))
  where collection in ('prescriptions', 'prescription');

commit;
