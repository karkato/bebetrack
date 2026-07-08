import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideZonelessChangeDetection } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { LoginComponent } from './login.component';
import { SessionService } from '../../../core/auth/session.service';

function makeSessionMock() {
  return {
    signIn: vi.fn().mockResolvedValue(undefined),
  } as unknown as SessionService;
}

describe('LoginComponent', () => {
  let sessionMock: ReturnType<typeof makeSessionMock>;

  beforeEach(async () => {
    sessionMock = makeSessionMock();

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: SessionService, useValue: sessionMock },
      ],
    }).compileComponents();
  });

  it('creates the component', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('calls SessionService.signIn() with email and password on valid submit', async () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;

    // Set form values via the signal model
    component['model'].set({ email: 'test@example.com', password: 'secret123' });

    // Mark as touched + check validity bypasses the invalid guard
    component.loginForm().markAsTouched();

    // Trigger submit
    await component.onSubmit(new Event('submit'));

    expect(sessionMock.signIn).toHaveBeenCalledWith('test@example.com', 'secret123');
  });

  it('displays auth error when signIn throws', async () => {
    sessionMock.signIn = vi.fn().mockRejectedValue(new Error('Invalid credentials'));

    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;

    component['model'].set({ email: 'test@example.com', password: 'wrong' });
    component.loginForm().markAsTouched();

    await component.onSubmit(new Event('submit'));

    expect(component.authError()).toBe('Invalid credentials');
  });

  it('does not call signIn when form is invalid', async () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;

    // Leave model as empty — form should be invalid
    component.loginForm().markAsTouched();

    await component.onSubmit(new Event('submit'));

    expect(sessionMock.signIn).not.toHaveBeenCalled();
  });
});
