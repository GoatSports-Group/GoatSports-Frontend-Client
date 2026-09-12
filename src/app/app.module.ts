import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ApiInterceptor } from './presentation/interceptors/api.interceptor';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NotifyComponent } from '@shared/components/notify/notify.component';

import { AUTH_REPOSITORY_TOKEN } from '@application/ports/persistence/auth.repository';
import { OWNER_APPLICATION_REPOSITORY_TOKEN } from '@application/ports/persistence/owner-application.repository';
import { NOTIFICATION_REPOSITORY_TOKEN } from '@application/ports/persistence/notification.repository';
import { USER_REPOSITORY_TOKEN } from '@application/ports/persistence/user.repository';
import { STORAGE_REPOSITORY_TOKEN } from '@application/ports/persistence/storage.repository';
import { VENUE_SEARCH_REPOSITORY_TOKEN } from '@application/ports/persistence/venue-search.repository';
import { VENUE_FAVORITE_REPOSITORY_TOKEN } from '@application/ports/persistence/venue-favorite.repository';
import { BOOKING_REPOSITORY_TOKEN } from '@application/ports/persistence/booking.repository';
import { PAYMENT_REPOSITORY_TOKEN } from '@application/ports/persistence/payment.repository';
import { BANK_ACCOUNT_REPOSITORY_TOKEN } from '@application/ports/persistence/bank-account.repository';
import { CHAT_REPOSITORY_TOKEN } from '@application/ports/persistence/chat.repository';
import { FRIEND_REPOSITORY_TOKEN } from '@application/ports/persistence/friend.repository';
import { REVIEW_REPOSITORY_TOKEN } from '@application/ports/persistence/review.repository';
import { PLAYER_SPORT_PROFILE_REPOSITORY_TOKEN } from '@application/ports/persistence/player-sport-profile.repository';
import { SOCIAL_FEED_REPOSITORY_TOKEN } from '@application/ports/persistence/social-feed.repository';
import { WEBSOCKET_SERVICE_TOKEN } from '@application/ports/websocket.service';
import { CURRENT_USER_PROVIDER_TOKEN } from '@application/ports/current-user.provider';
import { SessionStateService } from '@presentation/services/session-state.service';

import { AuthRepositoryImpl } from '@infrastructure/repositories/auth.repository.impl';
import { OwnerApplicationRepositoryImpl } from '@infrastructure/repositories/owner-application.repository.impl';
import { NotificationRepositoryImpl } from '@infrastructure/repositories/notification.repository.impl';
import { UserRepositoryImpl } from '@infrastructure/repositories/user.repository.impl';
import { StorageRepositoryImpl } from '@infrastructure/repositories/storage.repository.impl';
import { VenueSearchRepositoryImpl } from '@infrastructure/repositories/venue-search.repository.impl';
import { VenueFavoriteRepositoryImpl } from '@infrastructure/repositories/venue-favorite.repository.impl';
import { BookingRepositoryImpl } from '@infrastructure/repositories/booking.repository.impl';
import { PaymentRepositoryImpl } from '@infrastructure/repositories/payment.repository.impl';
import { BankAccountRepositoryImpl } from '@infrastructure/repositories/bank-account.repository.impl';
import { ChatRepositoryImpl } from '@infrastructure/repositories/chat.repository.impl';
import { FriendRepositoryImpl } from '@infrastructure/repositories/friend.repository.impl';
import { ReviewRepositoryImpl } from '@infrastructure/repositories/review.repository.impl';
import { PlayerSportProfileRepositoryImpl } from '@infrastructure/repositories/player-sport-profile.repository.impl';
import { SocialFeedRepositoryImpl } from '@infrastructure/repositories/social-feed.repository.impl';
import { StompWebSocketService } from '@infrastructure/websocket/stomp-websocket.service';

import { ClubRepositoryPort } from '@application/ports/club.repository.port';
import { TournamentRepositoryPort } from '@application/ports/tournament.repository.port';
import { AiRepositoryPort } from '@application/ports/ai.repository.port';
import { ClubRepository } from '@infrastructure/repositories/club.repository';
import { TournamentRepository } from '@infrastructure/repositories/tournament.repository';
import { AiRepository } from '@infrastructure/repositories/ai.repository';


