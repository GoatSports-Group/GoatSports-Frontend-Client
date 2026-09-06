import { TimeSlotStatus } from '@domain/enums/time-slot-status.enum';

export interface TimeSlot {
  timeSlotId: string;
  venueCourtId: string;
  date: string;
  startTime: string;
  endTime: string;
  pricePerHour: number;
  status: TimeSlotStatus;
}
