import { Injectable } from '@nestjs/common';
import { map, Observable, Subject } from 'rxjs';

@Injectable()
export class NotificationsService {
    private notificationSubject = new Subject<string>();

    sendNotification(message:string):void {
        this.notificationSubject.next(message);
    }

    getNotificationStream(): Observable<MessageEvent>{
        return this.notificationSubject.pipe(
            map((message):MessageEvent =>({
                data : {message,timestamp : new Date().toISOString()}
            } as MessageEvent))
        )
    }
    
}
