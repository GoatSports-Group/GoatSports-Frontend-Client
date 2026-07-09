import { APP_INITIALIZER, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ApiInterceptor } from './presentation/interceptors/api.interceptor';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AUTH_REPOSITORY_TOKEN } from '@application/ports/persistence/auth.repository';
import { OWNER_APPLICATION_REPOSITORY_TOKEN } from '@application/ports/persistence/owner-application.repository';
import { NOTIFICATION_REPOSITORY_TOKEN } from '@application/ports/persistence/notification.repository';
import { WEBSOCKET_SERVICE_TOKEN } from '@application/ports/websocket.service';

import { AuthRepositoryImpl } from '@infrastructure/repositories/auth.repository.impl';
import { OwnerApplicationRepositoryImpl } from '@infrastructure/repositories/owner-application.repository.impl';
import { NotificationRepositoryImpl } from '@infrastructure/repositories/notification.repository.impl';
import { StompWebSocketService } from '@infrastructure/websocket/stomp-websocket.service';
import { KeycloakAngularModule, KeycloakService } from 'keycloak-angular';

function initializeKeycloak(keycloak: KeycloakService) {
  return () =>
    keycloak.init({
      config: {
        url: import.meta.env.NG_APP_KEYCLOAK_URL,
        realm: import.meta.env.NG_APP_KEYCLOAK_REALM,
        clientId: import.meta.env.NG_APP_KEYCLOAK_CLIENT_ID
      },
      initOptions: {
        onLoad: 'check-sso',
        silentCheckSsoRedirectUri: window.location.origin + '/assets/silent-check-sso.html'
      }
    });
}

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
    KeycloakAngularModule
  ],
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: initializeKeycloak,
      multi: true,
      deps: [KeycloakService]
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: ApiInterceptor,
      multi: true
    },
    { provide: AUTH_REPOSITORY_TOKEN, useClass: AuthRepositoryImpl },
    { provide: OWNER_APPLICATION_REPOSITORY_TOKEN, useClass: OwnerApplicationRepositoryImpl },
    { provide: NOTIFICATION_REPOSITORY_TOKEN, useClass: NotificationRepositoryImpl },
    { provide: WEBSOCKET_SERVICE_TOKEN, useClass: StompWebSocketService }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
