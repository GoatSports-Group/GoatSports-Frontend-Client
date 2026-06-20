import { Component, OnInit, inject } from '@angular/core';
import { BookingService } from '@presentation/services/booking.service';
import { Booking, BookingStatus } from '@application/dto/booking/booking.dto';
import { SportType } from '@application/dto/venue/venue.dto';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-my-bookings',
  templateUrl: './my-bookings.component.html',
  styleUrls: ['./my-bookings.component.scss']
})
export class MyBookingsComponent implements OnInit {
  private bookingService = inject(BookingService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  bookings: Booking[] = [];
  filteredBookings: Booking[] = [];
  loading = true;
  activeTab = 'all';

  // Count variables for badges
  countAll = 0;
  countPending = 0;
  countConfirmed = 0;
  countCompleted = 0;
  countCancelled = 0;

  ngOnInit() {
    this.loadBookings();
  }

  loadBookings() {
    this.loading = true;
    this.bookingService.getMyBookings().subscribe({
      next: (data) => {
        this.bookings = data;
        this.calculateCounts();
        this.filterBookings();
        this.loading = false;
      },
      error: () => {
        this.snackBar.open('Không thể tải danh sách đặt sân!', 'Đóng', {
          duration: 3000,
          panelClass: ['snackbar-error']
        });
        this.loading = false;
      }
    });
  }

  calculateCounts() {
    this.countAll = this.bookings.length;
    this.countPending = this.bookings.filter(b => b.status === BookingStatus.PENDING).length;
    this.countConfirmed = this.bookings.filter(b => b.status === BookingStatus.CONFIRMED).length;
    this.countCompleted = this.bookings.filter(b => b.status === BookingStatus.COMPLETED).length;
    this.countCancelled = this.bookings.filter(b => b.status === BookingStatus.CANCELLED).length;
  }

  filterBookings() {
    if (this.activeTab === 'all') {
      this.filteredBookings = this.bookings;
    } else {
      this.filteredBookings = this.bookings.filter((b) => {
        switch (this.activeTab) {
          case 'pending': return b.status === BookingStatus.PENDING;
          case 'confirmed': return b.status === BookingStatus.CONFIRMED;
          case 'completed': return b.status === BookingStatus.COMPLETED;
          case 'cancelled': return b.status === BookingStatus.CANCELLED;
          default: return false;
        }
      });
    }
  }

  setTab(tab: string) {
    this.activeTab = tab;
    this.filterBookings();
  }

  canCancel(booking: Booking): boolean {
    return booking.status === BookingStatus.PENDING || booking.status === BookingStatus.CONFIRMED;
  }

  cancelBooking(booking: Booking, event: MouseEvent) {
    event.stopPropagation();

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Hủy Đặt Sân',
        message: `Bạn có chắc chắn muốn hủy lịch đặt sân tại "${booking.venueName}" vào ngày ${booking.bookingDate} (${booking.timeSlot}) không?`,
        confirmText: 'Xác nhận hủy',
        cancelText: 'Quay lại',
        confirmColor: 'warn'
      }
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.bookingService.cancelBooking(booking.bookingId).subscribe({
          next: (success) => {
            if (success) {
              this.snackBar.open('Đã hủy lịch đặt sân thành công!', 'Đóng', {
                duration: 3000,
                panelClass: ['snackbar-success']
              });
              this.loadBookings();
            } else {
              this.snackBar.open('Hủy lịch đặt sân thất bại!', 'Đóng', {
                duration: 3000,
                panelClass: ['snackbar-error']
              });
            }
          }
        });
      }
    });
  }

  getStatusLabel(status: BookingStatus): string {
    return status;
  }

  getStatusClass(status: BookingStatus): string {
    switch (status) {
      case BookingStatus.PENDING: return 'status-badge status-pending';
      case BookingStatus.CONFIRMED: return 'status-badge status-confirmed';
      case BookingStatus.COMPLETED: return 'status-badge status-completed';
      case BookingStatus.CANCELLED: return 'status-badge status-cancelled';
      default: return 'status-badge';
    }
  }

  getSportTypeLabel(type: string): string {
    switch (type) {
      case 'soccer': return SportType.SOCCER;
      case 'badminton': return SportType.BADMINTON;
      case 'tennis': return SportType.TENNIS;
      case 'pickleball': return SportType.PICKLEBALL;
      case 'basketball': return SportType.BASKETBALL;
      case 'volleyball': return SportType.VOLLEYBALL;
      default: return type;
    }
  }
}
