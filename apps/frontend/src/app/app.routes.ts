import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'meters',
  },
  {
    path: 'meters',
    loadComponent: () =>
      import('./features/meters/meter-list/meter-list.page').then(
        (module) => module.MeterListPage,
      ),
  },
  {
    path: 'meters/:id',
    loadComponent: () =>
      import('./features/meters/meter-detail/meter-detail.page').then(
        (module) => module.MeterDetailPage,
      ),
  },
  {
    path: '**',
    redirectTo: 'meters',
  },
];