# Inpatient CreatedAt + Date Filters TODO

## Steps:
- [x] 1. Update src/app/Models/inpatient.model.ts - Add createdAt: string to InPatient (model), InPatientDetail (service)
- [x] 2. Update src/app/Services/inpatient.service.ts - Auto-set createdAt in addNewInpatient, include in getInpatientBrief
- [x] 3. Update src/app/Components/inpatient/inpatient-edit/inpatient-edit.component.ts - Add createdAt handling in form/result/auto-set
- [x] 3. Update src/app/Components/inpatient/inpatient-edit/inpatient-edit.component.ts - Add createdAt handling in form/result/auto-set
- [ ] 4. Update src/app/Components/inpatient/inpatient-list/inpatient-list.component.ts - Add dateFilter, onDateFilter(), update columns/logic
- [ ] 5. Update src/app/Components/inpatient/inpatient-list/inpatient-list.component.html - Add date filter dropdown/button, createdAt column
- [ ] 6. Update src/app/Components/inpatient/inpatient-list/inpatient-list.component.css - Styling if needed
- [ ] 7. Test: Create inpatient, verify createdAt auto-set/display/filters work
