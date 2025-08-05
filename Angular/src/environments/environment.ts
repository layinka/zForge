// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  // Add common environment settings here
  apiUrl: 'http://localhost:3015/api/v1',
  walletConnectProjectId: '6dc075707b4e66bff8df286aab204770',
  contracts: {
    syFactory: '0x...', // Will be updated after deployment
    mockStCORE: '0x...' // Will be updated after deployment
  },
  // Add other development environment variables here
};

/*
 * For easier debugging in development, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
