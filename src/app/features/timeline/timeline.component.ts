import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FeedingService } from '../../core/feeding/feeding.service';
import { DiaperService } from '../../core/diaper/diaper.service';
import { feedingTypeLabel } from '../../shared/elapsed-time';
import {
  mergeEventsSorted,
  computeWeekStats,
  formatIntervalMs,
  toLocalTimeString,
  toLocalDateString,
  type TimelineEvent,
  type DayStats,
} from './timeline-stats';

type ViewMode = 'day' | 'week';

@Component({
  selector: 'app-timeline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonToggleModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="timeline-container">
      <header class="timeline-header">
        <h1>Timeline</h1>
        <mat-button-toggle-group
          [value]="view()"
          (change)="view.set($event.value)"
          aria-label="Vue"
        >
          <mat-button-toggle value="day">Journée</mat-button-toggle>
          <mat-button-toggle value="week">7 jours</mat-button-toggle>
        </mat-button-toggle-group>
      </header>

      @if (isLoading()) {
        <div class="loading">
          <mat-spinner diameter="40" />
        </div>
      } @else {

        @if (view() === 'day') {
          @if (todayEvents().length === 0) {
            <p class="empty">Aucun événement aujourd'hui.</p>
          } @else {
            <ul class="event-list">
              @for (event of todayEvents(); track event.id) {
                <li class="event-item event-item--{{ event.kind }}">
                  <span class="event-time">{{ eventTime(event) }}</span>
                  <span class="event-label">{{ eventLabel(event) }}</span>
                </li>
              }
            </ul>
          }
        }

        @if (view() === 'week') {
          @defer {
            <table class="week-table">
              <thead>
                <tr>
                  <th>Jour</th>
                  <th>Tétées</th>
                  <th>Intervalle moy.</th>
                </tr>
              </thead>
              <tbody>
                @for (day of weekStats(); track day.date) {
                  <tr>
                    <td>{{ formatDay(day.date) }}</td>
                    <td>{{ day.feedingCount }}</td>
                    <td>{{ formatIntervalMs(day.avgIntervalMs) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          } @placeholder {
            <p class="loading-text">Chargement des statistiques…</p>
          }
        }

      }
    </div>
  `,
  styles: `
    .timeline-container {
      padding: 16px;
      max-width: 600px;
      margin: 0 auto;
      padding-bottom: 80px;
    }

    .timeline-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 12px;
    }

    .timeline-header h1 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 600;
    }

    .loading {
      display: flex;
      justify-content: center;
      padding: 40px 0;
    }

    .loading-text {
      text-align: center;
      color: var(--mat-sys-on-surface-variant);
      padding: 16px;
    }

    .empty {
      text-align: center;
      color: var(--mat-sys-on-surface-variant);
      padding: 32px 16px;
    }

    .event-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .event-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 12px;
      background: var(--mat-sys-surface-container);
    }

    .event-item--feeding {
      border-left: 4px solid var(--mat-sys-primary);
    }

    .event-item--diaper {
      border-left: 4px solid var(--mat-sys-tertiary);
    }

    .event-time {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--mat-sys-on-surface-variant);
      min-width: 42px;
    }

    .event-label {
      font-size: 0.9rem;
      color: var(--mat-sys-on-surface);
    }

    .week-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }

    .week-table th {
      text-align: left;
      padding: 8px 12px;
      border-bottom: 2px solid var(--mat-sys-outline-variant);
      color: var(--mat-sys-on-surface-variant);
      font-weight: 600;
    }

    .week-table td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      color: var(--mat-sys-on-surface);
    }

    .week-table tr:last-child td {
      border-bottom: none;
    }
  `,
})
export class TimelineComponent {
  private readonly feedingService = inject(FeedingService);
  private readonly diaperService = inject(DiaperService);

  readonly view = signal<ViewMode>('day');

  readonly isLoading = computed(
    () =>
      this.feedingService.recentFeedings.isLoading() ||
      this.diaperService.recentDiapers.isLoading(),
  );

  /** All events from today (local calendar day), sorted desc */
  readonly todayEvents = computed<TimelineEvent[]>(() => {
    const feedings = this.feedingService.recentFeedings.value() ?? [];
    const diapers = this.diaperService.recentDiapers.value() ?? [];
    const allEvents = mergeEventsSorted(feedings, diapers);

    const todayStr = toLocalDateString(new Date().toISOString());
    return allEvents.filter(e => toLocalDateString(e.timestamp) === todayStr);
  });

  /** 7-day statistics computed from recent feedings */
  readonly weekStats = computed<DayStats[]>(() => {
    const feedings = this.feedingService.recentFeedings.value() ?? [];
    return computeWeekStats(feedings);
  });

  eventTime(event: TimelineEvent): string {
    return toLocalTimeString(event.timestamp);
  }

  eventLabel(event: TimelineEvent): string {
    if (event.kind === 'feeding') {
      const typeLabel = feedingTypeLabel(event.feedingType!);
      if (event.amountMl != null) return `Tétée — biberon ${event.amountMl} ml`;
      return `Tétée — ${typeLabel}`;
    }
    // diaper
    const kindLabels: Record<string, string> = {
      wet: 'Couche mouillée',
      dirty: 'Couche sale',
      mixed: 'Couche mixte',
    };
    return kindLabels[event.diaperKind!] ?? 'Couche';
  }

  formatDay(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  /** Expose pure function to template */
  formatIntervalMs = formatIntervalMs;
}
