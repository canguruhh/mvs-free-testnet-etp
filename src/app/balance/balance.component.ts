import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface Balance {
  available: number
}

@Component({
  selector: 'balance',
  templateUrl: './balance.component.html',
  styleUrls: ['./balance.component.sass']
})
export class BalanceComponent implements OnInit {

  balance: Balance

  constructor(private http: HttpClient) { }

  ngOnInit() {
    this.loadBalance()
  }

  loadBalance(){
    this.http.get('/api/balance').subscribe((res:Balance) => {
      this.balance = res
    }, error => {
      console.error(error)
    })
  }

}
