import { Injectable } from '@nestjs/common';
import { filter, map, Observable, Subject } from 'rxjs';

interface NotificationEvent {
    userId: string;
    message: string;
}

@Injectable()
export class NotificationsService {
    private notificationSubject = new Subject<NotificationEvent>();

    sendNotification(userId:string,message:string):void {
        this.notificationSubject.next({userId,message});
    }

    getNotificationStream(userId:string): Observable<MessageEvent>{
        return this.notificationSubject.pipe(
            filter((event) => event.userId === userId),
            map((event):MessageEvent =>({
                data : {message:event.message,timestamp : new Date().toISOString()}
            } as MessageEvent))
        );
    }
    
}
