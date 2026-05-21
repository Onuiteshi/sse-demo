import { Controller, Post, Body, Sse, Query, Headers, MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Sse()
  stream(
    @Query('userId') userId: string,
    @Headers('last-event-id') lastEventId?: string,
  ): Observable<MessageEvent> {
    return this.notificationsService.getNotificationStream(
      userId,
      lastEventId,
    ) as Observable<MessageEvent>;
  }

  @Post()
  send(@Body() body: { userId: string; message: string }): { status: string } {
    this.notificationsService.sendNotification(body.userId, body.message);
    return { status: 'notification sent' };
  }
}