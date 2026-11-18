import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertboxComponent } from '../Components/alertbox/alertbox.component';
import { AppFeedbackComponent } from './app-feedback.component';
import { BusyDirective } from './busy.directive';
import { OverlayModule } from '@angular/cdk/overlay';
import { A11yModule } from '@angular/cdk/a11y';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NotificationCenterComponent } from './notification-center.component';

@NgModule({ imports: [CommonModule, OverlayModule, A11yModule, MatButtonModule, MatIconModule], declarations: [AlertboxComponent, AppFeedbackComponent, BusyDirective, NotificationCenterComponent], exports: [AlertboxComponent, AppFeedbackComponent, BusyDirective, NotificationCenterComponent] })
export class FeedbackModule {}
