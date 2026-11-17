import { FeedbackModule } from 'src/app/Shared/feedback.module';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { MatSelect, MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { RoomService } from 'src/app/Services/room.service';
import { SupabaseDataService } from 'src/app/Services/supabase-data.service';
import { memoryDb } from 'src/app/testing/memory-db';
import { RoomSelectComponent } from './room-select.component';
import { RoomsComponent } from './rooms.component';
import { ScrollPaginationDirective } from 'src/app/Shared/scroll-pagination.directive';
import { ScrollListFooterComponent } from 'src/app/Shared/scroll-list-footer.component';
import { RecordPreviewDirective } from '../record-details/record-preview.directive';

@Component({ template: `<app-room-select [formControl]="room"></app-room-select><app-rooms></app-rooms>` })
class RoomHost { room = new FormControl(''); }

describe('Room management and form dropdown integration', () => {
  beforeEach(async () => {
    const { db } = memoryDb();
    await TestBed.configureTestingModule({
      imports: [FeedbackModule, CommonModule, FormsModule, ReactiveFormsModule, NoopAnimationsModule, RouterTestingModule, MatSelectModule, MatInputModule, MatIconModule, MatButtonModule, MatDialogModule],
      declarations: [RoomHost, RoomsComponent, RoomSelectComponent, ScrollPaginationDirective, ScrollListFooterComponent, RecordPreviewDirective],
      providers: [{ provide: SupabaseDataService, useValue: db }],
    }).compileComponents();
  });

  it('refreshes dropdown values after CRUD while retaining an existing saved selection', async () => {
    const fixture = TestBed.createComponent(RoomHost);
    try {
      fixture.detectChanges(); await new Promise(resolve => setTimeout(resolve, 40)); fixture.detectChanges();
      const selector = fixture.debugElement.query(By.directive(RoomSelectComponent)).componentInstance as RoomSelectComponent;
      const manager = fixture.debugElement.query(By.directive(RoomsComponent)).componentInstance as RoomsComponent;
      manager.name.setValue('GW Bed 3'); await manager.save(); await Promise.resolve(); fixture.detectChanges();
      const added = selector.options.find(option => option.name === 'GW Bed 3')!; expect(added).toBeDefined();
      const select = fixture.debugElement.query(By.directive(MatSelect)).componentInstance as MatSelect;
      select.open(); fixture.detectChanges();
      const option = Array.from(document.querySelectorAll<HTMLElement>('mat-option')).find(element => element.textContent?.trim() === 'GW Bed 3')!;
      option.click(); fixture.detectChanges(); expect(fixture.componentInstance.room.value).toBe('GW Bed 3');
      manager.edit(added); manager.name.setValue('GW Bed 3A'); await manager.save(); await Promise.resolve(); fixture.detectChanges();
      expect(selector.options.some(value => value.name === 'GW Bed 3A')).toBeTrue();
      expect(selector.value).toBe('GW Bed 3'); expect(selector.retainedValues).toContain('GW Bed 3');
      spyOn(window, 'confirm').and.returnValue(true); await manager.delete(manager.options.find(value => value.id === added.id)!); await Promise.resolve(); fixture.detectChanges();
      expect(selector.options.some(value => value.id === added.id)).toBeFalse(); expect(selector.value).toBe('GW Bed 3');
      manager.name.setValue('room 1'); await manager.save(); expect(manager.error).toContain('already exists'); expect(manager.name.value).toBe('room 1');
      expect(await TestBed.inject(RoomService).getAll()).not.toContain(jasmine.objectContaining({ id: added.id }));
    } finally { fixture.destroy(); }
  });
});
