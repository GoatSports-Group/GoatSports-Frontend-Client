import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription, debounceTime, timer } from 'rxjs';
import { OwnerApplication } from '@application/dto/owner-application/owner-application.dto';
import { GetMyOwnerApplicationsUseCase } from '@application/usecase/owner-application/get-my-owner-applications.usecase';
import { NotificationService } from '@presentation/services/notification.service';
import { NotifyService } from '@shared/components/notify/notify.service';
import { WEBSOCKET_SERVICE_TOKEN } from '@application/ports/websocket.service';

@Component({
  selector: 'app-owner-application',
  templateUrl: './owner-application.component.html',
  styleUrls: ['./owner-application.component.scss'],
  standalone: false
})
export class OwnerApplicationComponent implements OnInit, OnDestroy {
  private readonly getApplications = inject(GetMyOwnerApplicationsUseCase);
  private readonly notifications = inject(NotificationService);
  private readonly notify = inject(NotifyService);
  private readonly websocket = inject(WEBSOCKET_SERVICE_TOKEN);
  private notificationSub?: Subscription;
  private progressSub?: Subscription;
  private progressPollingSub?: Subscription;

  activeView: 'history' | 'form' = 'history';
  applications: OwnerApplication[] = [];
  loading = false;

  ngOnInit(): void {
    this.loadApplications();
    this.notificationSub = this.notifications.notifications$.subscribe(() => {
      if (this.applications.length > 0) this.loadApplications(false);
    });
    this.progressSub = this.websocket.ownerApplicationProgress$
      .pipe(debounceTime(750))
      .subscribe(event => {
        if (this.applications.some(application => application.ownerApplicationId === event.ownerApplicationId)) {
          this.loadApplications(false);
        }
      });
    this.progressPollingSub = timer(30000, 30000).subscribe(() => {
      if (this.activeView === 'history' && this.applications.length > 0) {
        this.loadApplications(false);
      }
    });
  }

  ngOnDestroy(): void {
    this.notificationSub?.unsubscribe();
    this.progressSub?.unsubscribe();
    this.progressPollingSub?.unsubscribe();
  }

  openHistory(): void {
    this.activeView = 'history';
    this.scrollToTop();
  }

  openForm(): void {
    this.activeView = 'form';
    this.scrollToTop();
  }

  handleSubmitted(applications: OwnerApplication[]): void {
    this.applications = applications;
    this.openHistory();
  }

  private loadApplications(showLoading = true): void {
    this.loading = showLoading;
    this.getApplications.execute().subscribe({
      next: applications => {
        this.applications = applications;
        this.loading = false;
        if (applications.length === 0 && this.activeView === 'history') this.activeView = 'form';
      },
      error: error => {
        console.error('Failed to load owner applications:', error);
        this.loading = false;
        this.notify.error('Không thể tải danh sách đơn đăng ký.');
      }
    });
  }

  private scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
