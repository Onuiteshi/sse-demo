import { Controller, Post,Body, Sse, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Observable } from 'rxjs';

@Controller('notifications')
export class NotificationsController {
    constructor(private readonly notificationService : NotificationsService){}

    @Sse()
    stream(@Query('userId') userId:string):Observable<MessageEvent>{
        return this.notificationService.getNotificationStream(userId);
    }

    @Post()
    send(@Body() body:{userId:string,message:string}): {status:string}{
        this.notificationService.sendNotification(body.userId,body.message);
        return {status:'notification sent'};
    }

}
