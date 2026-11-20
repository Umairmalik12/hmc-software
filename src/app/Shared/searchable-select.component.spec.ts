import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { SearchableSelectComponent } from './searchable-select.component';
import { DOWN_ARROW, ENTER, ESCAPE } from '@angular/cdk/keycodes';

@Component({ template: '<app-searchable-select style="display:block;width:min(300px,calc(100vw - 32px));margin:16px" label="Doctor name" [options]="names" [(value)]="selected" [disabled]="disabled" [error]="error" (retry)="retried = true"></app-searchable-select>' })
class PickerHost {
  selected = 'Dr Previous';
  names = ['Dr Previous', 'Dr Roman', 'Dr Sara', 'A very long procedure or surgeon name that must wrap within the available printable and screen width'];
  disabled = false;
  error = '';
  retried = false;
}

describe('Searchable procedure and doctor dropdown', () => {
  let fixture: ComponentFixture<PickerHost>;
  let picker: SearchableSelectComponent;
  let input: HTMLInputElement;
  const settle = async () => { fixture.detectChanges(); await new Promise(resolve => setTimeout(resolve, 40)); fixture.detectChanges(); };
  const type = async (text: string) => { input.value = text; input.dispatchEvent(new Event('input', { bubbles: true })); await settle(); };
  const key = (code: number, name: string) => input.dispatchEvent(new KeyboardEvent('keydown', { key: name, keyCode: code, which: code, bubbles: true }));
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SearchableSelectComponent, NoopAnimationsModule], declarations: [PickerHost] }).compileComponents();
    fixture = TestBed.createComponent(PickerHost); await settle();
    picker = fixture.debugElement.query(By.directive(SearchableSelectComponent)).componentInstance;
    input = fixture.nativeElement.querySelector('input'); picker.open(); await settle();
  });
  afterEach(() => fixture.destroy());

  it('searches by any words and changes the saved value only when an option is selected', async () => {
    await type('ROMAN dr');
    expect(picker.filteredOptions).toEqual(['Dr Roman']); expect(fixture.componentInstance.selected).toBe('Dr Previous');
    const option = Array.from(document.querySelectorAll<HTMLElement>('mat-option')).find(item => item.textContent?.trim() === 'Dr Roman')!;
    option.click(); await settle();
    expect(fixture.componentInstance.selected).toBe('Dr Roman'); expect(input.value).toBe('Dr Roman');
    picker.open(); await settle(); await type('No match');
    expect(document.body.textContent).toContain('No matching options');
    picker.close(); await settle(); expect(input.value).toBe('Dr Roman'); expect(fixture.componentInstance.selected).toBe('Dr Roman');
  });

  it('supports keyboard selection, Escape without changing the saved value and clear', async () => {
    await type('Sara'); key(DOWN_ARROW, 'ArrowDown'); key(ENTER, 'Enter'); await settle();
    expect(fixture.componentInstance.selected).toBe('Dr Sara');
    picker.open(); await settle(); await type('Roman'); key(ESCAPE, 'Escape'); await settle();
    expect(input.value).toBe('Dr Sara'); expect(fixture.componentInstance.selected).toBe('Dr Sara');
    const clear = fixture.nativeElement.querySelector('button[aria-label="Clear doctor name"]') as HTMLButtonElement;
    clear.click(); await settle(); expect(fixture.componentInstance.selected).toBe(''); expect(input.value).toBe('');
  });

  it('wraps long options and keeps the dropdown inside the viewport', async () => {
    const panel = document.querySelector<HTMLElement>('.hmc-catalog-options')!;
    const bounds = panel.getBoundingClientRect();
    expect(bounds.left).toBeGreaterThanOrEqual(0); expect(bounds.right).toBeLessThanOrEqual(window.innerWidth + 1);
    const option = Array.from(panel.querySelectorAll<HTMLElement>('mat-option')).find(item => item.textContent?.includes('very long'))!;
    expect(option.scrollWidth).toBeLessThanOrEqual(option.clientWidth + 1);
    expect(option.getBoundingClientRect().height).toBeGreaterThan(42);
  });

  it('honours disabled state and exposes a retry action for failed catalogue loads', async () => {
    fixture.componentInstance.disabled = true; await settle();
    expect(input.disabled).toBeTrue(); expect(picker.trigger?.panelOpen).toBeFalse(); picker.clear(); expect(fixture.componentInstance.selected).toBe('Dr Previous');
    fixture.componentInstance.disabled = false; fixture.componentInstance.error = 'Unable to load options'; await settle();
    (fixture.nativeElement.querySelector('button[aria-label="Retry loading doctor name"]') as HTMLButtonElement).click(); await settle();
    expect(fixture.componentInstance.retried).toBeTrue();
  });
});
