import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Token } from '../../models/token.model';
import { ASSETS } from '../../constants/asset-list';

@Component({
  selector: 'app-token-selector',
  templateUrl: './token-selector.component.html',
  styleUrls: ['./token-selector.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class TokenSelectorComponent implements OnInit {
  activeModal = inject(NgbActiveModal);
  
  searchTerm = '';
  tokens: Token[] = ASSETS;
  filteredTokens: Token[] = [...this.tokens];
  
  // Current token to highlight in the list
  currentToken: Token | null = null;
  
  // Network filter - will be set by the parent component
  filterByNetwork: 'Ethereum' | 'Stellar' | null = null;
  
  ngOnInit() {
    this.applyFilters();
  }
  
  // Apply both network and search filters
  applyFilters() {
    let filtered = [...this.tokens];
    
    // First filter by network if specified
    if (this.filterByNetwork) {
      filtered = filtered.filter(token => token.chain === this.filterByNetwork);
    }
    
    // Then filter by search term
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(
        token => 
          token.name.toLowerCase().includes(term) ||
          token.symbol.toLowerCase().includes(term) ||
          token.address.toLowerCase().includes(term)
      );
    }
    
    this.filteredTokens = filtered;
  }
  
  // Legacy method for backward compatibility - now calls applyFilters
  filterTokens() {
    this.applyFilters();
  }
  
  // Select a token and close the modal
  selectToken(token: Token) {
    this.activeModal.close(token);
  }
  
  // Check if a token is the currently selected one
  isCurrentToken(token: Token): boolean {
    return this.currentToken?.address === token.address && 
           this.currentToken?.chain === token.chain;
  }
}
