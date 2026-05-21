import { Controller, Post,Body, Sse } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Observable } from 'rxjs';

@Controller('notifications')
export class NotificationsController {
    constructor(private readonly notificationService : NotificationsService){}

    @Sse()
    stream():Observable<MessageEvent>{
        return this.notificationService.getNotificationStream();
    }

    @Post()
    send(@Body() body:{message:string}): {status:string}{
        this.notificationService.sendNotification(body.message);
        return {status:'notification sent'};
    }

}
