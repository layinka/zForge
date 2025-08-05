import { Component, EventEmitter, Output, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-switch-button',
  templateUrl: './switch-button.component.html',
  styleUrls: ['./switch-button.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class SwitchButtonComponent {
  // Input to control disabled state
  disabled = input<boolean>(false);
  
  // Output event when button is clicked
  @Output() switch = new EventEmitter<void>();
  
  // Handle button click
  onClick() {
    if (!this.disabled()) {
      this.switch.emit();
    }
  }
}
