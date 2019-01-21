import { Component } from '@angular/core';
import {environment} from '../environments/environment';


interface SendResponse {
  hash: string
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.sass']
})
export class AppComponent {

  myAddress: string = environment.address

  constructor(){
  }

}
