import { FeedbackModule } from 'src/app/Shared/feedback.module';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';


import { AlertboxComponent } from './alertbox.component';

describe('AlertboxComponent', () => {
  let component: AlertboxComponent;
  let fixture: ComponentFixture<AlertboxComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({imports: [FeedbackModule],
      declarations: []
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AlertboxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should correctly render the passed message', () => {
    component.message= "Testing Alert Box"
    fixture.detectChanges();
    let ele = fixture.debugElement.nativeElement;
    expect(ele.querySelector('p').textContent).toBe('Testing Alert Box');
  });

  it('should add error class to alert-box on error message',()=>{
    component.type="error"


    fixture.detectChanges();
    let ele: HTMLElement= fixture.nativeElement.querySelector('div');
    expect(ele.classList.contains('error')).toBeTrue();
  });

  it('should add success class to alert-box on success message',()=>{
    component.type="success"


    fixture.detectChanges();
    let ele: HTMLElement= fixture.nativeElement.querySelector('div');
    expect(ele.classList.contains('success')).toBeTrue();
  });

});