import {
  provideLucideIcons,
  LucideQrCode,
  LucideMenu,
  LucideSearch,
  LucideX,
  LucideBell,
  LucideUser,
  LucideHistory,
  LucideStore,
  LucideShieldCheck,
  LucideLogOut,
  LucideFileText,
  LucidePhone,
  LucideMapPin,
  LucideAlertTriangle,
  LucideIdCard,
  LucideBuilding2,
  LucideReceipt,
  LucideHome,
  LucideUploadCloud,
  LucideImage,
  LucideCheckCircle,
  LucideCamera,
  LucideSend,
  LucideMail,
  LucideCalendar,
  LucideSettings,
  LucidePalette,
  LucideLanguages,
  LucideShield,
  LucideLock,
  LucideUnlock,
  LucideKey,
  LucideLogIn,
  LucideTrophy,
  LucideTarget,
  LucideSwords,
  LucideAward,
  LucideHourglass,
  LucideRotateCw,
  LucideZap,
  LucideCalendarCheck,
  LucideBrain,
  LucideTrendingUp,
  LucideActivity,
  LucideClock,
  LucideCreditCard,
  LucideArrowRight,
  LucideArrowDown,
  LucideStar,
  LucideStarHalf,
  LucideArrowLeft,
  LucideDollarSign,
  LucideHelpCircle,
  LucideInfo,
  LucideCalendarX,
  LucideXCircle,
  LucideWallet,
  LucideCoins,
  LucideSun,
  LucideConciergeBell,
  LucideGavel,
  LucideFlaskConical,
  LucideUsers,
  LucideBadgeCheck,
  LucideGlobe,
  LucideVideo,
  LucideFlame,
  LucideBellOff,
  LucideCheck,
  LucidePlus,
  LucideUserRound,
  LucideSliders,
  LucideSlidersHorizontal,
  LucideEye,
  LucideEyeOff,
  LucideSave,
  LucideKeyRound,
  LucideShieldAlert,
  LucideLoader2,
  LucideCheckCircle2,
  LucideTrash2,
  LucideCheckCheck,
  LucideInbox,
  LucideBellRing,
  LucideMessageCircle,
  LucideMessageSquare,
  LucideMessagesSquare,
  LucideUserX,
  LucideUserCheck,
  LucideUserPlus,
  LucideDownload,
  LucideHeart,
  LucideShare2,
  LucidePencil,
  LucideFlag,
  LucideLocateFixed,
  LucideMap,
  LucideMapPinOff,
  LucideCircleParking,
  LucideCupSoda,
  LucideShirt,
  LucideSparkles,
  LucideCircleDot,
  LucideCircleDotDashed,
  LucideWifi,
  LucideClock3,
  LucideLayoutGrid,
  LucideChevronLeft,
  LucideChevronRight,
  LucideChevronDown,
  LucideCircle,
  LucideCircleAlert,
  LucideCircleCheck,
  LucideWifiOff,
  LucideCar,
  LucideDroplets,
  LucideFolderOpen
} from '@lucide/angular';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    FormsModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    MatProgressSpinnerModule,
    NotifyComponent
  ],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: ApiInterceptor,
      multi: true
    },
    { provide: AUTH_REPOSITORY_TOKEN, useClass: AuthRepositoryImpl },
    { provide: OWNER_APPLICATION_REPOSITORY_TOKEN, useClass: OwnerApplicationRepositoryImpl },
    { provide: NOTIFICATION_REPOSITORY_TOKEN, useClass: NotificationRepositoryImpl },
    { provide: USER_REPOSITORY_TOKEN, useClass: UserRepositoryImpl },
    { provide: STORAGE_REPOSITORY_TOKEN, useClass: StorageRepositoryImpl },
    { provide: VENUE_SEARCH_REPOSITORY_TOKEN, useClass: VenueSearchRepositoryImpl },
    { provide: VENUE_FAVORITE_REPOSITORY_TOKEN, useClass: VenueFavoriteRepositoryImpl },
    { provide: BOOKING_REPOSITORY_TOKEN, useClass: BookingRepositoryImpl },
    { provide: PAYMENT_REPOSITORY_TOKEN, useClass: PaymentRepositoryImpl },
    { provide: BANK_ACCOUNT_REPOSITORY_TOKEN, useClass: BankAccountRepositoryImpl },
    { provide: CHAT_REPOSITORY_TOKEN, useClass: ChatRepositoryImpl },
    { provide: FRIEND_REPOSITORY_TOKEN, useClass: FriendRepositoryImpl },
    { provide: REVIEW_REPOSITORY_TOKEN, useClass: ReviewRepositoryImpl },
    { provide: PLAYER_SPORT_PROFILE_REPOSITORY_TOKEN, useClass: PlayerSportProfileRepositoryImpl },
    { provide: SOCIAL_FEED_REPOSITORY_TOKEN, useClass: SocialFeedRepositoryImpl },
    { provide: WEBSOCKET_SERVICE_TOKEN, useClass: StompWebSocketService },
    { provide: CURRENT_USER_PROVIDER_TOKEN, useExisting: SessionStateService },
    { provide: ClubRepositoryPort, useClass: ClubRepository },
    { provide: TournamentRepositoryPort, useClass: TournamentRepository },
    { provide: AiRepositoryPort, useClass: AiRepository },

    provideLucideIcons(
      LucideQrCode,
      LucideMenu,
      LucideSearch,
      LucideX,
      LucideBell,
      LucideUser,
      LucideHistory,
      LucideStore,
      LucideShieldCheck,
      LucideLogOut,
      LucideFileText,
      LucidePhone,
      LucideMapPin,
      LucideAlertTriangle,
      LucideIdCard,
      LucideBuilding2,
      LucideReceipt,
      LucideHome,
      LucideUploadCloud,
      LucideImage,
      LucideCheckCircle,
      LucideCamera,
      LucideSend,
      LucideMail,
      LucideCalendar,
      LucideSettings,
      LucidePalette,
      LucideLanguages,
      LucideShield,
      LucideLock,
      LucideUnlock,
      LucideKey,
      LucideLogIn,
      LucideTrophy,
      LucideTarget,
      LucideSwords,
      LucideAward,
      LucideHourglass,
      LucideRotateCw,
      LucideZap,
      LucideCalendarCheck,
      LucideBrain,
      LucideTrendingUp,
      LucideActivity,
      LucideClock,
      LucideCreditCard,
      LucideArrowRight,
      LucideArrowDown,
      LucideStar,
      LucideStarHalf,
      LucideArrowLeft,
      LucideDollarSign,
      LucideHelpCircle,
      LucideInfo,
      LucideCalendarX,
      LucideXCircle,
      LucideWallet,
      LucideCoins,
      LucideSun,
      LucideConciergeBell,
      LucideGavel,
      LucideFlaskConical,
      LucideUsers,
      LucideBadgeCheck,
      LucideGlobe,
      LucideVideo,
      LucideFlame,
      LucideBellOff,
      LucideCheck,
      LucidePlus,
      LucideUserRound,
      LucideSliders,
      LucideSlidersHorizontal,
      LucideEye,
      LucideEyeOff,
      LucideSave,
      LucideKeyRound,
      LucideShieldAlert,
      LucideLoader2,
      LucideCheckCircle2,
      LucideTrash2,
      LucideCheckCheck,
      LucideInbox,
      LucideBellRing,
      LucideMessageCircle,
      LucideMessageSquare,
      LucideMessagesSquare,
      LucideUserX,
      LucideUserCheck,
      LucideUserPlus,
      LucideDownload,
      LucideHeart,
      LucideShare2,
      LucidePencil,
      LucideFlag,
      LucideLocateFixed,
      LucideMap,
      LucideMapPinOff,
      LucideCircleParking,
      LucideCupSoda,
      LucideShirt,
      LucideSparkles,
      LucideCircleDot,
      LucideCircleDotDashed,
      LucideWifi,
      LucideClock3,
      LucideLayoutGrid,
      LucideChevronLeft,
      LucideChevronRight,
      LucideChevronDown,
      LucideCircle,
      LucideCircleAlert,
      LucideCircleCheck,
      LucideWifiOff,
      LucideCar,
      LucideDroplets,
      LucideFolderOpen
    )
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
