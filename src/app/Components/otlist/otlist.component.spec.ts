import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OtlistComponent } from './otlist.component';

describe('OtlistComponent', () => {
  let component: OtlistComponent;
  let fixture: ComponentFixture<OtlistComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ OtlistComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(OtlistComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
