import { AdminAssistantService, CLINICAL_ASSISTANT_PROMPT, LOCAL_AI_URL } from './admin-assistant.service';

describe('Admin assistant local AI and database lookup', () => {
  let service: AdminAssistantService, user: any, db: any, main: any, ot: any, network: jasmine.Spy;
  const response = (data: object, status = 200): Promise<Response> => Promise.resolve({ ok: status < 400, status, json: async () => data } as Response);
  beforeEach(() => {
    user = { getLoginUser: jasmine.createSpy().and.resolveTo('admin') };
    db = { getItem: jasmine.createSpy().and.callFake(async (collection: string) => ({ patientDetails: [{ patientId: 42, firstName: 'Ayesha', drName: 'Dr Khan' }], opdDetails: [{ patientId: 420, patientName: 'Ali', drName: 'Dr Haq' }], inpatientDetails: [{ inpatientId: 42, patientName: 'Ayesha', surgeonName: 'Dr Khan' }] }[collection])) };
    main = { getAll: jasmine.createSpy().and.resolveTo([{ id: '1', name: 'Amoxicillin 500 mg', strength: '500 mg', active: true }]) };
    ot = { getAll: jasmine.createSpy().and.resolveTo([{ id: '1', name: 'Example injection', genericName: 'Amoxicillin', strength: '1 g', active: true }, { id: '2', name: 'Inactive injection', active: false }]) };
    service = new AdminAssistantService(user, db, main, ot);
    network = spyOn(window, 'fetch').and.callFake(() => response({ models: [{ name: 'gemma3:4b' }, { name: 'gemma3:4b' }, { name: 'cloud-model' }, { name: 'remote-alias', remote_host: 'https://ollama.com' }] }));
  });
  it('allows generic loopback AI without a hosted session but restricts database lookups to admins', async () => {
    user.getLoginUser.and.rejectWith(new Error('Auth session missing!'));
    expect(await service.models()).toEqual(['gemma3:4b']);
    network.and.callFake(() => response({ message: { role: 'assistant', content: 'General information.' } }));
    expect(await service.chat('gemma3:4b', [{ role: 'user', content: 'Hello' }])).toBe('General information.');
    await expectAsync(service.searchMedicines('amox')).toBeRejectedWithError(/Auth session missing/);
    await expectAsync(service.searchPatients('42')).toBeRejectedWithError(/Auth session missing/);
    expect(db.getItem).not.toHaveBeenCalled(); expect(main.getAll).not.toHaveBeenCalled();
  });
  it('discovers only local model options and sends bounded chat to loopback without credentials or records', async () => {
    expect(await service.models()).toEqual(['gemma3:4b']);
    network.and.callFake(() => response({ message: { role: 'assistant', content: ' General reference. ' } }));
    expect(await service.chat('gemma3:4b', Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? 'user' as const : 'assistant' as const, content: 'Question ' + i })))).toBe('General reference.');
    const [url, options] = network.calls.mostRecent().args;
    expect(url).toBe(LOCAL_AI_URL + '/api/chat'); expect(options.credentials).toBe('omit'); expect(options.referrerPolicy).toBe('no-referrer');
    const body = JSON.parse(options.body as string); expect(body.stream).toBeFalse(); expect(body.messages[0]).toEqual({ role: 'system', content: CLINICAL_ASSISTANT_PROMPT });
    expect(body.messages.length).toBeLessThanOrEqual(13); expect(body.messages[body.messages.length - 1].content).toBe('Question 19');
    expect(db.getItem).not.toHaveBeenCalled(); expect(main.getAll).not.toHaveBeenCalled(); expect(ot.getAll).not.toHaveBeenCalled(); expect(options.headers['Authorization']).toBeUndefined();
  });
  it('rejects unselected models, invalid questions, empty replies and missing models', async () => {
    await expectAsync(service.chat('unknown', [{ role: 'user', content: 'Hi' }])).toBeRejectedWithError(/choose an installed/);
    await service.models();
    await expectAsync(service.chat('gemma3:4b', [{ role: 'user', content: '' }])).toBeRejectedWithError(/valid question/);
    network.and.callFake(() => response({ message: { role: 'assistant', content: '' } }));
    await expectAsync(service.chat('gemma3:4b', [{ role: 'user', content: 'Medicine question' }])).toBeRejectedWithError(/no usable answer/);
    network.and.callFake(() => response({}, 404));
    await expectAsync(service.chat('gemma3:4b', [{ role: 'user', content: 'Medicine question' }])).toBeRejectedWithError(/model is unavailable/);
  });
  it('shows actionable connection and origin errors', async () => {
    network.and.rejectWith(new TypeError('Failed to fetch'));
    await expectAsync(service.models()).toBeRejectedWithError(/Start Ollama/);
    network.and.callFake(() => response({}, 403));
    await expectAsync(service.models()).toBeRejectedWithError(/allowed-origin/);
  });
  it('aborts a pending local request when stopped without continuing the conversation', async () => {
    await service.models(); const controller = new AbortController();
    network.and.callFake((_url: any, options: RequestInit) => new Promise((_resolve, reject) => options.signal!.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')))));
    const pending = service.chat('gemma3:4b', [{ role: 'user', content: 'Question' }], controller.signal);
    await Promise.resolve(); await Promise.resolve(); controller.abort();
    await expectAsync(pending).toBeRejected();
  });
  it('searches both catalogues and keeps same IDs in separate catalogues without requesting AI', async () => {
    const results = await service.searchMedicines('AMOX');
    expect(results.map(item => item.key)).toEqual(['main:1', 'ot:1']); expect(results[1].detail).toContain('1 g');
    expect(network).not.toHaveBeenCalled(); expect(db.getItem).not.toHaveBeenCalled();
    await expectAsync(service.searchMedicines('')).toBeRejectedWithError(/two letters/);
  });
  it('finds actual MR numbers exactly across modules and patient names without transmitting records to AI', async () => {
    const exact = await service.searchPatients('42'); expect(exact.map(item => item.key)).toEqual(['operation:42', 'inpatient:42']);
    expect((await service.searchPatients('AYESHA')).length).toBe(2); expect((await service.searchPatients('420')).map(item => item.name)).toEqual(['Ali']);
    expect(network).not.toHaveBeenCalled();
  });
});
