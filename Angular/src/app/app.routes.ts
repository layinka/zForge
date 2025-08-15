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
    path: 'details/:u/:m',
    loadComponent: () => import('./components/ptyt-details/ptyt-details.component').then(m => m.PtYtDetailsComponent)
  },
  {
    path: 'details/:u/:m/:staked',
    loadComponent: () => import('./components/ptyt-details/ptyt-details.component').then(m => m.PtYtDetailsComponent)
  },
  {
    path: 'pools',
    loadComponent: () => import('./components/pools/pools.component').then(m => m.PoolsComponent)
  },
  {
    path: 'stake/:tokenAddress',
    loadComponent: () => import('./components/staking/staking.component').then(m => m.StakingComponent)
  },
  {
    path: '**',
    redirectTo: '/tokenize'
  }
];
