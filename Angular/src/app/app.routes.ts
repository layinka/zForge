import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/tokenize',
    pathMatch: 'full'
  },
  {
    path: 'tokenize',
    loadComponent: () => import('./components/tokenize/tokenize.component').then(m => m.TokenizeComponent)
  },
  {
    path: 'ptyt',
    loadComponent: () => import('./components/ptyt/ptyt.component').then(m => m.PtytComponent)
  },
  {
    path: 'pools',
    loadComponent: () => import('./components/pools/pools.component').then(m => m.PoolsComponent)
  },
  {
    path: '**',
    redirectTo: '/tokenize'
  }
];
