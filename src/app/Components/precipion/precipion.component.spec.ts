import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PreciptionComponent } from './precipion.component';


describe('PreciptionComponent', () => {
  let component: PreciptionComponent;
  let fixture: ComponentFixture<PreciptionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PreciptionComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PreciptionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
