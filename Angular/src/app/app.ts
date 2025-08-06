import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { provideIcons, NgIcon } from '@ng-icons/core';
import { bootstrapHouse } from '@ng-icons/bootstrap-icons';
import { NavbarComponent } from "./navbar/navbar.component";
import { Web3Service } from './services/web3';
import { W3MCoreButtonComponentWrapperComponent } from "./w3-mcore-button-component-wrapper/w3-mcore-button-component-wrapper.component";

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NgIcon, NavbarComponent, W3MCoreButtonComponentWrapperComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  providers: [provideIcons({ bootstrapHouse })],
})
export class App {
  protected readonly title = signal('zForge');
  web3Service= inject(Web3Service);
}
