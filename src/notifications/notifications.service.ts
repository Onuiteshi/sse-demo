import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';

interface NotificationEvent {
  id: string;
  userId: string;
  message: string;
  timestamp: string;
}

interface SseEvent {
  data: {
    message: string;
    timestamp: string;
  };
  id: string;
}

@Injectable()
export class NotificationsService {
  private notificationSubject = new Subject<NotificationEvent>();
  private eventStore: NotificationEvent[] = [];
  private eventCounter = 0;

  sendNotification(userId: string, message: string): void {
    const event: NotificationEvent = {
      id: String(++this.eventCounter),
      userId,
      message,
      timestamp: new Date().toISOString(),
    };

    this.eventStore.push(event);
    this.notificationSubject.next(event);
  }

  getMissedEvents(userId: string, lastEventId: string | undefined): NotificationEvent[] {
    if (!lastEventId) return [];

    return this.eventStore.filter(
      (event) =>
        event.userId === userId && Number(event.id) > Number(lastEventId),
    );
  }

  getNotificationStream(
    userId: string,
    lastEventId?: string,
  ): Observable<SseEvent> {
    const missed = this.getMissedEvents(userId, lastEventId);

    const missed$ = new Observable<SseEvent>((subscriber) => {
      missed.forEach((event) => {
        subscriber.next({
          data: {
            message: event.message,
            timestamp: event.timestamp,
          },
          id: event.id,
        });
      });
    });

    const live$ = this.notificationSubject.pipe(
      filter((event) => event.userId === userId),
      map((event): SseEvent => ({
        data: {
          message: event.message,
          timestamp: event.timestamp,
        },
        id: event.id,
      })),
    );

    return new Observable<SseEvent>((subscriber) => {
      missed$.subscribe((event) => subscriber.next(event));
      live$.subscribe((event) => subscriber.next(event));
    });
  }
}