import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideZonelessChangeDetection } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AcceptInviteComponent } from './accept-invite.component';
import { HouseholdService } from '../../core/household/household.service';

function makeHouseholdMock() {
  return {
    acceptInvite: vi.fn().mockResolvedValue(undefined),
  } as unknown as HouseholdService;
}

describe('AcceptInviteComponent', () => {
  let householdMock: ReturnType<typeof makeHouseholdMock>;

  beforeEach(async () => {
    householdMock = makeHouseholdMock();

    await TestBed.configureTestingModule({
      imports: [AcceptInviteComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: HouseholdService, useValue: householdMock },
      ],
    }).compileComponents();
  });

  it('creates the component', () => {
    const fixture = TestBed.createComponent(AcceptInviteComponent);
    fixture.componentRef.setInput('token', 'abc123');
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('calls HouseholdService.acceptInvite() on init with the route token', async () => {
    const fixture = TestBed.createComponent(AcceptInviteComponent);
    fixture.componentRef.setInput('token', 'my-token');

    await fixture.componentInstance.accept();

    expect(householdMock.acceptInvite).toHaveBeenCalledWith('my-token');
  });

  it('sets error signal when acceptInvite throws', async () => {
    householdMock.acceptInvite = vi.fn().mockRejectedValue(
      new Error('invalid or expired invitation token'),
    );

    const fixture = TestBed.createComponent(AcceptInviteComponent);
    fixture.componentRef.setInput('token', 'bad-token');

    await fixture.componentInstance.accept();

    expect(fixture.componentInstance.error()).toBe('invalid or expired invitation token');
  });
});
