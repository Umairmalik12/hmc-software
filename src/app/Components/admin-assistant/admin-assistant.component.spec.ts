import { ApplicationRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { AdminAssistantComponent } from './admin-assistant.component';
import { AdminAssistantService } from '../../Services/admin-assistant.service';
import { RecordPreviewDirective } from '../record-details/record-preview.directive';
import { RecordDetailsComponent } from '../record-details/record-details.component';

describe('Admin assistant chat and responsive panel', () => {
  let assistant: any;
  beforeEach(async () => {
    assistant = { models: jasmine.createSpy().and.resolveTo(['gemma3:4b']), chat: jasmine.createSpy().and.resolveTo('Reference answer'), searchMedicines: jasmine.createSpy().and.resolveTo([{ key: 'main:1', name: 'Example 500 mg', source: 'Medicine catalogue', detail: '500 mg', record: { name: 'Example 500 mg' } }]), searchPatients: jasmine.createSpy().and.resolveTo([]) };
    await TestBed.configureTestingModule({ imports: [CommonModule, FormsModule, NoopAnimationsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatIconModule], declarations: [AdminAssistantComponent, RecordPreviewDirective, RecordDetailsComponent], providers: [{ provide: AdminAssistantService, useValue: assistant }] }).compileComponents();
  });
  const open = async () => {
    const dialog = TestBed.inject(MatDialog); const ref = dialog.open(AdminAssistantComponent, { width: 'min(720px, calc(100vw - 28px))', maxWidth: '96vw', panelClass: 'hmc-dialog-panel', autoFocus: 'first-heading' });
    TestBed.inject(ApplicationRef).tick(); await new Promise(resolve => setTimeout(resolve, 40)); TestBed.inject(ApplicationRef).tick(); return { ref, dialog, component: ref.componentInstance, root: document.querySelector<HTMLElement>('app-admin-assistant')! };
  };
  afterEach(() => { TestBed.inject(MatDialog).closeAll(); });
  it('submits a real chat request and displays output as text, never executable HTML', async () => {
    const { ref, component, root } = await open();
    assistant.chat.and.resolveTo('<img src=x onerror=alert(1)>'); component.draft = 'Explain medicine precautions'; await component.send(); TestBed.inject(ApplicationRef).tick();
    expect(assistant.chat).toHaveBeenCalledWith('gemma3:4b', component.messages, jasmine.any(AbortSignal)); expect(root.querySelector('.conversation')!.textContent).toContain('<img'); expect(root.querySelector('.conversation img')).toBeNull();
    expect(root.querySelector('.clinical-note')!.textContent).toContain('doctor review'); expect(component.draft).toBe(''); expect(component.sending).toBeFalse();
  });
  it('retains a failed question for retry and prevents duplicate sends', async () => {
    const { component } = await open(); assistant.chat.and.rejectWith(new Error('Connection lost')); component.draft = 'Question'; await component.send();
    expect(component.draft).toBe('Question'); expect(component.messages).toEqual([]); expect(component.chatError).toBe('Connection lost');
    component.sending = true; await component.send(); expect(assistant.chat).toHaveBeenCalledTimes(1);
  });
  it('offers real setup steps when AI is unavailable while database search and record preview still work', async () => {
    assistant.models.and.rejectWith(new Error('Start Ollama')); const { ref, component, root, dialog } = await open();
    expect(root.querySelector('.assistant-setup')!.textContent).toContain('OLLAMA_ORIGINS'); expect(component.connected).toBeFalse();
    component.chooseTab('medicines'); component.query = 'Example'; await component.search(); TestBed.inject(ApplicationRef).tick();
    expect(root.querySelector('.lookup-results')!.textContent).toContain('Example 500 mg'); root.querySelector<HTMLButtonElement>('[title="Preview record"]')!.click();
    expect(dialog.openDialogs.length).toBe(2); expect(dialog.openDialogs[1].componentInstance).toEqual(jasmine.any(RecordDetailsComponent)); expect(assistant.chat).not.toHaveBeenCalled();
  });
  it('contains long conversations and lookup names within the screen and keeps composer usable', async () => {
    const { ref, component, root } = await open(); component.messages = [{ role: 'assistant', content: 'VeryLongMedicineName'.repeat(400) }]; TestBed.inject(ApplicationRef).tick();
    const content = root.querySelector<HTMLElement>('mat-dialog-content')!, composer = root.querySelector<HTMLElement>('.chat-composer')!;
    expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1); expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth + 1);
    expect(content.scrollHeight).toBeGreaterThan(content.clientHeight); expect(composer.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight + 1);
    const textarea = root.querySelector<HTMLTextAreaElement>('textarea')!; expect(textarea.getBoundingClientRect().width).toBeGreaterThan(200);
    component.chooseTab('patients'); assistant.searchPatients.and.resolveTo(Array.from({ length: 45 }, (_, i) => ({ key: 'p:' + i, name: 'LongPatientName'.repeat(20), source: 'OPD', detail: 'MR ' + i, record: { patientId: i } }))); component.query = 'Patient'; await component.search(); TestBed.inject(ApplicationRef).tick();
    expect(root.querySelectorAll('.lookup-results article').length).toBe(20); expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1); component.limit += 20; TestBed.inject(ApplicationRef).tick(); expect(root.querySelectorAll('.lookup-results article').length).toBe(40);
  });
  it('discards stale database results after changing tools and clears sensitive data on close', async () => {
    const { component } = await open(); let resolve: (value: any[]) => void = () => {};
    assistant.searchPatients.and.returnValue(new Promise<any[]>(done => resolve = done)); component.chooseTab('patients'); component.query = '42'; const pending = component.search(); component.chooseTab('medicines'); resolve([{ key: 'p:42', name: 'Private patient' }]); await pending;
    expect(component.results).toEqual([]); component.messages = [{ role: 'user', content: 'Clinical question' }]; component.ngOnDestroy(); expect(component.messages).toEqual([]); expect(component.results).toEqual([]);
  });
});
