import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

// Angular Material Imports
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialogModule } from '@angular/material/dialog';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { HeaderComponent } from '@shared/components/header/header.component';
import { FooterComponent } from '@shared/components/footer/footer.component';
import { StarRatingComponent } from '@shared/components/star-rating/star-rating.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { FormFieldComponent } from '@shared/components/ui/form-field/form-field.component';
import { SelectComponent } from '@shared/components/ui/select/select.component';
import { FileUploadComponent } from '@shared/components/file-upload/file-upload.component';

const MATERIAL_MODULES = [
  MatToolbarModule,
  MatSidenavModule,
  MatCardModule,
  MatButtonModule,
  MatIconModule,
  MatInputModule,
  MatFormFieldModule,
  MatMenuModule,
  MatBadgeModule,
  MatDialogModule,
  MatPaginatorModule,
  MatTabsModule,
  MatTableModule,
  MatSelectModule,
  MatCheckboxModule,
  MatRadioModule,
  MatProgressBarModule,
  MatDividerModule,
  MatProgressSpinnerModule
];

const COMPONENT_DECLARATIONS = [
  HeaderComponent,
  FooterComponent,
  StarRatingComponent,
  LoadingSkeletonComponent,
  ConfirmDialogComponent,
  SelectComponent,
  FileUploadComponent
];

@NgModule({
  declarations: [
    ...COMPONENT_DECLARATIONS
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    LucideIconComponent,
    FormFieldComponent,
    ...MATERIAL_MODULES
  ],
  exports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    LucideIconComponent,
    FormFieldComponent,
    ...MATERIAL_MODULES,
    ...COMPONENT_DECLARATIONS
  ]
})
export class SharedModule { }
