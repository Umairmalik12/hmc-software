import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertboxComponent } from '../Components/alertbox/alertbox.component';
import { AppFeedbackComponent } from './app-feedback.component';
import { BusyDirective } from './busy.directive';

@NgModule({ imports: [CommonModule], declarations: [AlertboxComponent, AppFeedbackComponent, BusyDirective], exports: [AlertboxComponent, AppFeedbackComponent, BusyDirective] })
export class FeedbackModule {}
