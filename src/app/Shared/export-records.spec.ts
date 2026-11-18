import { exportRecords } from './export-records';

describe('Report export notifications', () => {
  it('reports an empty result without starting a download', () => {
    const feedback = jasmine.createSpyObj('feedback', ['success', 'error', 'warning']);
    expect(exportRecords([], 'patients.xlsx', 'Patients', feedback)).toBeFalse();
    expect(feedback.warning).toHaveBeenCalledWith('There are no records to export.'); expect(feedback.success).not.toHaveBeenCalled();
  });
  it('reports report-generation failures without a false success notification', () => {
    const feedback = jasmine.createSpyObj('feedback', ['success', 'error', 'warning']);
    const record = Object.defineProperty({}, 'patient', { enumerable: true, get() { throw new Error('Unavailable'); } });
    expect(exportRecords([record], 'patients.xlsx', 'Patients', feedback)).toBeFalse();
    expect(feedback.error).toHaveBeenCalled(); expect(feedback.success).not.toHaveBeenCalled();
  });
});
