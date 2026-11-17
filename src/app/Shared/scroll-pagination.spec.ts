import { FeedbackModule } from 'src/app/Shared/feedback.module';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { ScrollPagination, trackRecord } from './scroll-pagination';
import { ScrollPaginationDirective } from './scroll-pagination.directive';

@Component({ template: `<div appScrollPagination [style.height.px]="height" style="overflow:auto;width:280px" [scrollTotal]="rows.length" [scrollShown]="visible.length" [scrollResetKey]="pagination.revision" [scrollDisabled]="disabled" (loadMore)="more()"><div *ngFor="let row of visible; trackBy: trackRecord" style="height:24px;width:600px">{{ row.id }}</div></div>` })
class ScrollHost {
  pagination = new ScrollPagination();
  rows = Array.from({ length: 65 }, (_, id) => ({ id }));
  height = 120;
  disabled = false;
  requests = 0;
  trackRecord = trackRecord;
  get visible(): { id: number }[] { return this.pagination.slice(this.rows); }
  more(): void { this.requests++; this.pagination.loadMore(this.rows.length); }
}

describe('Shared scroll pagination in a real scroll container', () => {
  let fixture: ComponentFixture<ScrollHost>;
  let host: ScrollHost;
  let element: HTMLElement;
  const frames = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  async function render(): Promise<void> { fixture.detectChanges(); await frames(); fixture.detectChanges(); await frames(); }
  async function bottom(): Promise<void> {
    element.scrollTop = element.scrollHeight;
    for (let i = 0; i < 10; i++) element.dispatchEvent(new Event('scroll'));
    await render();
  }
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FeedbackModule, CommonModule], declarations: [ScrollHost, ScrollPaginationDirective] }).compileComponents();
    fixture = TestBed.createComponent(ScrollHost); host = fixture.componentInstance;
    fixture.detectChanges(); element = fixture.nativeElement.firstElementChild;
    await render();
  });
  afterEach(() => fixture.destroy());

  it('appends batches without replacing or duplicating rows during rapid scrolling, and stops at the end', async () => {
    expect(element.children.length).toBe(20);
    const first = element.firstElementChild;
    await bottom(); expect(element.children.length).toBe(40);
    expect(element.firstElementChild).toBe(first);
    await bottom(); expect(element.children.length).toBe(60);
    await bottom(); expect(element.children.length).toBe(65);
    await bottom(); expect(host.requests).toBe(3);
    expect(new Set(Array.from(element.children).map(child => child.textContent)).size).toBe(65);
  });

  it('does not load for horizontal or upward scrolling', async () => {
    element.scrollLeft = 100; element.dispatchEvent(new Event('scroll'));
    await render(); expect(host.requests).toBe(0);
    element.scrollTop = 20; element.dispatchEvent(new Event('scroll')); await render();
    element.scrollTop = 0; element.dispatchEvent(new Event('scroll')); await render();
    expect(host.requests).toBe(0);
  });

  it('resets the scroll position and visible prefix on a filter change', async () => {
    await bottom(); expect(host.visible.length).toBe(40);
    host.rows = host.rows.filter(row => row.id >= 30);
    host.pagination.reset(); await render();
    expect(element.scrollTop).toBe(0);
    expect(element.children.length).toBe(20);
    expect(element.firstElementChild!.textContent).toBe('30');
    await bottom(); expect(element.children.length).toBe(35);
    host.rows = []; host.pagination.reset(); await render();
    expect(element.children.length).toBe(0);
  });

  it('fills a tall viewport automatically and responds to resizing', async () => {
    host.height = 1100; await render(); await render(); await render();
    expect(host.visible.length).toBe(60);
    host.height = 1700; await render(); await render();
    expect(host.visible.length).toBe(65);
  });

  it('waits while disabled and resumes when enabled', async () => {
    host.disabled = true; await render(); await bottom(); expect(host.requests).toBe(0);
    host.disabled = false; await render(); expect(host.visible.length).toBe(40);
  });

  it('removes listeners and pending callbacks on destroy', async () => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event('scroll'));
    fixture.destroy(); await frames();
    element.dispatchEvent(new Event('scroll')); await frames();
    expect(host.requests).toBe(0);
  });
});

describe('ScrollPagination state', () => {
  it('keeps the filtered source intact and clamps repeated loads to its total', () => {
    const state = new ScrollPagination(); const rows = Array.from({ length: 43 }, (_, id) => id);
    expect(state.slice(rows)).toEqual(rows.slice(0, 20));
    state.loadMore(rows.length); state.loadMore(rows.length); expect(state.slice(rows)).toEqual(rows);
    expect(state.loadMore(rows.length)).toBeFalse(); expect(rows.length).toBe(43);
    state.reset(); expect(state.limit).toBe(20); expect(state.revision).toBe(1);
    expect(state.slice([])).toEqual([]); expect(state.loadMore(0)).toBeFalse();
  });
});
