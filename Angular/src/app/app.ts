import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { provideIcons, NgIcon } from '@ng-icons/core';
import { bootstrapHouse } from '@ng-icons/bootstrap-icons';
import { NavbarComponent } from "./navbar/navbar.component";

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NgIcon, NavbarComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  providers: [provideIcons({ bootstrapHouse })],
})
export class App {
  protected readonly title = signal('zForge');
}
