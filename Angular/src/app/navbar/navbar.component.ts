import { Component } from '@angular/core';
import { combineLatest, Subscription } from 'rxjs';
import { RouterLink } from '@angular/router';
import { NgbCollapse } from '@ng-bootstrap/ng-bootstrap';
import { environment } from '../../environments/environment';
import { ALL_CHAINS, Web3Service } from '../services/web3';
import { W3MCoreButtonComponentWrapperComponent } from '../w3-mcore-button-component-wrapper/w3-mcore-button-component-wrapper.component';
import { AutoUnsubscribe } from '../auto-unsubscribe.decorator';

@Component({
    selector: 'app-navbar',
    templateUrl: './navbar.component.html',
    styleUrls: ['./navbar.component.scss'],
    imports: [RouterLink, NgbCollapse, W3MCoreButtonComponentWrapperComponent]
})
@AutoUnsubscribe
export class NavbarComponent {

  isDevelopment = environment.production==false

  isMenuCollapsed = true;

  chainName=''

  private chainSubscription: Subscription|undefined=undefined;
  
  constructor( private w3s: Web3Service){
    

  }

  toggleTheme() {
    let bodyTheme = document.body
    bodyTheme.classList.toggle('light-theme')
  }

  ngOnInit(){
    setTimeout(()=>{
      

      this.chainSubscription= this.w3s.chainId$.subscribe(async ( chainId)=>{
        setTimeout(()=>{
          this.chainName =ALL_CHAINS[chainId??31337]?.name
        }, 300)
      })

    }, 300)
  }
}
