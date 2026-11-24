import { Directive, EmbeddedViewRef, Input, OnDestroy, TemplateRef, ViewContainerRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { ModulePermissionService, PermissionAction } from '../Services/module-permission.service';

@Directive({ selector: '[appPermission]' })
export class PermissionDirective implements OnDestroy {
  private key = '';
  private visible?: EmbeddedViewRef<unknown>;
  private readonly subscription: Subscription;
  @Input() set appPermission(value: string) { this.key = value || ''; this.update(); }
  constructor(private template: TemplateRef<unknown>, private container: ViewContainerRef, private permissions: ModulePermissionService) {
    this.subscription = permissions.changes.subscribe(() => this.update());
  }
  ngOnDestroy(): void { this.subscription.unsubscribe(); }
  private update(): void {
    const allowed = this.key.split('|').some(token => {
      const [moduleKey, actionText] = token.trim().split('.');
      const action = actionText as PermissionAction;
      return !!moduleKey && ['create','edit','delete','view'].includes(action) && this.permissions.can(moduleKey, action);
    });
    if (allowed && !this.visible) this.visible = this.container.createEmbeddedView(this.template);
    else if (!allowed && this.visible) { this.container.clear(); this.visible = undefined; }
  }
}
